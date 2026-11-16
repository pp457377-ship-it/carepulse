"""Account self-service and runtime status — everything is read from the live
configuration and database, nothing is hard-coded."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import __version__
from ..config import settings
from ..database import engine, get_db
from ..deps import current_user
from ..models import Assessment, AuditLog, Patient, User
from ..schemas import PasswordChange, ProfileUpdate, UserOut
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api", tags=["account & system"])
STARTED_AT = datetime.now(timezone.utc)


@router.patch("/auth/me", response_model=UserOut)
def update_profile(body: ProfileUpdate, db: Session = Depends(get_db),
                   user: User = Depends(current_user)):
    user.full_name = body.full_name.strip()
    db.add(AuditLog(user_id=user.id, action="user.profile_updated", entity="user",
                    entity_id=user.id, detail=f"name → {user.full_name}"))
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/change-password", status_code=204)
def change_password(body: PasswordChange, db: Session = Depends(get_db),
                    user: User = Depends(current_user)):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must differ from the current one")
    user.hashed_password = hash_password(body.new_password)
    db.add(AuditLog(user_id=user.id, action="user.password_changed", entity="user",
                    entity_id=user.id, detail="password rotated"))
    db.commit()


def _ai_mode() -> dict:
    has_key = bool(settings.gemini_api_key) and settings.gemini_api_key.lower() != "xxxxx"
    return {"configured_provider": "gemini",
            "active_engine": "gemini" if has_key else "none",
            "external_api_key_set": has_key,
            "model": settings.gemini_model or None}


@router.get("/system/status")
def system_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    db_ok = True
    try:
        db.execute(select(1))
    except Exception:  # pragma: no cover
        db_ok = False
    now = datetime.now(timezone.utc)
    own = lambda model: db.scalar(select(func.count()).select_from(model).where(model.owner_id == user.id))  # noqa: E731
    return {
        "service": "carepulse", "version": __version__,
        "server_time": now.isoformat(), "uptime_seconds": int((now - STARTED_AT).total_seconds()),
        "database": {"ok": db_ok, "dialect": engine.dialect.name},
        "ai": _ai_mode(),
        "auth": {"access_token_minutes": settings.access_token_expire_minutes,
                 "refresh_token_days": settings.refresh_token_expire_days},
        "counts": {
            "patients": own(Patient),
            "assessments": db.scalar(select(func.count()).select_from(Assessment)
                                     .join(Patient).where(Patient.owner_id == user.id)),
            "audit_entries": db.scalar(select(func.count()).select_from(AuditLog)
                                       .where(AuditLog.user_id == user.id)),
        },
    }
