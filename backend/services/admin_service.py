import io
import os
import re
import secrets
import shutil
import string
import zipfile
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    TEHRAN_TZ = ZoneInfo("Asia/Tehran")
except Exception:
    TEHRAN_TZ = timezone(timedelta(hours=3, minutes=30), name="Asia/Tehran")
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException, status
from bson import ObjectId

from database import db
from security import (
    hash_admin_password,
    verify_admin_password,
    create_admin_access_token,
)

BOT_ID_REGEX = "^(bot_|test_bot)"


def now_tehran() -> datetime:
    """Returns the current datetime in the Asia/Tehran timezone (UTC+03:30)."""
    return datetime.now(TEHRAN_TZ)


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
                if v.tzinfo is None:
                    # Naive datetime stored in UTC MongoDB -> mark as UTC
                    cleaned[k] = v.replace(tzinfo=timezone.utc).isoformat()
                else:
                    cleaned[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                cleaned[k] = str(v)
            elif isinstance(v, (dict, list)):
                cleaned[k] = _clean_doc(v)
            else:
                cleaned[k] = v
        return cleaned
    return doc


def _escape_regex(value: Optional[str]) -> str:
    """Safely escapes user input before passing into MongoDB $regex queries."""
    return re.escape(str(value or "").strip())


def generate_log_id() -> str:
    alphabet = string.ascii_letters + string.digits
    return "log_" + "".join(secrets.choice(alphabet) for _ in range(8))


def generate_notice_id(prefix: str = "ntf_") -> str:
    alphabet = string.ascii_letters + string.digits
    return prefix + "".join(secrets.choice(alphabet) for _ in range(10))


def _resolve_usernames(user_ids: List[str]) -> Dict[str, str]:
    """Batch-resolves user IDs to display usernames to avoid N+1 DB lookups."""
    unique_ids = list({str(uid) for uid in user_ids if uid})
    if not unique_ids:
        return {}
    try:
        cursor = db.users.find({"_id": {"$in": unique_ids}}, {"username": 1})
        return {str(u["_id"]): str(u.get("username") or u["_id"]) for u in cursor}
    except Exception:
        return {}


def _resolve_admin_usernames(admin_ids: List[str]) -> Dict[str, str]:
    """Batch-resolves admin IDs to admin usernames."""
    unique_ids = list({str(aid) for aid in admin_ids if aid})
    mapping: Dict[str, str] = {
        "system": "system",
        "legacy_superadmin": "root",
    }
    lookup_ids = [aid for aid in unique_ids if aid not in mapping]
    if lookup_ids:
        try:
            cursor = db.admins_col.find({"_id": {"$in": lookup_ids}}, {"username": 1, "full_name": 1})
            for a in cursor:
                mapping[str(a["_id"])] = str(a.get("username") or a.get("full_name") or a["_id"])
        except Exception:
            pass
    return mapping


def _extract_match_user_ids(match: dict) -> List[str]:
    uids: List[str] = []
    if isinstance(match.get("user_ids"), list):
        uids.extend(str(u) for u in match["user_ids"] if u)
    for i in range(1, 5):
        k = f"user{i}_id"
        if match.get(k) and str(match[k]) not in uids:
            uids.append(str(match[k]))
    if match.get("winner_id") and str(match["winner_id"]) not in uids:
        uids.append(str(match["winner_id"]))
    return uids


def _format_bytes(size: int) -> str:
    if size >= 1024 * 1024 * 1024:
        return f"{size / (1024 * 1024 * 1024):.2f} GB"
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.2f} MB"
    return f"{size / 1024:.2f} KB"


def _get_path_size_and_files(path: str) -> Tuple[int, int]:
    """Recursively calculates real byte size and file count for a file or directory."""
    if os.path.isfile(path):
        try:
            return os.path.getsize(path), 1
        except OSError:
            return 0, 0
    total_size = 0
    file_count = 0
    for root, _, filenames in os.walk(path):
        for fname in filenames:
            fpath = os.path.join(root, fname)
            try:
                total_size += os.path.getsize(fpath)
                file_count += 1
            except OSError:
                pass
    return total_size, file_count


def _safe_backup_path(filename: str) -> str:
    """Validates a backup filename and returns its canonical path inside BACKUP_DIR."""
    clean = str(filename or "").strip()
    if not clean or "/" in clean or "\\" in clean or ".." in clean or clean in (".", ".."):
        raise HTTPException(status_code=400, detail="نام فایل پشتیبان نامعتبر است.")

    backup_dir = os.path.realpath(os.getenv("BACKUP_DIR", "Backups/"))
    target_path = os.path.realpath(os.path.join(backup_dir, clean))
    if not target_path.startswith(backup_dir + os.sep):
        raise HTTPException(status_code=400, detail="مسیر پشتیبان غیرمجاز است.")
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="فایل پشتیبان یافت نشد.")
    return target_path


def _upsert_config(fields: dict) -> dict:
    """Safely updates the singleton config document, creating it with _id=1 if missing."""
    existing = db.config.find_one({})
    if existing and "_id" in existing:
        db.config.update_one({"_id": existing["_id"]}, {"$set": fields})
        return _clean_doc(db.config.find_one({"_id": existing["_id"]}))
    db.config.update_one({"_id": 1}, {"$set": fields}, upsert=True)
    return _clean_doc(db.config.find_one({"_id": 1}))


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
    _log_admin_action(admin_id, "change_password", {"admin_id": admin_id})
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
        _log_admin_action(creator_id, "create_admin", {
            "target_admin_id": new_admin.get("_id"),
            "username": new_admin.get("username"),
            "role": new_admin.get("role"),
        })
        return new_admin
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def update_admin(admin_id: str, data: dict, actor_id: str = "") -> dict:
    password = data.get("password")
    if password is not None and len(str(password)) > 0 and len(str(password)) < 6:
        raise HTTPException(status_code=400, detail="رمز عبور جدید باید حداقل ۶ کاراکتر باشد.")
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
    safe_changes = {k: v for k, v in data.items() if k != "password"}
    if password:
        safe_changes["password_reset"] = True
    _log_admin_action(actor_id, "update_admin", {"target_admin_id": admin_id, "changes": safe_changes})
    return updated


def delete_admin(admin_id: str, current_admin_id: str) -> bool:
    if str(admin_id) == str(current_admin_id):
        raise HTTPException(status_code=400, detail="نمی‌توانید حساب کاربری خودتان را حذف کنید.")
    existing = db.admin_manager.find_by_id(admin_id)
    success = db.admin_manager.delete_admin(admin_id)
    if not success:
        raise HTTPException(status_code=404, detail="ادمین یافت نشد.")
    _log_admin_action(current_admin_id, "delete_admin", {
        "target_admin_id": admin_id,
        "username": existing.get("username") if existing else "",
    })
    return True


# -------------------------------------------------------------
# Dashboard & Analytics
# -------------------------------------------------------------

def _locked_users_query() -> dict:
    return {
        "$or": [
            {"open_game_id": {"$nin": ["", None]}},
            {"open_pre_game_id": {"$nin": ["", None]}},
        ]
    }


def get_dashboard_stats() -> dict:
    total_users = db.users.count_documents({})
    bot_users = db.users.count_documents({"_id": {"$regex": BOT_ID_REGEX}})
    real_users = max(0, total_users - bot_users)
    banned_users = db.users.count_documents({"is_active": False})
    locked_users = db.users.count_documents(_locked_users_query())

    now_t = now_tehran()
    today_start = now_t.replace(hour=0, minute=0, second=0, microsecond=0)
    # Convert today_start to UTC naive datetime for querying MongoDB
    today_start_utc = today_start.astimezone(timezone.utc).replace(tzinfo=None)
    users_today = db.users.count_documents({"join_date": {"$gte": today_start_utc}})

    total_matches = db.game_play_history.count_documents({})
    live_matches = db.game_play_history.count_documents({"is_finished": False})
    finished_matches = db.game_play_history.count_documents({"is_finished": True})
    matches_today = db.game_play_history.count_documents({"start_date": {"$gte": today_start_utc}})

    total_purchases = db.purchases.count_documents({})
    bazaar_purchases = db.purchases.count_documents({"market_type": {"$regex": "bazaar", "$options": "i"}})
    myket_purchases = db.purchases.count_documents({"market_type": {"$regex": "myket", "$options": "i"}})

    total_clans = db.clans.count_documents({})
    open_reports = db.social_reports.count_documents({"status": "open"})

    recent_games = list(db.game_play_history.find({}, {"game_types": 1}).sort([("start_date", -1)]).limit(200))
    game_type_counts: Dict[str, int] = {}
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
            "banned": banned_users,
            "locked": locked_users,
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
            "queue_open_hour": int(config.get("queue_open_hour", 0) or 0),
            "queue_open_minute": int(config.get("queue_open_minute", 0) or 0),
            "latest_version": config.get("latest_version", "2.0.0"),
            "allowed_version": config.get("allowed_version", "2.0.0"),
            "maintenance_mode": bool(config.get("maintenance_mode", False)),
            "maintenance_message": config.get("maintenance_message", ""),
            "announcement": config.get("announcement", ""),
            "announcement_active": bool(config.get("announcement_active", False)),
        },
        "server_time": now_t.isoformat(),
        "server_timezone": "Asia/Tehran",
        "timezone_offset": "+03:30",
    }


def _to_date_key(val: Any) -> Optional[str]:
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, str) and len(val) >= 10:
        return val[:10]
    return None


def get_analytics_overview(days: int = 14) -> dict:
    """Computes daily time-series activity, economy totals, top players, and mode/pack breakdowns."""
    clamped_days = max(7, min(int(days or 14), 30))
    now = datetime.now()
    start_day = (now - timedelta(days=clamped_days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Pre-seed contiguous daily buckets
    buckets: Dict[str, Dict[str, Any]] = {}
    ordered_keys: List[str] = []
    for i in range(clamped_days):
        d = start_day + timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        ordered_keys.append(key)
        buckets[key] = {"date": key, "users": 0, "matches": 0, "purchases": 0}

    # Users joined per day
    for u in db.users.find({"join_date": {"$gte": start_day}}, {"join_date": 1}):
        k = _to_date_key(u.get("join_date"))
        if k in buckets:
            buckets[k]["users"] += 1

    # Matches played per day
    for m in db.game_play_history.find({"start_date": {"$gte": start_day}}, {"start_date": 1}):
        k = _to_date_key(m.get("start_date"))
        if k in buckets:
            buckets[k]["matches"] += 1

    # Purchases per day
    for p in db.purchases.find({"date": {"$gte": start_day}}, {"date": 1}):
        k = _to_date_key(p.get("date"))
        if k in buckets:
            buckets[k]["purchases"] += 1

    daily_series = [buckets[k] for k in ordered_keys]

    # Economy stats for real users
    real_query = {"_id": {"$not": {"$regex": BOT_ID_REGEX}}}
    total_coins = 0
    real_count = 0
    try:
        agg = list(db.users.aggregate([
            {"$match": real_query},
            {"$group": {"_id": None, "total_coins": {"$sum": {"$ifNull": ["$coin", 0]}}, "count": {"$sum": 1}}},
        ]))
        if agg:
            total_coins = int(agg[0].get("total_coins") or 0)
            real_count = int(agg[0].get("count") or 0)
    except Exception:
        # Fallback if mocked collection doesn't implement aggregate
        for u in db.users.find(real_query, {"coin": 1}):
            total_coins += int(u.get("coin") or 0)
            real_count += 1

    banned_users = db.users.count_documents({"is_active": False})
    locked_users = db.users.count_documents(_locked_users_query())

    # Top real players by score and coin
    top_by_score = [
        _clean_doc(u)
        for u in db.users.find(
            real_query,
            {"username": 1, "score": 1, "coin": 1, "xp": 1, "is_active": 1},
        ).sort([("score", -1)]).limit(5)
    ]
    top_by_coin = [
        _clean_doc(u)
        for u in db.users.find(
            real_query,
            {"username": 1, "score": 1, "coin": 1, "xp": 1, "is_active": 1},
        ).sort([("coin", -1)]).limit(5)
    ]

    # Game mode breakdown (recent 500 matches)
    mode_counts: Dict[str, int] = {}
    for g in db.game_play_history.find({}, {"game_score_type": 1}).sort([("start_date", -1)]).limit(500):
        mode = str(g.get("game_score_type") or "Other")
        mode_counts[mode] = mode_counts.get(mode, 0) + 1

    # Coin pack breakdown
    product_counts: Dict[str, int] = {}
    for p in db.purchases.find({}, {"product_id": 1}).sort([("date", -1)]).limit(1000):
        pid = str(p.get("product_id") or "unknown")
        product_counts[pid] = product_counts.get(pid, 0) + 1

    return {
        "days": clamped_days,
        "daily_series": daily_series,
        "economy": {
            "total_coins": total_coins,
            "avg_coins_real": round(total_coins / real_count, 1) if real_count > 0 else 0,
            "real_users": real_count,
            "banned_users": banned_users,
            "locked_users": locked_users,
        },
        "top_by_score": top_by_score,
        "top_by_coin": top_by_coin,
        "mode_breakdown": mode_counts,
        "product_breakdown": product_counts,
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
    conditions: List[dict] = []

    if filter_type == "bot":
        conditions.append({"_id": {"$regex": BOT_ID_REGEX}})
    elif filter_type == "real":
        conditions.append({"_id": {"$not": {"$regex": BOT_ID_REGEX}}})
    elif filter_type == "banned":
        conditions.append({"is_active": False})
    elif filter_type == "locked":
        conditions.append(_locked_users_query())

    if search and str(search).strip():
        escaped = _escape_regex(search)
        conditions.append({
            "$or": [
                {"_id": {"$regex": escaped, "$options": "i"}},
                {"username": {"$regex": escaped, "$options": "i"}},
                {"phone": {"$regex": escaped, "$options": "i"}},
            ]
        })

    if len(conditions) == 0:
        query: dict = {}
    elif len(conditions) == 1:
        query = conditions[0]
    else:
        query = {"$and": conditions}

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


def update_user_profile(user_id: str, updates: dict, admin_id: str = "") -> dict:
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
        _log_admin_action(admin_id, "update_user", {"user_id": uid, "updates": upd})

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


def _kick_banned_user_from_realtime(user_id: str, reason: str = "") -> None:
    """Notifies the realtime backend (:5000) to immediately disconnect all active sockets of a banned user."""
    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://127.0.0.1:5000").rstrip("/")
    secret_key = os.getenv("SECRET_KEY", "09da5e74afaa9ma2565c818195b7b9563b93xc059f6f0f4cab6cf63b88e8d3e7")
    import json
    import threading
    import urllib.request

    def _post():
        try:
            url = f"{backend_url}/internal/auth/force-logout"
            payload = json.dumps({
                "user_id": str(user_id),
                "reason": "banned",
                "message": f"حساب کاربری شما مسدود شد: {reason}" if reason else "حساب کاربری شما توسط مدیریت مسدود شده است.",
            }).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Internal-Secret": secret_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                resp.read()
        except Exception as e:
            print(f"[kick_banned_user] Notice: {e}")

    threading.Thread(target=_post, daemon=True).start()


def _emit_realtime_social_notice(user_ids: List[str], title: str, body: str) -> None:
    """Pushes a realtime SocialNotification event to connected players via the backend bridge."""
    if not user_ids:
        return
    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://127.0.0.1:5000").rstrip("/")
    secret_key = os.getenv("SECRET_KEY", "09da5e74afaa9ma2565c818195b7b9563b93xc059f6f0f4cab6cf63b88e8d3e7")
    import json
    import threading
    import urllib.request

    def _post():
        try:
            # Emit to up to 200 individual user rooms
            events = [
                {
                    "room": uid,
                    "command_id": "SocialNotification",
                    "data": {
                        "type": "admin_notice",
                        "title": title,
                        "body": body,
                        "created_at": datetime.now().isoformat(),
                    },
                }
                for uid in user_ids[:200]
            ]
            url = f"{backend_url}/internal/social/emit"
            payload = json.dumps({"events": events}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Internal-Secret": secret_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                resp.read()
        except Exception as e:
            print(f"[emit_realtime_notice] Notice: {e}")

    threading.Thread(target=_post, daemon=True).start()


def toggle_user_ban(user_id: str, is_active: bool, reason: str = "", admin_id: str = "") -> dict:
    uid = str(user_id)
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    now = datetime.now()
    if not is_active:
        # Banning user: mark inactive and banned, clear any live game locks
        db.users.find_one_and_update(
            {"_id": uid},
            {
                "$set": {
                    "is_active": False,
                    "is_banned": True,
                    "ban_reason": str(reason or ""),
                    "banned_at": now,
                    "open_game_id": "",
                    "open_pre_game_id": "",
                }
            },
        )
        # Terminate live matches & force logout active sockets in realtime backend
        _kick_banned_user_from_realtime(uid, reason)
    else:
        # Unbanning user
        db.users.find_one_and_update(
            {"_id": uid},
            {
                "$set": {
                    "is_active": True,
                    "is_banned": False,
                },
                "$unset": {
                    "ban_reason": "",
                    "banned_at": "",
                },
            },
        )

    _log_admin_action(admin_id, "toggle_user_status", {
        "user_id": uid,
        "is_active": is_active,
        "is_banned": not is_active,
        "reason": reason,
    })

    return {"user_id": uid, "is_active": is_active, "is_banned": not is_active}


def reset_user_locks(user_id: str, admin_id: str = "") -> dict:
    uid = str(user_id)
    db.users.find_one_and_update(
        {"_id": uid},
        {"$set": {"open_game_id": "", "open_pre_game_id": ""}}
    )
    _log_admin_action(admin_id, "reset_user_locks", {"user_id": uid})
    return {"user_id": uid, "status": "locks_cleared"}


def bulk_reset_locks(user_ids: Optional[List[str]] = None, admin_id: str = "") -> dict:
    if user_ids:
        clean_ids = [str(uid) for uid in user_ids if uid]
        query = {"_id": {"$in": clean_ids}}
    else:
        query = _locked_users_query()

    res = db.users.update_many(query, {"$set": {"open_game_id": "", "open_pre_game_id": ""}})
    _log_admin_action(admin_id, "bulk_reset_locks", {
        "targeted_count": len(user_ids) if user_ids else "all_locked",
        "modified_count": res.modified_count,
    })
    return {"modified_count": res.modified_count, "matched_count": res.matched_count}


def delete_user_account(user_id: str, admin_id: str = "") -> bool:
    uid = str(user_id)
    db.users.delete_one({"_id": uid})
    _log_admin_action(admin_id, "delete_user", {"user_id": uid})
    return True


def bulk_adjust_coins(amount: int, filter_type: str = "all", reason: str = "", admin_id: str = "") -> dict:
    query = {}
    if filter_type == "real":
        query["_id"] = {"$not": {"$regex": BOT_ID_REGEX}}
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

def _attach_player_names(games: List[dict]) -> List[dict]:
    all_uids: List[str] = []
    for g in games:
        all_uids.extend(_extract_match_user_ids(g))
    name_map = _resolve_usernames(all_uids)

    enriched = []
    for g in games:
        doc = _clean_doc(g)
        uids = _extract_match_user_ids(g)
        doc["player_names"] = {uid: name_map.get(uid, uid) for uid in uids}
        enriched.append(doc)
    return enriched


def list_live_games() -> list:
    cursor = db.game_play_history.find({"is_finished": False}).sort([("start_date", -1)]).limit(100)
    return _attach_player_names(list(cursor))


def list_game_history(
    page: int = 1,
    limit: int = 20,
    game_type: Optional[str] = None,
    game_score_type: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    query: dict = {"is_finished": True}

    if game_type:
        query["game_types"] = game_type
    if game_score_type and str(game_score_type).strip():
        query["game_score_type"] = {"$regex": _escape_regex(game_score_type), "$options": "i"}
    if user_id and str(user_id).strip():
        uid = str(user_id).strip()
        query["$or"] = [
            {"user_ids": uid},
            {"user1_id": uid},
            {"user2_id": uid},
        ]

    total = db.game_play_history.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.game_play_history.find(query).sort([("start_date", -1)]).skip(skip).limit(safe_limit)
    games = _attach_player_names(list(cursor))

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
    enriched_match = _attach_player_names([match])[0]
    return {
        "match": enriched_match,
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

    user_ids = _extract_match_user_ids(match)
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
        uids = _extract_match_user_ids(g)
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
    cleaned = _clean_doc(cfg)
    cleaned.setdefault("is_queue_open", True)
    cleaned.setdefault("queue_open_hour", 0)
    cleaned.setdefault("queue_open_minute", 0)
    cleaned.setdefault("latest_version", "2.0.0")
    cleaned.setdefault("allowed_version", "2.0.0")
    cleaned.setdefault("maintenance_mode", False)
    cleaned.setdefault("maintenance_message", "")
    cleaned.setdefault("announcement", "")
    cleaned.setdefault("announcement_active", False)
    return cleaned


def set_queue_status(is_open: bool, hour: int = 0, minute: int = 0, admin_id: str = "") -> dict:
    safe_hour = max(0, min(23, int(hour or 0)))
    safe_minute = max(0, min(59, int(minute or 0)))
    _upsert_config({
        "is_queue_open": bool(is_open),
        "queue_open_hour": safe_hour,
        "queue_open_minute": safe_minute,
    })
    _log_admin_action(admin_id, "set_queue_status", {"is_open": bool(is_open), "hour": safe_hour, "minute": safe_minute})
    return {"is_queue_open": bool(is_open), "hour": safe_hour, "minute": safe_minute}


def set_app_versions(allowed_version: str, latest_version: str, admin_id: str = "") -> dict:
    clean_allowed = str(allowed_version).strip()
    clean_latest = str(latest_version).strip()
    _upsert_config({
        "allowed_version": clean_allowed,
        "latest_version": clean_latest,
    })
    _log_admin_action(admin_id, "set_app_versions", {"allowed": clean_allowed, "latest": clean_latest})
    return {"allowed_version": clean_allowed, "latest_version": clean_latest}


def set_announcement_banner(announcement: str, is_active: bool = True, admin_id: str = "") -> dict:
    clean_msg = str(announcement or "").strip()
    _upsert_config({
        "announcement": clean_msg,
        "announcement_active": bool(is_active),
    })
    _log_admin_action(admin_id, "set_announcement", {"announcement": clean_msg, "is_active": bool(is_active)})
    return {"announcement": clean_msg, "is_active": bool(is_active)}


def set_maintenance_mode(maintenance_mode: bool, maintenance_message: str = "", admin_id: str = "") -> dict:
    clean_msg = str(maintenance_message or "").strip()
    _upsert_config({
        "maintenance_mode": bool(maintenance_mode),
        "maintenance_message": clean_msg,
    })
    _log_admin_action(admin_id, "set_maintenance_mode", {
        "maintenance_mode": bool(maintenance_mode),
        "maintenance_message": clean_msg,
    })
    return {"maintenance_mode": bool(maintenance_mode), "maintenance_message": clean_msg}


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
    query: dict = {}
    if market_type and str(market_type).strip():
        query["market_type"] = {"$regex": _escape_regex(market_type), "$options": "i"}
    if product_id and str(product_id).strip():
        query["product_id"] = str(product_id).strip()
    if user_id and str(user_id).strip():
        query["user_id"] = str(user_id).strip()

    total = db.purchases.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.purchases.find(query).sort([("date", -1)]).skip(skip).limit(safe_limit)
    raw_items = list(cursor)
    name_map = _resolve_usernames([str(p.get("user_id") or "") for p in raw_items])
    items = []
    for p in raw_items:
        doc = _clean_doc(p)
        uid = str(p.get("user_id") or "")
        doc["username"] = name_map.get(uid, uid)
        items.append(doc)

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
    query: dict = {}
    if search and str(search).strip():
        escaped = _escape_regex(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"tag": {"$regex": escaped, "$options": "i"}},
            {"_id": {"$regex": escaped, "$options": "i"}},
        ]

    total = db.clans.count_documents(query)
    safe_limit = max(1, min(limit, 100))
    skip = max(0, (page - 1) * safe_limit)

    cursor = db.clans.find(query).sort([("clan_score", -1), ("clan_level", -1)]).skip(skip).limit(safe_limit)
    raw_clans = list(cursor)
    owner_ids = [str(c.get("leader_id") or c.get("creator_id") or c.get("owner_id") or "") for c in raw_clans]
    owner_names = _resolve_usernames(owner_ids)

    items = []
    for c in raw_clans:
        cleaned = _clean_doc(c)
        owner_id = str(c.get("leader_id") or c.get("creator_id") or c.get("owner_id") or "")
        cleaned["level"] = c.get("clan_level") if c.get("clan_level") is not None else c.get("level", 1)
        cleaned["trophies"] = c.get("clan_score") if c.get("clan_score") is not None else c.get("trophies", 0)
        cleaned["owner_id"] = owner_id
        cleaned["owner_name"] = owner_names.get(owner_id, c.get("owner_name") or owner_id)
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

    owner_id = str(clan.get("leader_id") or clan.get("creator_id") or clan.get("owner_id") or "")
    member_uids = [str(m.get("user_id") or "") for m in members]
    if owner_id:
        member_uids.append(owner_id)
    name_map = _resolve_usernames(member_uids)

    cleaned_clan = _clean_doc(clan)
    cleaned_clan["level"] = clan.get("clan_level") if clan.get("clan_level") is not None else clan.get("level", 1)
    cleaned_clan["trophies"] = clan.get("clan_score") if clan.get("clan_score") is not None else clan.get("trophies", 0)
    cleaned_clan["owner_id"] = owner_id
    cleaned_clan["owner_name"] = name_map.get(owner_id, clan.get("owner_name") or owner_id)

    cleaned_members = []
    for m in members:
        cm = _clean_doc(m)
        uid = str(m.get("user_id") or "")
        cm["username"] = m.get("username") or name_map.get(uid, uid)
        cleaned_members.append(cm)

    return {
        "clan": cleaned_clan,
        "members": cleaned_members,
        "challenges": [_clean_doc(c) for c in challenges],
    }


def update_clan_info(clan_id: str, updates: dict, admin_id: str = "") -> dict:
    cid = str(clan_id)
    clan = db.clans.find_one({"_id": cid})
    if not clan:
        raise HTTPException(status_code=404, detail="کلن یافت نشد.")

    upd = {}
    if "name" in updates and updates["name"] is not None and str(updates["name"]).strip():
        upd["name"] = str(updates["name"]).strip()
    if "tag" in updates and updates["tag"] is not None and str(updates["tag"]).strip():
        upd["tag"] = str(updates["tag"]).strip()
    if "description" in updates and updates["description"] is not None:
        upd["description"] = str(updates["description"]).strip()
    if "level" in updates and updates["level"] is not None:
        lvl = max(1, int(updates["level"]))
        upd["level"] = lvl
        upd["clan_level"] = lvl
    if "trophies" in updates and updates["trophies"] is not None:
        tr = max(0, int(updates["trophies"]))
        upd["trophies"] = tr
        upd["clan_score"] = tr

    if upd:
        db.clans.find_one_and_update({"_id": cid}, {"$set": upd})

    _log_admin_action(admin_id, "update_clan", {"clan_id": cid, "updates": upd})
    updated = db.clans.find_one({"_id": cid})
    cleaned = _clean_doc(updated)
    if updated:
        cleaned["level"] = updated.get("clan_level") if updated.get("clan_level") is not None else updated.get("level", 1)
        cleaned["trophies"] = updated.get("clan_score") if updated.get("clan_score") is not None else updated.get("trophies", 0)
    return cleaned


def remove_clan_member(clan_id: str, user_id: str, admin_id: str = "") -> dict:
    cid = str(clan_id)
    uid = str(user_id)
    clan = db.clans.find_one({"_id": cid})
    if not clan:
        raise HTTPException(status_code=404, detail="کلن یافت نشد.")

    res = db.clan_members.delete_many({"clan_id": cid, "user_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="عضو مورد نظر در این کلن یافت نشد.")

    remaining = db.clan_members.count_documents({"clan_id": cid})
    db.clans.update_one({"_id": cid}, {"$set": {"member_count": remaining}})
    _log_admin_action(admin_id, "remove_clan_member", {
        "clan_id": cid,
        "clan_name": clan.get("name"),
        "user_id": uid,
        "remaining_members": remaining,
    })
    return {"status": "removed", "clan_id": cid, "user_id": uid, "member_count": remaining}


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
    raw_items = list(cursor)

    user_ids: List[str] = []
    for r in raw_items:
        if r.get("reporter_id"):
            user_ids.append(str(r["reporter_id"]))
        if r.get("target_user_id"):
            user_ids.append(str(r["target_user_id"]))
    name_map = _resolve_usernames(user_ids)

    items = []
    for r in raw_items:
        doc = _clean_doc(r)
        rep_id = str(r.get("reporter_id") or "")
        tgt_id = str(r.get("target_user_id") or "")
        doc["reporter_username"] = name_map.get(rep_id, rep_id)
        doc["target_username"] = name_map.get(tgt_id, tgt_id)
        items.append(doc)

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
# Admin Notifications & Broadcasts
# -------------------------------------------------------------

def send_admin_notification(
    target_type: str,
    title: str,
    message: str,
    user_id: Optional[str] = None,
    clan_id: Optional[str] = None,
    admin_id: str = "",
) -> dict:
    clean_title = str(title or "").strip()
    clean_message = str(message or "").strip()
    if not clean_title or not clean_message:
        raise HTTPException(status_code=400, detail="عنوان و متن اعلان الزامی است.")

    target_user_ids: List[str] = []
    target_label = target_type

    if target_type == "user":
        if not user_id or not str(user_id).strip():
            raise HTTPException(status_code=400, detail="شناسه کاربر مقصد الزامی است.")
        uid = str(user_id).strip()
        user_doc = db.users.find_one({"_id": uid}, {"username": 1})
        if not user_doc:
            raise HTTPException(status_code=404, detail="کاربر مقصد یافت نشد.")
        target_user_ids = [uid]
        target_label = f"{user_doc.get('username') or uid} ({uid})"
    elif target_type == "clan":
        if not clan_id or not str(clan_id).strip():
            raise HTTPException(status_code=400, detail="شناسه کلن مقصد الزامی است.")
        cid = str(clan_id).strip()
        clan_doc = db.clans.find_one({"_id": cid}, {"name": 1})
        if not clan_doc:
            raise HTTPException(status_code=404, detail="کلن مقصد یافت نشد.")
        members = list(db.clan_members.find({"clan_id": cid}, {"user_id": 1}))
        target_user_ids = list({str(m["user_id"]) for m in members if m.get("user_id")})
        target_label = f"{clan_doc.get('name') or cid} ({len(target_user_ids)})"
    elif target_type == "all":
        cursor = db.users.find(
            {"_id": {"$not": {"$regex": BOT_ID_REGEX}}, "is_active": {"$ne": False}},
            {"_id": 1},
        )
        target_user_ids = [str(u["_id"]) for u in cursor]
        target_label = "all_active_players"
    else:
        raise HTTPException(status_code=400, detail="نوع هدف نامعتبر است (user / clan / all).")

    now = datetime.now()
    broadcast_id = generate_notice_id("brc_")

    if target_user_ids:
        docs = [
            {
                "_id": generate_notice_id("ntf_"),
                "broadcast_id": broadcast_id,
                "user_id": uid,
                "type": "admin_notice",
                "category": "system",
                "title": clean_title,
                "body": clean_message,
                "message": clean_message,
                "actor_id": "admin",
                "actor_name": "مدیریت کافه فکر",
                "actor_image": 0,
                "payload": {
                    "broadcast_id": broadcast_id,
                    "target_type": target_type,
                    "admin_id": str(admin_id or "system"),
                },
                "is_read": False,
                "status": "unread",
                "created_at": now,
                "sent_by": str(admin_id or "system"),
            }
            for uid in target_user_ids
        ]
        # Insert in batches of 500 to keep MongoDB write payloads safe
        batch_size = 500
        for i in range(0, len(docs), batch_size):
            db.social_notifications.insert_many(docs[i : i + batch_size])
            db.notifications.insert_many(docs[i : i + batch_size])

        # Push realtime notification via WebSocket bridge if users are online in-game
        _emit_realtime_social_notice(target_user_ids, clean_title, clean_message)

    broadcast_doc = {
        "_id": broadcast_id,
        "target_type": target_type,
        "target_label": target_label,
        "user_id": str(user_id).strip() if user_id else None,
        "clan_id": str(clan_id).strip() if clan_id else None,
        "title": clean_title,
        "message": clean_message,
        "sent_count": len(target_user_ids),
        "admin_id": str(admin_id or "system"),
        "created_at": now,
    }
    db.admin_broadcasts.insert_one(broadcast_doc)

    _log_admin_action(admin_id, "send_notification", {
        "broadcast_id": broadcast_id,
        "target_type": target_type,
        "target_label": target_label,
        "sent_count": len(target_user_ids),
        "title": clean_title,
    })

    return _clean_doc(broadcast_doc)


def list_admin_notifications(limit: int = 30) -> list:
    safe_limit = max(1, min(int(limit or 30), 100))
    rows = list(db.admin_broadcasts.find({}).sort([("created_at", -1)]).limit(safe_limit))
    admin_map = _resolve_admin_usernames([str(r.get("admin_id") or "") for r in rows])
    items = []
    for r in rows:
        doc = _clean_doc(r)
        aid = str(r.get("admin_id") or "system")
        doc["admin_username"] = admin_map.get(aid, aid)
        items.append(doc)
    return items


# -------------------------------------------------------------
# System Backups & Audit Logs
# -------------------------------------------------------------

def trigger_manual_backup(admin_id: str = "") -> dict:
    try:
        import bson
        backup_dir = os.getenv("BACKUP_DIR", "Backups/")
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_name = f"backup_{timestamp}"
        target_path = os.path.join(backup_dir, target_name)
        os.makedirs(target_path, exist_ok=True)

        collections = [
            "users",
            "user_history",
            "game_play_history",
            "game_history",
            "config",
            "purchases",
            "clans",
            "clan_members",
            "social_reports",
            "admins",
        ]
        for coll_name in collections:
            with open(os.path.join(target_path, f"{coll_name}.bson"), "wb+") as f:
                for doc in db.db[coll_name].find():
                    f.write(bson.BSON.encode(doc))

        size_bytes, file_count = _get_path_size_and_files(target_path)
        _log_admin_action(admin_id, "manual_backup", {
            "target": target_name,
            "size_bytes": size_bytes,
            "file_count": file_count,
        })
        return {
            "status": "success",
            "filename": target_name,
            "size_formatted": _format_bytes(size_bytes),
            "message": f"پشتیبان‌گیری در {target_name} ({_format_bytes(size_bytes)}) انجام شد.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در پشتیبان‌گیری: {str(e)}")


def list_system_backups() -> list:
    backup_dir = os.getenv("BACKUP_DIR", "Backups/")
    if not os.path.exists(backup_dir):
        return []

    files = []
    for item in os.listdir(backup_dir):
        full_path = os.path.join(backup_dir, item)
        try:
            stat = os.stat(full_path)
            size, file_count = _get_path_size_and_files(full_path)
            files.append({
                "filename": item,
                "size_bytes": size,
                "size_formatted": _format_bytes(size),
                "file_count": file_count,
                "is_dir": os.path.isdir(full_path),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
        except OSError:
            continue
    return sorted(files, key=lambda x: x["modified"], reverse=True)


def create_backup_zip_bytes(filename: str) -> Tuple[bytes, str]:
    target_path = _safe_backup_path(filename)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if os.path.isfile(target_path):
            zf.write(target_path, arcname=os.path.basename(target_path))
        else:
            base_name = os.path.basename(target_path)
            for root, _, filenames in os.walk(target_path):
                for fname in filenames:
                    full = os.path.join(root, fname)
                    rel = os.path.relpath(full, target_path)
                    zf.write(full, arcname=os.path.join(base_name, rel))
    buf.seek(0)
    download_name = filename if filename.endswith(".zip") else f"{filename}.zip"
    return buf.getvalue(), download_name


def delete_system_backup(filename: str, admin_id: str = "") -> dict:
    target_path = _safe_backup_path(filename)
    try:
        if os.path.isdir(target_path):
            shutil.rmtree(target_path)
        else:
            os.remove(target_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"خطا در حذف فایل پشتیبان: {str(e)}")

    _log_admin_action(admin_id, "delete_backup", {"filename": filename})
    return {"status": "deleted", "filename": filename}


def list_audit_logs(
    limit: int = 50,
    action: Optional[str] = None,
    search: Optional[str] = None,
) -> list:
    safe_limit = max(1, min(int(limit or 50), 200))
    query: dict = {}
    if action and str(action).strip() and action != "all":
        query["action"] = str(action).strip()

    # Fetch slightly more if searching inside nested details dict
    fetch_limit = safe_limit * 3 if (search and str(search).strip()) else safe_limit
    cursor = db.audit_logs.find(query).sort([("timestamp", -1)]).limit(fetch_limit)
    rows = list(cursor)

    admin_map = _resolve_admin_usernames([str(r.get("admin_id") or "") for r in rows])

    needle = str(search or "").strip().lower()
    results = []
    for doc in rows:
        cleaned = _clean_doc(doc)
        aid = str(doc.get("admin_id") or "system")
        cleaned["admin_username"] = admin_map.get(aid, aid)
        if needle:
            haystack = f"{aid} {cleaned['admin_username']} {cleaned.get('action', '')} {cleaned.get('details', '')}".lower()
            if needle not in haystack:
                continue
        results.append(cleaned)
        if len(results) >= safe_limit:
            break
    return results


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
