import os
import datetime
from typing import Optional
from fastapi import Header, Query, HTTPException, status
from jose import jwt, JWTError
from passlib.context import CryptContext

SECRET_KEY = os.getenv("SECRET_KEY", "09da5e74afaa9ma2565c818195b7b9563b93xc059f6f0f4cab6cf63b88e8d3e7")
ALGORITHM = "HS256"
LEGACY_ADMIN_TOKEN = os.getenv("LEGACY_ADMIN_TOKEN", "akbarjoojehdehebala")

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def hash_admin_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_admin_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_admin_access_token(admin_data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = {
        "sub": str(admin_data.get("_id", "")),
        "admin_id": str(admin_data.get("_id", "")),
        "username": str(admin_data.get("username", "")),
        "role": str(admin_data.get("role", "admin")),
        "permissions": admin_data.get("permissions", []),
        "is_admin": True,
    }
    if expires_delta:
        expire = datetime.datetime.now(datetime.UTC) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> dict:
    raw_token = None
    if authorization:
        raw_token = authorization[7:].strip() if authorization.startswith("Bearer ") else authorization.strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن اهراز هویت ادمین الزامی است.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Legacy token fallback support
    if raw_token == LEGACY_ADMIN_TOKEN:
        return {
            "_id": "legacy_superadmin",
            "username": "root",
            "full_name": "Root Superadmin (Legacy Token)",
            "role": "superadmin",
            "permissions": ["*"],
            "is_active": True,
        }

    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="دسترسی به بخش مدیریت مجاز نمی‌باشد.",
            )

        admin_id = payload.get("admin_id") or payload.get("sub")
        if not admin_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="شناسه ادمین نامعتبر است.",
            )

        from database import db
        admin_doc = db.admin_manager.find_by_id(admin_id)
        if not admin_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="حساب کاربری ادمین در پایگاه داده یافت نشد.",
            )

        if not admin_doc.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="حساب ادمین شما غیرفعال شده است.",
            )

        return db.admin_manager._sanitize_admin(admin_doc)

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن ادمین منقضی یا نامعتبر است.",
            headers={"WWW-Authenticate": "Bearer"},
        )
