"""Data-quality helpers: live validation-rule catalogue, dry-run validation
and near-duplicate detection. Declared before the patients router so that
/patients/validate and /patients/duplicates win over /patients/{pid}."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user
from ..models import Patient, User
from ..schemas import PatientIn
from ..validators import rules_catalogue, validate_patient_payload

router = APIRouter(prefix="/api", tags=["data-quality"])


@router.get("/validation/rules")
def validation_rules():
    """Built from the validator's own constants, so it can never drift from what is enforced."""
    return {"rules": rules_catalogue()}


@router.post("/patients/validate")
def validate_dry_run(body: PatientIn, exclude_id: int | None = None,
                     db: Session = Depends(get_db),
                     user: User = Depends(current_user)):
    """Run the exact create/update rules without persisting anything.
    `exclude_id` lets the edit form skip the duplicate check for the record being edited."""
    data = body.model_dump()
    errors = validate_patient_payload(data)
    email = (data.get("email") or "").strip().lower()
    stmt = select(Patient).where(Patient.email == email, Patient.owner_id == user.id)
    if exclude_id is not None:
        stmt = stmt.where(Patient.id != exclude_id)
    if not errors and db.scalar(stmt):
        errors.append("email: a record with this email already exists")
    return {"valid": not errors, "errors": errors}


@router.get("/patients/duplicates")
def duplicates(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Near-duplicate detection: records of the current user sharing a normalised full name."""
    rows = db.scalars(select(Patient).where(Patient.owner_id == user.id)).all()
    groups: dict[str, list[Patient]] = {}
    for p in rows:
        groups.setdefault(" ".join(p.full_name.lower().split()), []).append(p)
    out = [{"reason": "same name",
            "patients": [{"id": p.id, "full_name": p.full_name, "email": p.email,
                          "date_of_birth": p.date_of_birth} for p in items]}
           for items in groups.values() if len(items) > 1]
    return {"groups": out}
