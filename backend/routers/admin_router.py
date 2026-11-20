from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from security import get_current_admin, require_permission
from services import admin_service

router = APIRouter(prefix='/admin', tags=['admin'])


def _dump(model: BaseModel, **kwargs) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump(**kwargs)
    return model.dict(**kwargs)


# -------------------------------------------------------------
# Request Schemas
# -------------------------------------------------------------

class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)


class AdminChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=4)
    new_password: str = Field(..., min_length=6)


class CreateAdminRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = ""
    role: Optional[str] = "admin"
    permissions: Optional[List[str]] = None


class UpdateAdminRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UpdateUserRequest(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    coin: Optional[int] = None
    score: Optional[int] = None
    xp: Optional[int] = None
    is_active: Optional[bool] = None
    image: Optional[int] = None


class AdjustCurrencyRequest(BaseModel):
    field: str
    amount: int
    reason: Optional[str] = ""


class ToggleBanRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = ""


class BulkCoinsRequest(BaseModel):
    amount: int
    filter_type: Optional[str] = "all"
    reason: Optional[str] = "هدیه مدیریت"


class BulkResetLocksRequest(BaseModel):
    user_ids: Optional[List[str]] = None


class QueueConfigRequest(BaseModel):
    is_open: bool
    hour: Optional[int] = 0
    minute: Optional[int] = 0


class VersionConfigRequest(BaseModel):
    allowed_version: str
    latest_version: str


class AnnouncementRequest(BaseModel):
    announcement: str
    is_active: Optional[bool] = True


class MaintenanceConfigRequest(BaseModel):
    maintenance_mode: bool
    maintenance_message: Optional[str] = ""


class UpdateClanRequest(BaseModel):
    name: Optional[str] = None
    tag: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    trophies: Optional[int] = None


class UpdateReportRequest(BaseModel):
    status: str
    admin_notes: Optional[str] = ""


class SendNotificationRequest(BaseModel):
    target_type: str = Field(..., description="user | clan | all")
    title: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=2, max_length=1000)
    user_id: Optional[str] = None
    clan_id: Optional[str] = None


# -------------------------------------------------------------
# Auth & Staff Endpoints
# -------------------------------------------------------------

@router.post("/auth/login")
async def admin_login(payload: AdminLoginRequest):
    return admin_service.login_admin(payload.username, payload.password)


@router.get("/auth/me")
async def admin_get_me(current_admin: dict = Depends(get_current_admin)):
    return {"admin": current_admin}


@router.post("/auth/change-password")
async def admin_change_password(
    payload: AdminChangePasswordRequest,
    current_admin: dict = Depends(get_current_admin),
):
    admin_service.change_admin_password(
        current_admin["_id"], payload.old_password, payload.new_password
    )
    return {"status": "success", "message": "رمز عبور با موفقیت تغییر کرد."}


@router.get("/admins")
async def get_all_admins(current_admin: dict = Depends(require_permission("admins:manage"))):
    return {"admins": admin_service.list_admins()}


@router.post("/admins")
async def create_new_admin(
    payload: CreateAdminRequest,
    current_admin: dict = Depends(require_permission("admins:manage")),
):
    new_adm = admin_service.create_admin(current_admin["_id"], _dump(payload))
    return {"admin": new_adm}


@router.put("/admins/{admin_id}")
async def update_admin_user(
    admin_id: str,
    payload: UpdateAdminRequest,
    current_admin: dict = Depends(require_permission("admins:manage")),
):
    updated = admin_service.update_admin(
        admin_id,
        _dump(payload, exclude_unset=True),
        actor_id=current_admin["_id"],
    )
    return {"admin": updated}


@router.delete("/admins/{admin_id}")
async def delete_admin_user(
    admin_id: str,
    current_admin: dict = Depends(require_permission("admins:manage")),
):
    success = admin_service.delete_admin(admin_id, current_admin["_id"])
    return {"status": "success", "deleted": success}


# -------------------------------------------------------------
# Dashboard & Analytics
# -------------------------------------------------------------

@router.get("/stats")
async def get_dashboard_stats(current_admin: dict = Depends(require_permission("dashboard:read"))):
    return admin_service.get_dashboard_stats()


@router.get("/analytics")
async def get_analytics_overview(
    days: int = 14,
    current_admin: dict = Depends(require_permission("dashboard:read")),
):
    return admin_service.get_analytics_overview(days=days)


@router.get("/audit-logs")
@router.get("/system/audit-logs")
async def get_audit_logs(
    limit: int = 50,
    action: Optional[str] = None,
    search: Optional[str] = None,
    current_admin: dict = Depends(require_permission("dashboard:read")),
):
    return {"logs": admin_service.list_audit_logs(limit=limit, action=action, search=search)}


# -------------------------------------------------------------
# Users
# -------------------------------------------------------------

@router.get("/users")
async def get_users_list(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    filter_type: Optional[str] = "all",
    sort_by: str = "join_date",
    sort_order: int = -1,
    current_admin: dict = Depends(require_permission("users:read")),
):
    return admin_service.list_users(
        page=page,
        limit=limit,
        search=search,
        filter_type=filter_type,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post("/users/bulk-coins")
async def bulk_distribute_coins(
    payload: BulkCoinsRequest,
    current_admin: dict = Depends(require_permission("economy:write")),
):
    return admin_service.bulk_adjust_coins(
        amount=payload.amount,
        filter_type=payload.filter_type,
        reason=payload.reason,
        admin_id=current_admin["_id"],
    )


@router.post("/users/bulk-reset-locks")
async def bulk_reset_user_locks(
    payload: BulkResetLocksRequest,
    current_admin: dict = Depends(require_permission("users:write")),
):
    return admin_service.bulk_reset_locks(
        user_ids=payload.user_ids,
        admin_id=current_admin["_id"],
    )


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    current_admin: dict = Depends(require_permission("users:read")),
):
    return admin_service.get_user_full_details(user_id)


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    current_admin: dict = Depends(require_permission("users:write")),
):
    updated = admin_service.update_user_profile(
        user_id,
        _dump(payload, exclude_unset=True),
        admin_id=current_admin["_id"],
    )
    return {"user": updated}


@router.post("/users/{user_id}/adjust-currency")
async def adjust_user_currency(
    user_id: str,
    payload: AdjustCurrencyRequest,
    current_admin: dict = Depends(require_permission("economy:write")),
):
    return admin_service.adjust_user_currency(
        user_id=user_id,
        field=payload.field,
        amount=payload.amount,
        reason=payload.reason,
        admin_id=current_admin["_id"],
    )


@router.post("/users/{user_id}/toggle-ban")
async def toggle_user_ban(
    user_id: str,
    payload: ToggleBanRequest,
    current_admin: dict = Depends(require_permission("users:write")),
):
    return admin_service.toggle_user_ban(
        user_id=user_id,
        is_active=payload.is_active,
        reason=payload.reason,
        admin_id=current_admin["_id"],
    )


@router.post("/users/{user_id}/reset-locks")
async def reset_user_locks(
    user_id: str,
    current_admin: dict = Depends(require_permission("users:write")),
):
    return admin_service.reset_user_locks(user_id, admin_id=current_admin["_id"])


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_admin: dict = Depends(require_permission("users:write")),
):
    deleted = admin_service.delete_user_account(user_id, admin_id=current_admin["_id"])
    return {"status": "success", "deleted": deleted}


# -------------------------------------------------------------
# Games
# -------------------------------------------------------------

@router.get("/games/live")
async def get_live_games(current_admin: dict = Depends(require_permission("games:read"))):
    return {"games": admin_service.list_live_games()}


@router.get("/games/history")
async def get_game_history(
    page: int = 1,
    limit: int = 20,
    game_type: Optional[str] = None,
    game_score_type: Optional[str] = None,
    user_id: Optional[str] = None,
    current_admin: dict = Depends(require_permission("games:read")),
):
    return admin_service.list_game_history(
        page=page,
        limit=limit,
        game_type=game_type,
        game_score_type=game_score_type,
        user_id=user_id,
    )


@router.post("/games/cleanup-stuck")
async def cleanup_stuck_games(
    max_age_minutes: int = 120,
    current_admin: dict = Depends(require_permission("games:manage")),
):
    return admin_service.cleanup_stuck_games(
        max_age_minutes=max_age_minutes,
        admin_id=current_admin["_id"],
    )


@router.get("/games/{game_id}")
async def get_game_details(
    game_id: str,
    current_admin: dict = Depends(require_permission("games:read")),
):
    return admin_service.get_game_play_details(game_id)


@router.post("/games/{game_id}/terminate")
async def terminate_game(
    game_id: str,
    current_admin: dict = Depends(require_permission("games:manage")),
):
    return admin_service.terminate_game_session(game_id, admin_id=current_admin["_id"])


# -------------------------------------------------------------
# Config & Queue
# -------------------------------------------------------------

@router.get("/config")
async def get_config(current_admin: dict = Depends(require_permission("config:read"))):
    return admin_service.get_system_config()


@router.post("/config/queue")
async def set_queue(
    payload: QueueConfigRequest,
    current_admin: dict = Depends(require_permission("config:write")),
):
    return admin_service.set_queue_status(
        is_open=payload.is_open,
        hour=payload.hour,
        minute=payload.minute,
        admin_id=current_admin["_id"],
    )


@router.post("/config/version")
async def set_version(
    payload: VersionConfigRequest,
    current_admin: dict = Depends(require_permission("config:write")),
):
    return admin_service.set_app_versions(
        allowed_version=payload.allowed_version,
        latest_version=payload.latest_version,
        admin_id=current_admin["_id"],
    )


@router.post("/config/announcement")
async def set_announcement(
    payload: AnnouncementRequest,
    current_admin: dict = Depends(require_permission("config:write")),
):
    return admin_service.set_announcement_banner(
        announcement=payload.announcement,
        is_active=payload.is_active,
        admin_id=current_admin["_id"],
    )


@router.post("/config/maintenance")
async def set_maintenance(
    payload: MaintenanceConfigRequest,
    current_admin: dict = Depends(require_permission("config:write")),
):
    return admin_service.set_maintenance_mode(
        maintenance_mode=payload.maintenance_mode,
        maintenance_message=payload.maintenance_message or "",
        admin_id=current_admin["_id"],
    )


# -------------------------------------------------------------
# Purchases
# -------------------------------------------------------------

@router.get("/purchases")
async def get_purchases(
    page: int = 1,
    limit: int = 20,
    market_type: Optional[str] = None,
    product_id: Optional[str] = None,
    user_id: Optional[str] = None,
    current_admin: dict = Depends(require_permission("economy:read")),
):
    return admin_service.list_purchases(
        page=page,
        limit=limit,
        market_type=market_type,
        product_id=product_id,
        user_id=user_id,
    )


# -------------------------------------------------------------
# Clans
# -------------------------------------------------------------

@router.get("/clans")
async def get_clans(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    current_admin: dict = Depends(require_permission("clans:read")),
):
    return admin_service.list_clans(page=page, limit=limit, search=search)


@router.get("/clans/{clan_id}")
async def get_clan(
    clan_id: str,
    current_admin: dict = Depends(require_permission("clans:read")),
):
    return admin_service.get_clan_full_details(clan_id)


@router.put("/clans/{clan_id}")
async def update_clan(
    clan_id: str,
    payload: UpdateClanRequest,
    current_admin: dict = Depends(require_permission("clans:manage")),
):
    return admin_service.update_clan_info(
        clan_id=clan_id,
        updates=_dump(payload, exclude_unset=True),
        admin_id=current_admin["_id"],
    )


@router.delete("/clans/{clan_id}/members/{user_id}")
async def kick_clan_member(
    clan_id: str,
    user_id: str,
    current_admin: dict = Depends(require_permission("clans:manage")),
):
    return admin_service.remove_clan_member(clan_id, user_id, admin_id=current_admin["_id"])


@router.delete("/clans/{clan_id}")
async def disband_clan(
    clan_id: str,
    current_admin: dict = Depends(require_permission("clans:manage")),
):
    success = admin_service.disband_clan(clan_id, admin_id=current_admin["_id"])
    return {"status": "success", "disbanded": success}


# -------------------------------------------------------------
# Reports
# -------------------------------------------------------------

@router.get("/reports")
async def get_reports(
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    current_admin: dict = Depends(require_permission("reports:read")),
):
    return admin_service.list_reports(page=page, limit=limit, status_filter=status_filter)


@router.put("/reports/{report_id}")
async def update_report(
    report_id: str,
    payload: UpdateReportRequest,
    current_admin: dict = Depends(require_permission("reports:manage")),
):
    return admin_service.update_report_status(
        report_id=report_id,
        new_status=payload.status,
        admin_notes=payload.admin_notes,
        admin_id=current_admin["_id"],
    )


# -------------------------------------------------------------
# Notifications & Broadcasts
# -------------------------------------------------------------

@router.post("/notifications/send")
async def send_notification(
    payload: SendNotificationRequest,
    current_admin: dict = Depends(require_permission("notifications:write")),
):
    return admin_service.send_admin_notification(
        target_type=payload.target_type,
        title=payload.title,
        message=payload.message,
        user_id=payload.user_id,
        clan_id=payload.clan_id,
        admin_id=current_admin["_id"],
    )


@router.get("/notifications/history")
async def get_notifications_history(
    limit: int = 30,
    current_admin: dict = Depends(require_permission("dashboard:read")),
):
    return {"items": admin_service.list_admin_notifications(limit=limit)}


# -------------------------------------------------------------
# System & Backups
# -------------------------------------------------------------

@router.post("/system/backup")
async def trigger_backup(current_admin: dict = Depends(require_permission("system:backup"))):
    return admin_service.trigger_manual_backup(admin_id=current_admin["_id"])


@router.get("/system/backups")
async def list_backups(current_admin: dict = Depends(require_permission("system:backup"))):
    return {"backups": admin_service.list_system_backups()}


@router.get("/system/backups/{filename}/download")
async def download_backup(
    filename: str,
    current_admin: dict = Depends(require_permission("system:backup")),
):
    zip_bytes, download_name = admin_service.create_backup_zip_bytes(filename)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )


@router.delete("/system/backups/{filename}")
async def delete_backup(
    filename: str,
    current_admin: dict = Depends(require_permission("system:backup")),
):
    return admin_service.delete_system_backup(filename, admin_id=current_admin["_id"])
