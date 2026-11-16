from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------- auth ----------

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- patients ----------

class PatientIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    date_of_birth: str
    email: str
    glucose: float
    haemoglobin: float
    cholesterol: float


class PatientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    date_of_birth: str | None = None
    email: str | None = None
    glucose: float | None = None
    haemoglobin: float | None = None
    cholesterol: float | None = None


class MarkerOut(BaseModel):
    name: str
    label: str
    value: float
    unit: str
    status: str  # normal | low | borderline | high | critical
    severity: str  # none | mild | moderate | severe
    note: str
    recommendation: str


class AssessmentOut(BaseModel):
    id: int
    patient_id: int
    glucose: float
    haemoglobin: float
    cholesterol: float
    score: int
    risk_level: str
    summary: str
    detail: dict
    ai_source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientOut(BaseModel):
    id: int
    full_name: str
    date_of_birth: str
    email: str
    glucose: float
    haemoglobin: float
    cholesterol: float
    remarks: str
    risk_level: str
    health_score: int
    ai_source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientList(BaseModel):
    items: list[PatientOut]
    total: int
    page: int
    page_size: int


# ---------- analytics ----------

class AnalyticsSummary(BaseModel):
    total_patients: int
    risk_counts: dict
    avg_glucose: float
    avg_haemoglobin: float
    avg_cholesterol: float
    avg_health_score: float
    recent: list[PatientOut]
    top_risk: list[PatientOut]


class TrendsOut(BaseModel):
    glucose_distribution: list[dict]
    assessments_per_day: list[dict]
    avg_score_by_risk: dict


class ImportResult(BaseModel):
    created: int
    failed: int
    errors: list[dict]


# ---------- ai features ----------

class AiChatMessage(BaseModel):
    role: str  # user | assistant
    content: str = Field(max_length=4000)


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    patient_id: int | None = None
    history: list[AiChatMessage] = Field(default_factory=list, max_length=20)


class AiIntakeRequest(BaseModel):
    text: str = Field(min_length=5, max_length=5000)


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity: str
    entity_id: int | None
    detail: str
    created_at: datetime

    model_config = {"from_attributes": True}
