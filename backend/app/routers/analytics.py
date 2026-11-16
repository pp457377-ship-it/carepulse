from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user
from ..models import Assessment, AuditLog, Patient, User
from ..schemas import AnalyticsSummary, AuditLogOut, TrendsOut

router = APIRouter(prefix="/api", tags=["analytics"])

GLUCOSE_BUCKETS = [("<70", 0, 70), ("70–99", 70, 100), ("100–125", 100, 126),
                   ("126–179", 126, 180), ("180+", 180, 10**9)]


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def summary(db: Session = Depends(get_db), user: User = Depends(current_user)):
    base = select(Patient).where(Patient.owner_id == user.id)
    patients = db.scalars(base).all()
    total = len(patients)
    risk_counts = {"low": 0, "moderate": 0, "high": 0}
    for p in patients:
        risk_counts[p.risk_level] = risk_counts.get(p.risk_level, 0) + 1

    def avg(attr):
        return round(sum(getattr(p, attr) for p in patients) / total, 1) if total else 0.0

    recent = db.scalars(base.order_by(Patient.created_at.desc()).limit(5)).all()
    top_risk = db.scalars(base.order_by(Patient.health_score.asc()).limit(5)).all()
    return AnalyticsSummary(
        total_patients=total, risk_counts=risk_counts,
        avg_glucose=avg("glucose"), avg_haemoglobin=avg("haemoglobin"),
        avg_cholesterol=avg("cholesterol"), avg_health_score=avg("health_score"),
        recent=recent, top_risk=top_risk)


@router.get("/analytics/trends", response_model=TrendsOut)
def trends(db: Session = Depends(get_db), user: User = Depends(current_user)):
    patients = db.scalars(select(Patient).where(Patient.owner_id == user.id)).all()
    dist = [{"bucket": label, "count": 0} for label, _, _ in GLUCOSE_BUCKETS]
    for p in patients:
        for i, (_, lo, hi) in enumerate(GLUCOSE_BUCKETS):
            if lo <= p.glucose < hi:
                dist[i]["count"] += 1
                break

    rows = db.execute(
        select(func.date(Assessment.created_at).label("d"), func.count())
        .join(Patient, Assessment.patient_id == Patient.id)
        .where(Patient.owner_id == user.id)
        .group_by(func.date(Assessment.created_at))
        .order_by(func.date(Assessment.created_at))
    ).all()
    per_day = [{"date": str(d), "count": c} for d, c in rows]

    avg_by_risk: dict[str, list] = {}
    for p in patients:
        avg_by_risk.setdefault(p.risk_level, []).append(p.health_score)
    avg_score_by_risk = {k: round(sum(v) / len(v), 1) for k, v in avg_by_risk.items()}

    return TrendsOut(glucose_distribution=dist, assessments_per_day=per_day,
                     avg_score_by_risk=avg_score_by_risk)


@router.get("/audit", response_model=list[AuditLogOut])
def audit(limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db),
          user: User = Depends(current_user)):
    return db.scalars(select(AuditLog).where(AuditLog.user_id == user.id)
                      .order_by(AuditLog.created_at.desc()).limit(limit)).all()
