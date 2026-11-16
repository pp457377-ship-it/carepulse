import csv
import io
import re

from fastapi import (APIRouter, Depends, HTTPException, Query, UploadFile, status)
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai_service import ai_assess
from ..database import get_db
from ..deps import current_user
from ..models import Assessment, AuditLog, Patient, User
from ..report_service import build_patient_report
from ..schemas import (AssessmentOut, ImportResult, PatientIn, PatientList,
                       PatientOut, PatientUpdate)
from ..validators import normalise_dob, parse_dob, validate_patient_payload

router = APIRouter(prefix="/api/patients", tags=["patients"])

CSV_FIELDS = ["full_name", "date_of_birth", "email", "glucose",
              "haemoglobin", "cholesterol"]


def _audit(db: Session, user_id: int, action: str, entity_id: int | None, detail: str) -> None:
    db.add(AuditLog(user_id=user_id, action=action, entity_id=entity_id, detail=detail))


def _broadcast(event: str, data: dict) -> None:
    from ..events import manager
    manager.broadcast_threadsafe(event, data)


def _get_owned(db: Session, user: User, pid: int) -> Patient:
    p = db.get(Patient, pid)
    if not p or p.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return p


def _apply_ai(db: Session, patient: Patient, dob_display: str) -> None:
    risk, source = ai_assess(patient.full_name, dob_display,
                             patient.glucose, patient.haemoglobin,
                             patient.cholesterol)
    patient.remarks = risk["remarks"]
    patient.risk_level = risk["risk_level"]
    patient.health_score = risk["score"]
    patient.ai_source = source
    db.add(Assessment(patient_id=patient.id, glucose=patient.glucose,
                      haemoglobin=patient.haemoglobin, cholesterol=patient.cholesterol,
                      score=risk["score"], risk_level=risk["risk_level"],
                      summary=risk["remarks"], ai_source=source,
                      detail={"markers": risk["markers"],
                              "recommendations": risk["recommendations"]}))


@router.get("", response_model=PatientList)
def list_patients(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    q: str = "",
    risk: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = "created_at:desc",
):
    stmt = select(Patient).where(Patient.owner_id == user.id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where((Patient.full_name.ilike(like)) | (Patient.email.ilike(like)))
    if risk in ("low", "moderate", "high"):
        stmt = stmt.where(Patient.risk_level == risk)

    col, _, direction = sort.partition(":")
    if not re.match(r"^(created_at|full_name|glucose|risk_level|health_score)$", col):
        col = "created_at"
    order_col = getattr(Patient, col)
    stmt = stmt.order_by(order_col.desc() if direction == "desc" else order_col.asc())

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return PatientList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(body: PatientIn, db: Session = Depends(get_db),
                   user: User = Depends(current_user)):
    data = body.model_dump()
    errors = validate_patient_payload(data)
    if errors:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={"errors": errors})
    email = data["email"].strip().lower()
    dup = db.scalar(select(Patient).where(Patient.email == email,
                                          Patient.owner_id == user.id))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail={"errors": ["email: a record with this email already exists"]})
    dob_display = normalise_dob(data["date_of_birth"])
    patient = Patient(full_name=data["full_name"].strip(),
                      date_of_birth=dob_display, email=email,
                      glucose=data["glucose"], haemoglobin=data["haemoglobin"],
                      cholesterol=data["cholesterol"], owner_id=user.id)
    db.add(patient)
    db.flush()
    _apply_ai(db, patient, dob_display)
    _audit(db, user.id, "patient.created", patient.id, patient.full_name)
    db.commit()
    db.refresh(patient)
    _broadcast("patient.created", {"id": patient.id, "full_name": patient.full_name,
                                   "email": patient.email, "risk_level": patient.risk_level})
    return patient


@router.get("/export.csv")
def export_csv(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(Patient).where(Patient.owner_id == user.id)
                      .order_by(Patient.created_at)).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_FIELDS + ["risk_level", "health_score", "remarks"])
    for p in rows:
        w.writerow([p.full_name, p.date_of_birth, p.email, p.glucose,
                    p.haemoglobin, p.cholesterol, p.risk_level,
                    p.health_score, p.remarks])
    _audit(db, user.id, "patient.exported", None, f"{len(rows)} records")
    db.commit()
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition":
                                      "attachment; filename=carepulse-patients.csv"})


@router.post("/import", response_model=ImportResult)
async def import_csv(file: UploadFile, db: Session = Depends(get_db),
                     user: User = Depends(current_user)):
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames or not all(f in reader.fieldnames for f in CSV_FIELDS):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={"errors": [f"csv: required columns: {', '.join(CSV_FIELDS)}"]})
    created = 0
    row_errors: list[dict] = []
    for i, row in enumerate(reader, start=2):
        data = {f: (row.get(f) or "").strip() for f in CSV_FIELDS}
        errors = validate_patient_payload(data)
        email = data["email"].lower()
        if not errors and db.scalar(select(Patient).where(
                Patient.email == email, Patient.owner_id == user.id)):
            errors = ["email: a record with this email already exists"]
        if errors:
            row_errors.append({"row": i, "name": data["full_name"] or "(unnamed)",
                               "messages": errors})
            continue
        dob_display = normalise_dob(data["date_of_birth"])
        patient = Patient(full_name=data["full_name"], date_of_birth=dob_display,
                          email=email, glucose=float(data["glucose"]),
                          haemoglobin=float(data["haemoglobin"]),
                          cholesterol=float(data["cholesterol"]), owner_id=user.id)
        db.add(patient)
        db.flush()
        _apply_ai(db, patient, dob_display)
        created += 1
    _audit(db, user.id, "patient.imported", None,
           f"{created} created, {len(row_errors)} failed")
    db.commit()
    _broadcast("patient.imported", {"created": created, "failed": len(row_errors)})
    return ImportResult(created=created, failed=len(row_errors), errors=row_errors)


@router.get("/{pid}", response_model=PatientOut)
def get_patient(pid: int, db: Session = Depends(get_db),
                user: User = Depends(current_user)):
    return _get_owned(db, user, pid)


@router.put("/{pid}", response_model=PatientOut)
def update_patient(pid: int, body: PatientUpdate, db: Session = Depends(get_db),
                   user: User = Depends(current_user)):
    patient = _get_owned(db, user, pid)
    data = patient.__dict__ | {k: v for k, v in body.model_dump().items() if v is not None}
    errors = validate_patient_payload({f: data[f] for f in
                                       ["full_name", "date_of_birth", "email",
                                        "glucose", "haemoglobin", "cholesterol"]})
    if errors:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail={"errors": errors})
    email = data["email"].strip().lower()
    dup = db.scalar(select(Patient).where(Patient.email == email,
                                          Patient.owner_id == user.id,
                                          Patient.id != pid))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail={"errors": ["email: a record with this email already exists"]})
    labs_changed = any(getattr(patient, f) != data[f]
                       for f in ("glucose", "haemoglobin", "cholesterol"))
    patient.full_name = data["full_name"].strip()
    patient.date_of_birth = normalise_dob(data["date_of_birth"])
    patient.email = email
    patient.glucose = data["glucose"]
    patient.haemoglobin = data["haemoglobin"]
    patient.cholesterol = data["cholesterol"]
    if labs_changed:
        _apply_ai(db, patient, patient.date_of_birth)
    _audit(db, user.id, "patient.updated", patient.id, patient.full_name)
    db.commit()
    db.refresh(patient)
    _broadcast("patient.updated", {"id": patient.id, "full_name": patient.full_name,
                                   "email": patient.email, "risk_level": patient.risk_level})
    return patient


@router.delete("/{pid}", status_code=204)
def delete_patient(pid: int, db: Session = Depends(get_db),
                   user: User = Depends(current_user)):
    patient = _get_owned(db, user, pid)
    name = patient.full_name
    _audit(db, user.id, "patient.deleted", patient.id, name)
    db.delete(patient)
    db.commit()
    _broadcast("patient.deleted", {"id": pid, "full_name": name})
    return Response(status_code=204)


@router.get("/{pid}/assessments", response_model=list[AssessmentOut])
def patient_assessments(pid: int, db: Session = Depends(get_db),
                        user: User = Depends(current_user)):
    patient = _get_owned(db, user, pid)
    return db.scalars(select(Assessment).where(Assessment.patient_id == patient.id)
                      .order_by(Assessment.created_at)).all()


@router.post("/{pid}/regenerate-remarks", response_model=PatientOut)
def regenerate_remarks(pid: int, db: Session = Depends(get_db),
                       user: User = Depends(current_user)):
    patient = _get_owned(db, user, pid)
    _apply_ai(db, patient, patient.date_of_birth)
    _audit(db, user.id, "patient.remarks_regenerated", patient.id, patient.full_name)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{pid}/report.pdf")
def patient_report(pid: int, db: Session = Depends(get_db),
                   user: User = Depends(current_user)):
    patient = _get_owned(db, user, pid)
    pdf = build_patient_report(patient)
    _audit(db, user.id, "patient.report_downloaded", patient.id, patient.full_name)
    db.commit()
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", patient.full_name)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition":
                             f"attachment; filename=carepulse-{safe}-report.pdf"})
