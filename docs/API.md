# CarePulse API reference

Base URL: `http://localhost:8000`. Interactive docs: `/docs` (Swagger) and `/redoc`.
All endpoints except `/api/health`, `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh` require
`Authorization: Bearer <access_token>`.

## Error format

| Status | When | Body |
|---|---|---|
| 401 | missing / invalid / expired token | `{"detail": "Not authenticated"}` |
| 404 | record not found *or* owned by another user | `{"detail": "Patient not found"}` |
| 409 | duplicate email (patient) / duplicate account | `{"detail": {"errors": ["email: a record with this email already exists"]}}` |
| 422 | validation failure — **all** problems listed | `{"detail": {"errors": ["date_of_birth: ...", "email: ..."]}}` |
| 429 | 5 failed logins within 60 s | `{"detail": "Too many login attempts — try again in a minute"}` |

## Auth — `/api/auth`

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/register` | `{full_name, email, password(≥8)}` | `201 {access_token, refresh_token, token_type}` |
| POST | `/login` | `{email, password}` | `200 TokenPair` |
| POST | `/refresh` | `{refresh_token}` | `200 TokenPair` (refresh tokens cannot be used as access tokens) |
| GET | `/me` | — | `{id, full_name, email, role, created_at}` |

## Patients — `/api/patients`

| Method | Path | Notes |
|---|---|---|
| GET | `/` | query: `q` (name/email search), `risk` (`low|moderate|high`), `sort` (`field:asc|desc`, e.g. `health_score:desc`), `page`, `page_size` (≤100). Returns `{items, total, page, page_size}` |
| POST | `/` | `PatientIn` → `201 PatientOut`. Runs validation → AI assessment → stores patient + assessment snapshot → audit log → WebSocket `patient.created` |
| POST | `/validate` | **Dry run.** Same body; `?exclude_id=<id>` skips the duplicate check for the record being edited. Returns `{valid, errors}`; nothing is saved |
| GET | `/duplicates` | Data-quality check: `{groups:[{reason, patients:[{id, full_name, email, date_of_birth}]}]}` for patients sharing a normalised name |
| GET | `/export.csv` | CSV download of all the caller's patients |
| POST | `/import` | multipart `file` (CSV with `full_name,date_of_birth,email,glucose,haemoglobin,cholesterol`) → `{created, failed, errors:[{row, errors}]}` |
| GET | `/{id}` | `PatientOut` |
| PUT | `/{id}` | Partial update (`PatientUpdate`). If any lab value changes the AI assessment re-runs; email/name-only edits keep the existing remarks |
| DELETE | `/{id}` | `204` — cascades assessments, writes audit log, broadcasts `patient.deleted` |
| GET | `/{id}/assessments` | History, newest first: `[{id, health_score, risk_level, ai_source, detail:{markers, recommendations}, created_at}]` |
| POST | `/{id}/regenerate-remarks` | Re-runs AI on the current values and appends a snapshot |
| GET | `/{id}/report.pdf` | PDF clinical report |

### `PatientIn`

```json
{
  "full_name": "Robyn Pears",
  "date_of_birth": "28.01.1960",
  "email": "robyn@gmail.com",
  "glucose": 180,
  "haemoglobin": 12.5,
  "cholesterol": 150
}
```

### `PatientOut`

```json
{
  "id": 1, "full_name": "Robyn Pears", "date_of_birth": "28/01/1960", "email": "robyn@gmail.com",
  "glucose": 180.0, "haemoglobin": 12.5, "cholesterol": 150.0,
  "remarks": "Glucose is critically high ...", "risk_level": "moderate", "health_score": 65,
  "ai_source": "rules", "created_at": "...", "updated_at": "..."
}
```

## Data quality

| Method | Path | Response |
|---|---|---|
| GET | `/api/validation/rules` | `{rules:[{field, rule, pattern?, min?, max?, unit?}]}` — generated from `validators.py` constants |
| POST | `/api/patients/validate?exclude_id=` | `{valid, errors[]}` — runs the create/update rules without saving |
| GET | `/api/patients/duplicates` | `{groups:[{reason, patients:[{id, full_name, email, date_of_birth}]}]}` |

## Account & system

| Method | Path | Response |
|---|---|---|
| PATCH | `/api/auth/me` | body `{full_name}` → updated user |
| POST | `/api/auth/change-password` | body `{current_password, new_password}` → `204`; `400` if the current password is wrong |
| GET | `/api/system/status` | `{service, version, server_time, uptime_seconds, database:{ok, dialect}, ai:{configured_provider, active_engine, external_api_key_set, model}, auth:{access_token_minutes, refresh_token_days}, counts:{patients, assessments, audit_entries}}` |

## Analytics & audit

| Method | Path | Response |
|---|---|---|
| GET | `/api/analytics/summary` | `{total_patients, risk_counts, avg_glucose, avg_haemoglobin, avg_cholesterol, avg_health_score, recent, top_risk}` |
| GET | `/api/analytics/trends` | `{glucose_distribution:[{bucket,count}], assessments_per_day:[{date,count}], avg_score_by_risk}` |
| GET | `/api/audit?limit=100` | `[{id, action, entity, entity_id, detail, created_at}]` |

## Real-time — `ws://localhost:8000/ws/events`

Server pushes JSON frames: `{"event": "patient.created" | "patient.updated" | "patient.deleted" | "patient.imported" | ..., "data": {...}}`.
Send `"ping"` periodically to keep the socket alive.

## Health — `GET /api/health`

`{"status":"ok","service":"carepulse","version":"2.1.0","database":"sqlite"}` — returns `503 {"status":"degraded"}` if the
database cannot be reached, so load balancers and Docker health checks can act on it.

All responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`;
`/api/*` responses are `Cache-Control: no-store`.
