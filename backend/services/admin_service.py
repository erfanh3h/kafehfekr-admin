import os
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from bson import ObjectId

from database import db
from security import (
    hash_admin_password,
    verify_admin_password,
    create_admin_access_token,
)


def _clean_doc(doc: Any) -> Any:
    """Recursively converts MongoDB/BSON types into JSON serializable types."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [_clean_doc(item) for item in doc]
    if isinstance(doc, dict):
        cleaned = {}
        for k, v in doc.items():
            if isinstance(v, datetime):
                cleaned[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                cleaned[k] = str(v)
            elif isinstance(v, (dict, list)):
                cleaned[k] = _clean_doc(v)
            else:
                cleaned[k] = v
        return cleaned
    return doc


def generate_log_id() -> str:
    alphabet = string.ascii_letters + string.digits
    return "log_" + "".join(secrets.choice(alphabet) for _ in range(8))


# -------------------------------------------------------------
# Admin Auth & Management
# -------------------------------------------------------------

def login_admin(username: str, password: str) -> dict:
    clean_user = str(username or "").strip().lower()
    admin_doc = db.admin_manager.find_by_username(clean_user)
    if not admin_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور اشتباه است.",
        )

    if not admin_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="این حساب کاربری غیرفعال شده است.",
        )

    if not verify_admin_password(password, admin_doc.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور اشتباه است.",
        )

    db.admin_manager.update_last_login(admin_doc["_id"])
    token = create_admin_access_token(admin_doc)
    sanitized = db.admin_manager._sanitize_admin(admin_doc)
    return {
        "access_token": token,
        "token": token,
        "token_type": "bearer",
        "admin": sanitized,
    }


def change_admin_password(admin_id: str, old_password: str, new_password: str) -> bool:
    admin_doc = db.admin_manager.find_by_id(admin_id)
    if not admin_doc:
        raise HTTPException(status_code=404, detail="حساب ادمین یافت نشد.")

    if not verify_admin_password(old_password, admin_doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="رمز عبور فعلی نادرست است.")

    if len(new_password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز عبور جدید باید حداقل ۶ کاراکتر باشد.")

    hashed = hash_admin_password(new_password)
    db.admin_manager.update_admin(admin_id, password_hash=hashed)
    return True


def list_admins() -> list:
    return db.admin_manager.list_admins()


def create_admin(creator_id: str, data: dict) -> dict:
    username = data.get("username")
    password = data.get("password")
    full_name = data.get("full_name", "")
    role = data.get("role", "admin")
    permissions = data.get("permissions")

    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="رمز عبور باید حداقل ۶ کاراکتر باشد.")

    hashed = hash_admin_password(password)
    try:
        new_admin = db.admin_manager.create_admin(
            username=username,
            password_hash=hashed,
            full_name=full_name,
            role=role,
            permissions=permissions,
            created_by=creator_id,
        )
        return new_admin
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def update_admin(admin_id: str, data: dict) -> dict:
    password = data.get("password")
    pw_hash = hash_admin_password(password) if password else None

    updated = db.admin_manager.update_admin(
        admin_id=admin_id,
        full_name=data.get("full_name"),
        role=data.get("role"),
        permissions=data.get("permissions"),
        is_active=data.get("is_active"),
        password_hash=pw_hash,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="ادمین یافت نشد.")
    return updated


def delete_admin(admin_id: str, current_admin_id: str) -> bool:
    if str(admin_id) == str(current_admin_id):
        raise HTTPException(status_code=400, detail="نمی‌توانید حساب کاربری خودتان را حذف کنید.")
    success = db.admin_manager.delete_admin(admin_id)
    if not success:
        raise HTTPException(status_code=404, detail="ادمین یافت نشد.")
    return True


# -------------------------------------------------------------
# Dashboard & Analytics
# -------------------------------------------------------------

def get_dashboard_stats() -> dict:
    total_users = db.users.count_documents({})
    bot_users = db.users.count_documents({"_id": {"$regex": "^(bot_|test_bot)"}})
    real_users = max(0, total_users - bot_users)

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    users_today = db.users.count_documents({"join_date": {"$gte": today_start}})

    total_matches = db.game_play_history.count_documents({})
    live_matches = db.game_play_history.count_documents({"is_finished": False})
    finished_matches = db.game_play_history.count_documents({"is_finished": True})
    matches_today = db.game_play_history.count_documents({"start_date": {"$gte": today_start}})

    total_purchases = db.purchases.count_documents({})
    bazaar_purchases = db.purchases.count_documents({"market_type": {"$regex": "bazaar", "$options": "i"}})
    myket_purchases = db.purchases.count_documents({"market_type": {"$regex": "myket", "$options": "i"}})

    total_clans = db.clans.count_documents({})
    open_reports = db.social_reports.count_documents({"status": "open"})

    recent_games = list(db.game_play_history.find({}, {"game_types": 1}).sort([("start_date", -1)]).limit(200))
    game_type_counts = {}
    for g in recent_games:
        for gt in g.get("game_types", []):
            game_type_counts[gt] = game_type_counts.get(gt, 0) + 1

    config = db.config.find_one({}) or {}

    return {
        "users": {
            "total": total_users,
            "real": real_users,
            "bots": bot_users,
            "joined_today": users_today,
        },
        "matches": {
            "total": total_matches,
            "live": live_matches,
            "finished": finished_matches,
            "today": matches_today,
            "breakdown": game_type_counts,
        },
        "purchases": {
            "total": total_purchases,
            "bazaar": bazaar_purchases,
            "myket": myket_purchases,
        },
        "clans_count": total_clans,
        "open_reports_count": open_reports,
        "config": {
            "is_queue_open": bool(config.get("is_queue_open", True)),
            "latest_version": config.get("latest_version", "2.0.0"),
            "allowed_version": config.get("allowed_version", "2.0.0"),
            "maintenance_mode": bool(config.get("maintenance_mode", False)),
            "announcement": config.get("announcement", ""),
        },
        "server_time": datetime.now().isoformat(),
    }


# -------------------------------------------------------------
# User Management
# -------------------------------------------------------------

def list_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    filter_type: Optional[str] = "all",
    sort_by: str = "join_date",
    sort_order: int = -1,
) -> dict:
    query = {}

    if filter_type == "bot":
        query["_id"] = {"$regex": "^(bot_|test_bot)"}
    elif filter_type == "real":
        query["_id"] = {"$not": {"$regex": "^(bot_|test_bot)"}}
    elif filter_type == "banned":
        query["is_active"] = False

    if search:
        s = str(search).strip()
        search_sub = {
            "$or": [
                {"_id": {"$regex": s, "$options": "i"}},
                {"username": {"$regex": s, "$options": "i"}},
                {"phone": {"$regex": s, "$options": "i"}},
            ]
        }
        if query:
            query = {"$and": [query, search_sub]}
        else:
            query = search_sub

    valid_sort_fields = ["join_date", "score", "coin", "xp", "last_time_played", "username"]
    field = sort_by if sort_by in valid_sort_fields else "join_date"
    direction = -1 if sort_order == -1 else 1

    total = db.users.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.users.find(query).sort([(field, direction)]).skip(skip).limit(safe_limit)
    users = [_clean_doc(u) for u in cursor]

    return {
        "items": users,
        "total": total,
        "page": page,
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


def get_user_full_details(user_id: str) -> dict:
    uid = str(user_id)
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    history = db.user_history.find_one({"_id": uid}) or {}
    game_plays = list(db.game_play_history.find({
        "$or": [
            {"user_ids": uid},
            {"user1_id": uid},
            {"user2_id": uid},
        ]
    }).sort([("start_date", -1)]).limit(15))
    purchases = list(db.purchases.find({"user_id": uid}).sort([("date", -1)]).limit(20))

    clan_info = None
    if user.get("created_clan_id"):
        clan_info = db.clans.find_one({"_id": user["created_clan_id"]})
    else:
        mem = db.clan_members.find_one({"user_id": uid})
        if mem and mem.get("clan_id"):
            clan_info = db.clans.find_one({"_id": mem["clan_id"]})

    return {
        "user": _clean_doc(user),
        "history": _clean_doc(history),
        "recent_games": [_clean_doc(g) for g in game_plays],
        "purchases": [_clean_doc(p) for p in purchases],
        "clan": _clean_doc(clan_info),
    }


def update_user_profile(user_id: str, updates: dict) -> dict:
    uid = str(user_id)
    existing = db.users.find_one({"_id": uid})
    if not existing:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    upd = {}
    if "username" in updates and updates["username"] is not None:
        upd["username"] = str(updates["username"]).strip()
    if "phone" in updates and updates["phone"] is not None:
        upd["phone"] = str(updates["phone"]).strip()
    if "coin" in updates and updates["coin"] is not None:
        upd["coin"] = max(0, int(updates["coin"]))
    if "score" in updates and updates["score"] is not None:
        upd["score"] = max(0, int(updates["score"]))
    if "xp" in updates and updates["xp"] is not None:
        upd["xp"] = max(0, int(updates["xp"]))
    if "is_active" in updates and updates["is_active"] is not None:
        upd["is_active"] = bool(updates["is_active"])
    if "image" in updates and updates["image"] is not None:
        upd["image"] = int(updates["image"])

    if upd:
        db.users.find_one_and_update({"_id": uid}, {"$set": upd})

    return _clean_doc(db.users.find_one({"_id": uid}))


def adjust_user_currency(user_id: str, field: str, amount: int, reason: str = "", admin_id: str = "") -> dict:
    uid = str(user_id)
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    valid_fields = ["coin", "score", "xp"]
    if field not in valid_fields:
        raise HTTPException(status_code=400, detail="فیلد نامعتبر است.")

    current = int(user.get(field, 0))
    new_val = max(0, current + amount)
    db.users.find_one_and_update({"_id": uid}, {"$set": {field: new_val}})

    _log_admin_action(admin_id, "adjust_currency", {
        "user_id": uid,
        "field": field,
        "amount": amount,
        "previous": current,
        "new": new_val,
        "reason": reason,
    })

    return {
        "user_id": uid,
        "field": field,
        "previous_value": current,
        "new_value": new_val,
        "adjustment": amount,
    }


def toggle_user_ban(user_id: str, is_active: bool, reason: str = "", admin_id: str = "") -> dict:
    uid = str(user_id)
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    db.users.find_one_and_update({"_id": uid}, {"$set": {"is_active": bool(is_active)}})

    _log_admin_action(admin_id, "toggle_user_status", {
        "user_id": uid,
        "is_active": is_active,
        "reason": reason,
    })

    return {"user_id": uid, "is_active": is_active}


def reset_user_locks(user_id: str) -> dict:
    uid = str(user_id)
    db.users.find_one_and_update(
        {"_id": uid},
        {"$set": {"open_game_id": "", "open_pre_game_id": ""}}
    )
    return {"user_id": uid, "status": "locks_cleared"}


def delete_user_account(user_id: str, admin_id: str = "") -> bool:
    uid = str(user_id)
    db.users.delete_one({"_id": uid})
    _log_admin_action(admin_id, "delete_user", {"user_id": uid})
    return True


def bulk_adjust_coins(amount: int, filter_type: str = "all", reason: str = "", admin_id: str = "") -> dict:
    query = {}
    if filter_type == "real":
        query["_id"] = {"$not": {"$regex": "^(bot_|test_bot)"}}
    elif filter_type == "active":
        query["is_active"] = True

    res = db.users.update_many(query, {"$inc": {"coin": amount}})
    _log_admin_action(admin_id, "bulk_adjust_coins", {
        "amount": amount,
        "filter": filter_type,
        "matched_count": res.matched_count,
        "modified_count": res.modified_count,
        "reason": reason,
    })
    return {
        "modified_count": res.modified_count,
        "amount": amount,
    }


# -------------------------------------------------------------
# Games & Matches Management
# -------------------------------------------------------------

def list_live_games() -> list:
    cursor = db.game_play_history.find({"is_finished": False}).sort([("start_date", -1)]).limit(100)
    return [_clean_doc(g) for g in cursor]


def list_game_history(
    page: int = 1,
    limit: int = 20,
    game_type: Optional[str] = None,
    game_score_type: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    query = {"is_finished": True}

    if game_type:
        query["game_types"] = game_type
    if game_score_type:
        query["game_score_type"] = {"$regex": str(game_score_type).strip(), "$options": "i"}
    if user_id:
        uid = str(user_id)
        query["$or"] = [
            {"user_ids": uid},
            {"user1_id": uid},
            {"user2_id": uid},
        ]

    total = db.game_play_history.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.game_play_history.find(query).sort([("start_date", -1)]).skip(skip).limit(safe_limit)
    games = [_clean_doc(g) for g in cursor]

    return {
        "items": games,
        "total": total,
        "page": page,
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


def get_game_play_details(game_play_id: str) -> dict:
    gid = str(game_play_id)
    match = db.game_play_history.find_one({"_id": gid})
    if not match:
        raise HTTPException(status_code=404, detail="بازی یافت نشد.")

    rounds = list(db.game_history.find({"game_play_id": gid}).sort([("date", 1)]))
    return {
        "match": _clean_doc(match),
        "rounds": [_clean_doc(r) for r in rounds],
    }


def terminate_game_session(game_play_id: str, admin_id: str = "") -> dict:
    gid = str(game_play_id)
    match = db.game_play_history.find_one({"_id": gid})
    if not match:
        raise HTTPException(status_code=404, detail="شناسه بازی نامعتبر است.")

    db.game_play_history.find_one_and_update(
        {"_id": gid},
        {"$set": {"is_finished": True, "finish_date": datetime.now(), "terminated_by_admin": True}}
    )

    user_ids = match.get("user_ids", [])
    if not user_ids:
        for i in range(1, 5):
            k = f"user{i}_id"
            if match.get(k):
                user_ids.append(match[k])

    if user_ids:
        db.users.update_many(
            {"_id": {"$in": user_ids}, "open_game_id": gid},
            {"$set": {"open_game_id": ""}}
        )

    _log_admin_action(admin_id, "terminate_game", {"game_id": gid, "released_users": user_ids})
    return {"game_id": gid, "status": "terminated", "released_users": user_ids}


def cleanup_stuck_games(max_age_minutes: int = 120, admin_id: str = "") -> dict:
    cutoff = datetime.now() - timedelta(minutes=max_age_minutes)
    stuck_games = list(db.game_play_history.find({"is_finished": False, "start_date": {"$lt": cutoff}}))
    count = len(stuck_games)

    for g in stuck_games:
        gid = str(g["_id"])
        db.game_play_history.find_one_and_update(
            {"_id": gid},
            {"$set": {"is_finished": True, "finish_date": datetime.now(), "auto_cleaned": True}}
        )
        uids = g.get("user_ids", [])
        if uids:
            db.users.update_many(
                {"_id": {"$in": uids}, "open_game_id": gid},
                {"$set": {"open_game_id": ""}}
            )

    _log_admin_action(admin_id, "cleanup_stuck_games", {"cleaned_count": count, "cutoff_minutes": max_age_minutes})
    return {"cleaned_games_count": count}


# -------------------------------------------------------------
# System Config & Queue Control
# -------------------------------------------------------------

def get_system_config() -> dict:
    cfg = db.config.find_one({}) or {}
    return _clean_doc(cfg)


def set_queue_status(is_open: bool, hour: int = 0, minute: int = 0, admin_id: str = "") -> dict:
    db.config.find_one_and_update({}, {"$set": {"is_queue_open": bool(is_open)}})
    _log_admin_action(admin_id, "set_queue_status", {"is_open": is_open, "hour": hour, "minute": minute})
    return {"is_queue_open": is_open, "hour": hour, "minute": minute}


def set_app_versions(allowed_version: str, latest_version: str, admin_id: str = "") -> dict:
    db.config.find_one_and_update({}, {"$set": {
        "allowed_version": str(allowed_version).strip(),
        "latest_version": str(latest_version).strip(),
    }})
    _log_admin_action(admin_id, "set_app_versions", {"allowed": allowed_version, "latest": latest_version})
    return {"allowed_version": allowed_version, "latest_version": latest_version}


def set_announcement_banner(announcement: str, is_active: bool = True, admin_id: str = "") -> dict:
    db.config.find_one_and_update(
        {},
        {"$set": {"announcement": str(announcement or "").strip(), "announcement_active": bool(is_active)}}
    )
    _log_admin_action(admin_id, "set_announcement", {"announcement": announcement, "is_active": is_active})
    return {"announcement": announcement, "is_active": is_active}


# -------------------------------------------------------------
# Purchases & Store Management
# -------------------------------------------------------------

def list_purchases(
    page: int = 1,
    limit: int = 20,
    market_type: Optional[str] = None,
    product_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    query = {}
    if market_type:
        query["market_type"] = {"$regex": market_type, "$options": "i"}
    if product_id:
        query["product_id"] = str(product_id)
    if user_id:
        query["user_id"] = str(user_id)

    total = db.purchases.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.purchases.find(query).sort([("date", -1)]).skip(skip).limit(safe_limit)
    items = [_clean_doc(p) for p in cursor]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


# -------------------------------------------------------------
# Clans Management
# -------------------------------------------------------------

def list_clans(page: int = 1, limit: int = 20, search: Optional[str] = None) -> dict:
    query = {}
    if search:
        s = str(search).strip()
        query["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"tag": {"$regex": s, "$options": "i"}},
            {"_id": {"$regex": s, "$options": "i"}},
        ]

    total = db.clans.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.clans.find(query).sort([("clan_score", -1), ("clan_level", -1)]).skip(skip).limit(safe_limit)
    items = []
    for c in cursor:
        cleaned = _clean_doc(c)
        cleaned["level"] = c.get("clan_level") or c.get("level", 1)
        cleaned["trophies"] = c.get("clan_score") or c.get("trophies", 0)
        cleaned["owner_id"] = c.get("leader_id") or c.get("creator_id") or c.get("owner_id", "")
        items.append(cleaned)

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


def get_clan_full_details(clan_id: str) -> dict:
    cid = str(clan_id)
    clan = db.clans.find_one({"_id": cid})
    if not clan:
        raise HTTPException(status_code=404, detail="کلن یافت نشد.")

    members = list(db.clan_members.find({"clan_id": cid}))
    challenges = list(db.clan_challenges.find({"clan_id": cid}).sort([("created_at", -1)]).limit(20))

    cleaned_clan = _clean_doc(clan)
    cleaned_clan["level"] = clan.get("clan_level") or clan.get("level", 1)
    cleaned_clan["trophies"] = clan.get("clan_score") or clan.get("trophies", 0)
    cleaned_clan["owner_id"] = clan.get("leader_id") or clan.get("creator_id") or clan.get("owner_id", "")

    return {
        "clan": cleaned_clan,
        "members": [_clean_doc(m) for m in members],
        "challenges": [_clean_doc(c) for c in challenges],
    }


def update_clan_info(clan_id: str, updates: dict, admin_id: str = "") -> dict:
    cid = str(clan_id)
    clan = db.clans.find_one({"_id": cid})
    if not clan:
        raise HTTPException(status_code=404, detail="کلن یافت نشد.")

    upd = {}
    if "name" in updates and updates["name"]:
        upd["name"] = str(updates["name"]).strip()
    if "tag" in updates and updates["tag"]:
        upd["tag"] = str(updates["tag"]).strip()
    if "description" in updates:
        upd["description"] = str(updates["description"]).strip()
    if "level" in updates and updates["level"] is not None:
        upd["level"] = max(1, int(updates["level"]))
    if "trophies" in updates and updates["trophies"] is not None:
        upd["trophies"] = max(0, int(updates["trophies"]))

    if upd:
        db.clans.find_one_and_update({"_id": cid}, {"$set": upd})

    _log_admin_action(admin_id, "update_clan", {"clan_id": cid, "updates": upd})
    return _clean_doc(db.clans.find_one({"_id": cid}))


def disband_clan(clan_id: str, admin_id: str = "") -> bool:
    cid = str(clan_id)
    clan = db.clans.find_one({"_id": cid})
    if not clan:
        raise HTTPException(status_code=404, detail="کلن یافت نشد.")

    db.clan_members.delete_many({"clan_id": cid})
    db.clans.delete_one({"_id": cid})
    db.users.update_many(
        {"created_clan_id": cid},
        {"$set": {"created_clan_id": None}}
    )

    _log_admin_action(admin_id, "disband_clan", {"clan_id": cid, "clan_name": clan.get("name")})
    return True


# -------------------------------------------------------------
# Reports & Moderation
# -------------------------------------------------------------

def list_reports(page: int = 1, limit: int = 20, status_filter: Optional[str] = None) -> dict:
    query = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    total = db.social_reports.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.social_reports.find(query).sort([("created_at", -1)]).skip(skip).limit(safe_limit)
    items = [_clean_doc(r) for r in cursor]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


def update_report_status(report_id: str, new_status: str, admin_notes: str = "", admin_id: str = "") -> dict:
    rid = str(report_id)
    rep = db.social_reports.find_one({"_id": rid})
    if not rep:
        raise HTTPException(status_code=404, detail="گزارش یافت نشد.")

    upd = {
        "status": new_status,
        "admin_notes": str(admin_notes or ""),
        "resolved_at": datetime.now(),
        "resolved_by": admin_id,
    }
    db.social_reports.find_one_and_update({"_id": rid}, {"$set": upd})
    _log_admin_action(admin_id, "update_report", {"report_id": rid, "status": new_status, "notes": admin_notes})
    return _clean_doc(db.social_reports.find_one({"_id": rid}))


# -------------------------------------------------------------
# System Backups & Audit Logs
# -------------------------------------------------------------

def trigger_manual_backup(admin_id: str = "") -> dict:
    try:
        import bson
        backup_dir = os.getenv("BACKUP_DIR", "Backups/")
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = os.path.join(backup_dir, f"backup_{timestamp}")
        os.makedirs(target_path, exist_ok=True)

        collections = ["users", "user_history", "game_play_history", "game_history", "config", "purchases", "clans", "admins"]
        for coll_name in collections:
            with open(os.path.join(target_path, f"{coll_name}.bson"), "wb+") as f:
                for doc in db.db[coll_name].find():
                    f.write(bson.BSON.encode(doc))

        _log_admin_action(admin_id, "manual_backup", {"target": target_path})
        return {"status": "success", "message": f"پشتیبان‌گیری در {target_path} انجام شد."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در پشتیبان‌گیری: {str(e)}")


def list_system_backups() -> list:
    backup_dir = os.getenv("BACKUP_DIR", "Backups/")
    if not os.path.exists(backup_dir):
        return []

    files = []
    for item in os.listdir(backup_dir):
        full_path = os.path.join(backup_dir, item)
        stat = os.stat(full_path)
        size = stat.st_size
        files.append({
            "filename": item,
            "size_bytes": size,
            "size_formatted": f"{size / (1024*1024):.2f} MB" if size > 1024*1024 else f"{size / 1024:.2f} KB",
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return sorted(files, key=lambda x: x["modified"], reverse=True)


def list_audit_logs(limit: int = 50) -> list:
    cursor = db.audit_logs.find({}).sort([("timestamp", -1)]).limit(limit)
    return [_clean_doc(doc) for doc in cursor]


def _log_admin_action(admin_id: str, action: str, details: dict):
    try:
        db.audit_logs.insert_one({
            "_id": generate_log_id(),
            "admin_id": str(admin_id or "system"),
            "action": action,
            "details": details,
            "timestamp": datetime.now(),
        })
    except Exception as e:
        print(f"[AdminAudit] Error saving audit log: {e}")
