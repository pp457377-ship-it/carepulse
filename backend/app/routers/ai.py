"""AI-powered endpoints — copilot chat, free-text intake parsing, panel
insights and per-patient care plans. All per-user scoped, audit-logged and
generated dynamically by Gemini; a failed AI call returns 503."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ai_features
from ..ai_service import AIUnavailable, llm_available
from ..config import settings
from ..database import get_db
from ..deps import current_user
from ..models import AuditLog, Patient, User
from ..schemas import AiChatRequest, AiIntakeRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _audit(db: Session, user_id: int, action: str, detail: str) -> None:
    db.add(AuditLog(user_id=user_id, action=action, entity="ai",
                    entity_id=None, detail=detail))


def _owned_patient(db: Session, user: User, pid: int) -> Patient:
    p = db.get(Patient, pid)
    if not p or p.owner_id != user.id:
        raise HTTPException(404, "Patient not found")
    return p


@router.get("/capabilities")
def capabilities(user: User = Depends(current_user)):
    return {
        "llm_active": llm_available(),
        "provider": "gemini",
        "model": settings.gemini_model or None,
        "features": [
            {"id": "chat", "name": "AI Copilot", "desc": "Patient-aware clinical Q&A"},
            {"id": "parse-intake", "name": "Smart intake", "desc": "Free text → structured patient record"},
            {"id": "panel-insights", "name": "Panel insights", "desc": "AI narrative over your whole patient panel"},
            {"id": "care-plan", "name": "Care plans", "desc": "Structured follow-up plan per patient"},
        ],
    }


@router.post("/chat")
def chat(body: AiChatRequest, db: Session = Depends(get_db),
         user: User = Depends(current_user)):
    patient = None
    if body.patient_id is not None:
        patient = _owned_patient(db, user, body.patient_id)
    history = [h.model_dump() for h in body.history]
    try:
        reply, src = ai_features.chat_reply(body.message, history, patient)
    except AIUnavailable as e:
        raise HTTPException(503, f"AI service unavailable: {e}")
    _audit(db, user.id, "ai.chat",
           f"patient_id={body.patient_id} len={len(body.message)} source={src}")
    db.commit()
    return {"reply": reply, "source": src}


@router.post("/parse-intake")
def parse_intake(body: AiIntakeRequest, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    try:
        fields, src = ai_features.parse_intake(body.text)
    except AIUnavailable as e:
        raise HTTPException(503, f"AI service unavailable: {e}")
    _audit(db, user.id, "ai.parse_intake",
           f"fields={sorted(fields)} source={src}")
    db.commit()
    return {"fields": fields, "source": src}


@router.post("/panel-insights")
def panel_insights(db: Session = Depends(get_db),
                   user: User = Depends(current_user)):
    patients = db.scalars(
        select(Patient).where(Patient.owner_id == user.id)).all()
    try:
        text, src = ai_features.panel_insights(patients)
    except AIUnavailable as e:
        raise HTTPException(503, f"AI service unavailable: {e}")
    _audit(db, user.id, "ai.panel_insights",
           f"patients={len(patients)} source={src}")
    db.commit()
    return {"insights": text, "patient_count": len(patients), "source": src}


@router.post("/care-plan/{pid}")
def care_plan(pid: int, db: Session = Depends(get_db),
              user: User = Depends(current_user)):
    patient = _owned_patient(db, user, pid)
    try:
        plan, src = ai_features.care_plan(patient)
    except AIUnavailable as e:
        raise HTTPException(503, f"AI service unavailable: {e}")
    _audit(db, user.id, "ai.care_plan",
           f"patient={patient.full_name} source={src}")
    db.commit()
    return {"plan": plan, "source": src, "patient": patient.full_name}
