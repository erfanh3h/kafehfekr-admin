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


def _internal_http_json(
    base_url: str,
    path: str,
    method: str = "GET",
    payload: Optional[dict] = None,
    timeout: float = 2.0,
) -> Tuple[bool, dict]:
    """Performs an authenticated internal JSON request to backend (:5000) or server (:5001)."""
    import json
    import urllib.request

    secret_key = os.getenv("SECRET_KEY", "09da5e74afaa9ma2565c818195b7b9563b93xc059f6f0f4cab6cf63b88e8d3e7")
    url = f"{base_url.rstrip('/')}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "X-Internal-Secret": secret_key,
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return True, (json.loads(raw) if raw.strip() else {})
    except Exception as exc:
        return False, {"error": str(exc)}


_DETECTED_SERVICE_URLS: Dict[str, Optional[str]] = {
    "backend": None,
    "server": None,
}


def _get_candidate_service_urls(service: str) -> List[str]:
    """Returns an ordered list of candidate URLs to reach internal backend or server."""
    urls: List[str] = []

    # 1. Last successfully detected working URL
    cached = _DETECTED_SERVICE_URLS.get(service)
    if cached:
        urls.append(cached)

    # 2. Configured environment variable
    env_key = "BACKEND_INTERNAL_URL" if service == "backend" else "SERVER_INTERNAL_URL"
    configured = os.getenv(env_key)
    if configured and configured.strip():
        c_clean = configured.strip().rstrip("/")
        if c_clean not in urls:
            urls.append(c_clean)

    # 3. Docker service & container names, Docker gateway, and local fallbacks
    if service == "backend":
        defaults = [
            "http://backend:5000",
            "http://kafehfekr_backend:5000",
            "http://kafehfekrbackend:5000",
            "http://host.docker.internal:5000",
            "http://172.17.0.1:5000",
            "http://127.0.0.1:5000",
            "http://localhost:5000",
        ]
    else:
        defaults = [
            "http://server:5001",
            "http://kafehfekr_server:5001",
            "http://kafehfekrserver:5001",
            "http://host.docker.internal:5001",
            "http://172.17.0.1:5001",
            "http://127.0.0.1:5001",
            "http://localhost:5001",
        ]

    for d in defaults:
        if d not in urls:
            urls.append(d)

    return urls


def _call_internal_service(
    service: str,
    path: str,
    method: str = "GET",
    payload: Optional[dict] = None,
    timeout: float = 2.0,
) -> Tuple[bool, dict, str]:
    """Calls an internal service with automatic Docker/host candidate URL discovery."""
    candidates = _get_candidate_service_urls(service)
    last_err: dict = {"error": "No candidate URLs reachable"}
    last_url: str = candidates[0] if candidates else ""

    for idx, candidate in enumerate(candidates):
        last_url = candidate
        t_out = timeout if idx == 0 else min(timeout, 0.75)
        ok, data = _internal_http_json(candidate, path, method=method, payload=payload, timeout=t_out)
        if ok:
            _DETECTED_SERVICE_URLS[service] = candidate
            return True, data, candidate

        last_err = data
        err_str = str(data.get("error", "")).lower()
        # If the target responded with an HTTP status error (e.g. 401/403/404/500),
        # the host is reachable and alive.
        if "http error" in err_str or "status code: 4" in err_str or "status code: 5" in err_str:
            _DETECTED_SERVICE_URLS[service] = candidate
            return False, data, candidate

    return False, last_err, last_url


def _kick_banned_user_from_realtime(user_id: str, reason: str = "") -> None:
    """Notifies the realtime backend (:5000) to immediately disconnect all active sockets of a banned user."""
    import threading

    def _post():
        ok, res, _ = _call_internal_service(
            "backend",
            "/internal/auth/force-logout",
            method="POST",
            payload={
                "user_id": str(user_id),
                "reason": "banned",
                "message": f"حساب کاربری شما مسدود شد: {reason}" if reason else "حساب کاربری شما توسط مدیریت مسدود شده است.",
            },
            timeout=1.5,
        )
        if not ok:
            print(f"[kick_banned_user] Notice: {res.get('error')}")

    threading.Thread(target=_post, daemon=True).start()


def force_logout_user(user_id: str, reason: str = "", admin_id: str = "") -> dict:
    """Immediately disconnects all active Socket.IO connections of a player without banning them."""
    uid = str(user_id)
    user = db.users.find_one({"_id": uid}, {"username": 1})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    clean_reason = str(reason or "").strip()
    msg = (
        f"شما توسط مدیریت از نشست فعلی خارج شدید: {clean_reason}"
        if clean_reason
        else "شما توسط مدیریت از نشست فعلی خارج شدید. لطفاً مجدداً وارد شوید."
    )
    ok, res, _ = _call_internal_service(
        "backend",
        "/internal/auth/force-logout",
        method="POST",
        payload={
            "user_id": uid,
            "reason": "admin_kick",
            "message": msg,
        },
        timeout=2.5,
    )
    kicked = int(res.get("kicked", 0) or 0) if ok else 0
    _log_admin_action(admin_id, "force_logout_user", {
        "user_id": uid,
        "username": user.get("username"),
        "reason": clean_reason,
        "reachable": ok,
        "kicked": kicked,
    })
    return {
        "ok": True,
        "user_id": uid,
        "reachable": ok,
        "kicked": kicked,
        "error": None if ok else res.get("error"),
    }


def _emit_realtime_social_notice(user_ids: List[str], title: str, body: str) -> None:
    """Pushes a realtime SocialNotification event to connected players via the backend bridge."""
    if not user_ids:
        return
    import threading

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
            _call_internal_service(
                "backend",
                "/internal/social/emit",
                method="POST",
                payload={"events": events},
                timeout=2.0,
            )
        except Exception as e:
            print(f"[emit_realtime_notice] Notice: {e}")

    threading.Thread(target=_post, daemon=True).start()


def toggle_user_ban(
    user_id: str,
    is_active: bool,
    reason: str = "",
    duration_hours: Optional[int] = None,
    admin_id: str = "",
) -> dict:
    uid = str(user_id)
    user = db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")

    now_utc = datetime.now(timezone.utc)
    ban_until = None
    if not is_active:
        set_doc: dict = {
            "is_active": False,
            "is_banned": True,
            "ban_reason": str(reason or ""),
            "banned_at": now_utc,
            "open_game_id": "",
            "open_pre_game_id": "",
        }
        unset_doc: dict = {}
        if duration_hours is not None and int(duration_hours) > 0:
            hrs = int(duration_hours)
            ban_until = now_utc + timedelta(hours=hrs)
            set_doc["ban_until"] = ban_until
            set_doc["ban_duration_hours"] = hrs
        else:
            unset_doc["ban_until"] = ""
            unset_doc["ban_duration_hours"] = ""

        update_op: dict = {"$set": set_doc}
        if unset_doc:
            update_op["$unset"] = unset_doc
        db.users.find_one_and_update({"_id": uid}, update_op)
        # Terminate live matches & force logout active sockets in realtime backend
        _kick_banned_user_from_realtime(uid, reason)
    else:
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
                    "ban_until": "",
                    "ban_duration_hours": "",
                },
            },
        )

    _log_admin_action(admin_id, "toggle_user_status", {
        "user_id": uid,
        "is_active": is_active,
        "is_banned": not is_active,
        "duration_hours": int(duration_hours) if (not is_active and duration_hours and int(duration_hours) > 0) else None,
        "ban_until": ban_until.isoformat() if ban_until else None,
        "reason": reason,
    })

    return {
        "user_id": uid,
        "is_active": is_active,
        "is_banned": not is_active,
        "ban_until": ban_until.isoformat() if ban_until else None,
    }


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

    # Also force-terminate the live match inside kafehfekrbackend RAM
    rt_ok, rt_res, _ = _call_internal_service(
        "backend",
        f"/internal/admin/games/{gid}/force-terminate",
        method="POST",
        payload={},
        timeout=2.0,
    )

    _log_admin_action(admin_id, "terminate_game", {
        "game_id": gid,
        "released_users": user_ids,
        "realtime_reachable": rt_ok,
        "existed_in_ram": rt_res.get("existed_in_ram") if rt_ok else None,
        "disconnected_sockets": rt_res.get("disconnected_sockets") if rt_ok else 0,
    })
    return {
        "game_id": gid,
        "status": "terminated",
        "released_users": user_ids,
        "realtime_terminated": bool(rt_ok),
        "disconnected_sockets": int(rt_res.get("disconnected_sockets", 0) or 0) if rt_ok else 0,
    }


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
    cleaned.setdefault("windows_link", "")
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


def set_windows_link(windows_link: str, admin_id: str = "") -> dict:
    clean_link = str(windows_link or "").strip()
    _upsert_config({
        "windows_link": clean_link,
    })
    _log_admin_action(admin_id, "set_windows_link", {"windows_link": clean_link})
    return {"windows_link": clean_link}


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
            "questions",
            "promo_codes",
            "promo_redemptions",
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


# -------------------------------------------------------------
# Realtime Services & Runtime Telemetry
# -------------------------------------------------------------

def get_realtime_runtime_status() -> dict:
    """Aggregates live RAM telemetry from kafehfekrbackend (:5000), kafehfekrserver (:5001), and MongoDB."""
    import time

    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://127.0.0.1:5000").rstrip("/")
    server_url = os.getenv("SERVER_INTERNAL_URL", "http://127.0.0.1:5001").rstrip("/")

    t_b0 = time.perf_counter()
    b_ok, b_data, b_resolved_url = _call_internal_service(
        "backend",
        "/internal/admin/runtime-status",
        method="GET",
        timeout=2.0,
    )
    b_latency_ms = round((time.perf_counter() - t_b0) * 1000, 1)

    t_s0 = time.perf_counter()
    s_ok, s_data, s_resolved_url = _call_internal_service(
        "server",
        "/internal/admin/health-stats",
        method="GET",
        timeout=2.0,
    )
    s_latency_ms = round((time.perf_counter() - t_s0) * 1000, 1)

    mongo_ok = False
    mongo_ping_ms = None
    try:
        t_m0 = time.perf_counter()
        db.client.admin.command("ping")
        mongo_ping_ms = round((time.perf_counter() - t_m0) * 1000, 1)
        mongo_ok = True
    except Exception:
        mongo_ok = False

    return {
        "checked_at": now_tehran().isoformat(),
        "mongodb": {
            "online": mongo_ok,
            "ping_ms": mongo_ping_ms,
        },
        "backend": {
            "online": b_ok,
            "url": b_resolved_url,
            "latency_ms": b_latency_ms if b_ok else None,
            "uptime_seconds": b_data.get("uptime_seconds", 0) if b_ok else 0,
            "online_social_users": b_data.get("online_social_users", 0) if b_ok else 0,
            "social_sockets": b_data.get("social_sockets", 0) if b_ok else 0,
            "active_game_sockets": b_data.get("active_game_sockets", 0) if b_ok else 0,
            "active_ram_games_count": b_data.get("active_ram_games_count", 0) if b_ok else 0,
            "active_ram_games": b_data.get("active_ram_games", []) if b_ok else [],
            "ranked_queue_count": b_data.get("ranked_queue_count", 0) if b_ok else 0,
            "active_pre_games_count": b_data.get("active_pre_games_count", 0) if b_ok else 0,
            "multi_queue_count": b_data.get("multi_queue_count", 0) if b_ok else 0,
            "multi_queue_breakdown": b_data.get("multi_queue_breakdown", {}) if b_ok else {},
            "lobbies_count": b_data.get("lobbies_count", 0) if b_ok else 0,
            "spectators_count": b_data.get("spectators_count", 0) if b_ok else 0,
            "spectator_rooms_count": b_data.get("spectator_rooms_count", 0) if b_ok else 0,
            "error": None if b_ok else b_data.get("error"),
        },
        "server": {
            "online": s_ok,
            "url": s_resolved_url,
            "latency_ms": s_latency_ms if s_ok else None,
            "uptime_seconds": s_data.get("uptime_seconds", 0) if s_ok else 0,
            "mongo_ok": s_data.get("mongo_ok", False) if s_ok else False,
            "mongo_ping_ms": s_data.get("mongo_ping_ms") if s_ok else None,
            "error": None if s_ok else s_data.get("error"),
        },
    }


# -------------------------------------------------------------
# Quiz Question Bank Management
# -------------------------------------------------------------

def _validate_question_payload(data: dict) -> dict:
    question_text = str(data.get("question") or "").strip()
    if len(question_text) < 3:
        raise HTTPException(status_code=400, detail="متن سوال باید حداقل ۳ کاراکتر باشد.")

    raw_options = data.get("options")
    if not isinstance(raw_options, list) or len(raw_options) != 4:
        raise HTTPException(status_code=400, detail="هر سوال باید دقیقاً ۴ گزینه داشته باشد.")
    options = [str(opt or "").strip() for opt in raw_options]
    if any(not opt for opt in options):
        raise HTTPException(status_code=400, detail="هیچ‌یک از ۴ گزینه نمی‌تواند خالی باشد.")

    try:
        correct = int(data.get("correct"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="گزینه صحیح باید عددی بین ۰ تا ۳ باشد.")
    if correct < 0 or correct > 3:
        raise HTTPException(status_code=400, detail="گزینه صحیح باید بین ۰ تا ۳ باشد.")

    try:
        category_id = int(data.get("category_id", 0) or 0)
    except (TypeError, ValueError):
        category_id = 0
    category_title = str(data.get("category_title") or "اطلاعات عمومی").strip() or "اطلاعات عمومی"

    return {
        "category_id": category_id,
        "category_title": category_title,
        "question": question_text,
        "options": options,
        "correct": correct,
    }


def _question_id_filter(raw_id: str) -> dict:
    clean = str(raw_id or "").strip()
    ors: List[dict] = [{"_id": clean}]
    try:
        if ObjectId.is_valid(clean):
            ors.append({"_id": ObjectId(clean)})
    except Exception:
        pass
    if clean.isdigit():
        ors.append({"question_id": int(clean)})
    return {"$or": ors} if len(ors) > 1 else ors[0]


def get_question_categories() -> dict:
    total = db.questions.count_documents({})
    categories: List[dict] = []
    try:
        agg = db.questions.aggregate([
            {
                "$group": {
                    "_id": {
                        "category_id": {"$ifNull": ["$category_id", 0]},
                        "category_title": {"$ifNull": ["$category_title", "اطلاعات عمومی"]},
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"count": -1}},
        ])
        for row in agg:
            key = row.get("_id") or {}
            categories.append({
                "category_id": int(key.get("category_id", 0) or 0),
                "category_title": str(key.get("category_title") or "اطلاعات عمومی"),
                "count": int(row.get("count", 0) or 0),
            })
    except Exception:
        counts: Dict[Tuple[int, str], int] = {}
        for doc in db.questions.find({}, {"category_id": 1, "category_title": 1}):
            k = (int(doc.get("category_id", 0) or 0), str(doc.get("category_title") or "اطلاعات عمومی"))
            counts[k] = counts.get(k, 0) + 1
        categories = [
            {"category_id": cid, "category_title": title, "count": cnt}
            for (cid, title), cnt in sorted(counts.items(), key=lambda x: x[1], reverse=True)
        ]
    return {"total": total, "categories": categories}


def list_questions(
    page: int = 1,
    limit: int = 25,
    search: Optional[str] = None,
    category_title: Optional[str] = None,
    category_id: Optional[int] = None,
) -> dict:
    conditions: List[dict] = []
    if category_id is not None:
        conditions.append({"category_id": int(category_id)})
    if category_title and str(category_title).strip() and category_title != "all":
        conditions.append({"category_title": str(category_title).strip()})
    if search and str(search).strip():
        esc = _escape_regex(search)
        conditions.append({
            "$or": [
                {"question": {"$regex": esc, "$options": "i"}},
                {"category_title": {"$regex": esc, "$options": "i"}},
                {"options": {"$regex": esc, "$options": "i"}},
            ]
        })

    if len(conditions) == 0:
        query: dict = {}
    elif len(conditions) == 1:
        query = conditions[0]
    else:
        query = {"$and": conditions}

    total = db.questions.count_documents(query)
    safe_limit = max(1, min(int(limit or 25), 100))
    skip = max(0, (max(1, int(page or 1)) - 1) * safe_limit)
    cursor = db.questions.find(query).sort([("question_id", -1), ("_id", -1)]).skip(skip).limit(safe_limit)
    items = [_clean_doc(doc) for doc in cursor]

    return {
        "items": items,
        "total": total,
        "page": max(1, int(page or 1)),
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


def _next_question_id() -> int:
    try:
        top = list(db.questions.find({}, {"question_id": 1}).sort([("question_id", -1)]).limit(1))
        if top and isinstance(top[0].get("question_id"), int):
            return int(top[0]["question_id"]) + 1
    except Exception:
        pass
    return int(datetime.now().timestamp())


def create_question(data: dict, admin_id: str = "") -> dict:
    clean = _validate_question_payload(data)
    qid = data.get("question_id")
    if qid is None:
        qid = _next_question_id()
    else:
        try:
            qid = int(qid)
        except (TypeError, ValueError):
            qid = _next_question_id()

    doc = {
        "question_id": qid,
        **clean,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(admin_id or "system"),
    }
    res = db.questions.insert_one(doc)
    inserted_id = getattr(res, "inserted_id", None)
    if inserted_id is not None:
        doc["_id"] = inserted_id
    _log_admin_action(admin_id, "create_question", {
        "question_id": qid,
        "category_title": clean["category_title"],
        "question": clean["question"][:80],
    })
    return _clean_doc(doc)


def update_question(question_doc_id: str, data: dict, admin_id: str = "") -> dict:
    filt = _question_id_filter(question_doc_id)
    existing = db.questions.find_one(filt)
    if not existing:
        raise HTTPException(status_code=404, detail="سوال یافت نشد.")

    merged = {
        "question": data.get("question", existing.get("question")),
        "options": data.get("options", existing.get("options")),
        "correct": data.get("correct", existing.get("correct")),
        "category_id": data.get("category_id", existing.get("category_id", 0)),
        "category_title": data.get("category_title", existing.get("category_title", "اطلاعات عمومی")),
    }
    clean = _validate_question_payload(merged)
    clean["updated_at"] = datetime.now(timezone.utc)
    db.questions.update_one({"_id": existing["_id"]}, {"$set": clean})
    _log_admin_action(admin_id, "update_question", {
        "question_id": existing.get("question_id", str(existing["_id"])),
        "category_title": clean["category_title"],
    })
    return _clean_doc(db.questions.find_one({"_id": existing["_id"]}))


def delete_question(question_doc_id: str, admin_id: str = "") -> dict:
    filt = _question_id_filter(question_doc_id)
    existing = db.questions.find_one(filt)
    if not existing:
        raise HTTPException(status_code=404, detail="سوال یافت نشد.")
    db.questions.delete_one({"_id": existing["_id"]})
    _log_admin_action(admin_id, "delete_question", {
        "question_id": existing.get("question_id", str(existing["_id"])),
        "question": str(existing.get("question") or "")[:80],
    })
    return {"status": "deleted", "id": str(existing["_id"])}


def bulk_import_questions(items: List[dict], admin_id: str = "") -> dict:
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail="لیست سوالات برای ورود گروهی خالی است.")
    if len(items) > 1000:
        raise HTTPException(status_code=400, detail="در هر مرحله حداکثر ۱۰۰۰ سوال قابل ورود است.")

    next_qid = _next_question_id()
    docs_to_insert: List[dict] = []
    errors: List[str] = []
    now = datetime.now(timezone.utc)

    for idx, raw in enumerate(items):
        if not isinstance(raw, dict):
            errors.append(f"Row #{idx + 1}: invalid object")
            continue
        try:
            clean = _validate_question_payload(raw)
        except HTTPException as exc:
            errors.append(f"Row #{idx + 1}: {exc.detail}")
            continue
        raw_qid = raw.get("question_id", raw.get("id"))
        if raw_qid is not None and str(raw_qid).isdigit():
            qid = int(raw_qid)
        else:
            qid = next_qid
            next_qid += 1
        docs_to_insert.append({
            "question_id": qid,
            **clean,
            "created_at": now,
            "created_by": str(admin_id or "system"),
        })

    if docs_to_insert:
        db.questions.insert_many(docs_to_insert, ordered=False)

    _log_admin_action(admin_id, "bulk_import_questions", {
        "inserted_count": len(docs_to_insert),
        "skipped_count": len(errors),
    })
    return {
        "inserted_count": len(docs_to_insert),
        "skipped_count": len(errors),
        "errors": errors[:20],
    }


# -------------------------------------------------------------
# Promo / Gift Codes Management
# -------------------------------------------------------------

def _normalize_promo_code(raw: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_-]", "", str(raw or "").strip().upper())
    if len(clean) < 3 or len(clean) > 32:
        raise HTTPException(status_code=400, detail="کد هدیه باید بین ۳ تا ۳۲ کاراکتر انگلیسی/عدد باشد.")
    return clean


def _parse_iso_optional(raw: Any) -> Optional[datetime]:
    if raw is None or str(raw).strip() == "":
        return None
    if isinstance(raw, datetime):
        return raw.replace(tzinfo=timezone.utc) if raw.tzinfo is None else raw.astimezone(timezone.utc)
    s = str(raw).strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="فرمت تاریخ انقضا نامعتبر است.")


def list_promos(
    page: int = 1,
    limit: int = 25,
    search: Optional[str] = None,
    status_filter: Optional[str] = "all",
) -> dict:
    query: dict = {}
    if search and str(search).strip():
        esc = _escape_regex(search)
        query["$or"] = [
            {"code": {"$regex": esc, "$options": "i"}},
            {"title": {"$regex": esc, "$options": "i"}},
        ]
    if status_filter == "active":
        query["is_active"] = True
    elif status_filter == "inactive":
        query["is_active"] = False

    total = db.promo_codes.count_documents(query)
    safe_limit = max(1, min(int(limit or 25), 100))
    skip = max(0, (max(1, int(page or 1)) - 1) * safe_limit)
    rows = list(db.promo_codes.find(query).sort([("created_at", -1)]).skip(skip).limit(safe_limit))

    now_utc = datetime.now(timezone.utc)
    items = []
    for r in rows:
        doc = _clean_doc(r)
        exp = r.get("expires_at")
        is_expired = False
        if isinstance(exp, datetime):
            exp_utc = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp.astimezone(timezone.utc)
            is_expired = now_utc >= exp_utc
        max_uses = int(r.get("max_uses", 0) or 0)
        used = int(r.get("used_count", 0) or 0)
        doc["is_expired"] = is_expired
        doc["is_exhausted"] = bool(max_uses > 0 and used >= max_uses)
        items.append(doc)

    return {
        "items": items,
        "total": total,
        "page": max(1, int(page or 1)),
        "limit": safe_limit,
        "total_pages": max(1, (total + safe_limit - 1) // safe_limit),
    }


def create_promo(data: dict, admin_id: str = "") -> dict:
    code = _normalize_promo_code(data.get("code", ""))
    if db.promo_codes.find_one({"code": code}):
        raise HTTPException(status_code=409, detail="این کد هدیه قبلاً ثبت شده است.")

    title = str(data.get("title") or code).strip()
    reward_coin = max(0, int(data.get("reward_coin", 0) or 0))
    reward_xp = max(0, int(data.get("reward_xp", 0) or 0))
    if reward_coin == 0 and reward_xp == 0:
        raise HTTPException(status_code=400, detail="حداقل یکی از پاداش‌های سکه یا XP باید بزرگ‌تر از صفر باشد.")

    max_uses = max(0, int(data.get("max_uses", 0) or 0))
    per_user_limit = max(1, int(data.get("per_user_limit", 1) or 1))
    expires_at = _parse_iso_optional(data.get("expires_at"))
    is_active = bool(data.get("is_active", True))

    promo_doc = {
        "_id": generate_notice_id("prm_"),
        "code": code,
        "title": title,
        "reward_coin": reward_coin,
        "reward_xp": reward_xp,
        "max_uses": max_uses,
        "per_user_limit": per_user_limit,
        "used_count": 0,
        "expires_at": expires_at,
        "is_active": is_active,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(admin_id or "system"),
    }
    db.promo_codes.insert_one(promo_doc)
    _log_admin_action(admin_id, "create_promo", {
        "promo_id": promo_doc["_id"],
        "code": code,
        "reward_coin": reward_coin,
        "reward_xp": reward_xp,
        "max_uses": max_uses,
    })
    return _clean_doc(promo_doc)


def update_promo(promo_id: str, data: dict, admin_id: str = "") -> dict:
    pid = str(promo_id)
    existing = db.promo_codes.find_one({"_id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="کد هدیه یافت نشد.")

    upd: dict = {}
    if "title" in data and data["title"] is not None:
        upd["title"] = str(data["title"]).strip()
    if "reward_coin" in data and data["reward_coin"] is not None:
        upd["reward_coin"] = max(0, int(data["reward_coin"]))
    if "reward_xp" in data and data["reward_xp"] is not None:
        upd["reward_xp"] = max(0, int(data["reward_xp"]))
    if "max_uses" in data and data["max_uses"] is not None:
        upd["max_uses"] = max(0, int(data["max_uses"]))
    if "per_user_limit" in data and data["per_user_limit"] is not None:
        upd["per_user_limit"] = max(1, int(data["per_user_limit"]))
    if "is_active" in data and data["is_active"] is not None:
        upd["is_active"] = bool(data["is_active"])
    if "expires_at" in data:
        upd["expires_at"] = _parse_iso_optional(data["expires_at"])

    if upd:
        upd["updated_at"] = datetime.now(timezone.utc)
        db.promo_codes.update_one({"_id": pid}, {"$set": upd})
        _log_admin_action(admin_id, "update_promo", {"promo_id": pid, "code": existing.get("code"), "updates": _clean_doc(upd)})

    return _clean_doc(db.promo_codes.find_one({"_id": pid}))


def delete_promo(promo_id: str, admin_id: str = "") -> dict:
    pid = str(promo_id)
    existing = db.promo_codes.find_one({"_id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="کد هدیه یافت نشد.")
    db.promo_codes.delete_one({"_id": pid})
    _log_admin_action(admin_id, "delete_promo", {"promo_id": pid, "code": existing.get("code")})
    return {"status": "deleted", "promo_id": pid}


def list_promo_redemptions(promo_id: str, limit: int = 50) -> dict:
    pid = str(promo_id)
    existing = db.promo_codes.find_one({"_id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="کد هدیه یافت نشد.")
    safe_limit = max(1, min(int(limit or 50), 200))
    rows = list(db.promo_redemptions.find({"promo_id": pid}).sort([("redeemed_at", -1)]).limit(safe_limit))
    name_map = _resolve_usernames([str(r.get("user_id") or "") for r in rows])
    items = []
    for r in rows:
        doc = _clean_doc(r)
        uid = str(r.get("user_id") or "")
        doc["username"] = name_map.get(uid, uid)
        items.append(doc)
    return {
        "promo": _clean_doc(existing),
        "items": items,
        "total": db.promo_redemptions.count_documents({"promo_id": pid}),
    }

