# CarePulse — AI-assisted patient screening

CarePulse is a full-stack web application built for the **Gokul Infocare · AI Growth & Automation Associate — Task 2** assessment.
A clinician enters a patient's details and three lab markers (glucose, haemoglobin, cholesterol); the system validates the
record strictly, stores it, and produces an **AI health assessment** — a 0–100 health score, a risk level, per-marker clinical
notes, recommendations and a written remark — all visible in a live, animated dashboard.

> Screening aid only — CarePulse does not provide a medical diagnosis.

---

## Feature overview

| Area | What you get |
|---|---|
| **Authentication** | JWT access + refresh tokens, bcrypt passwords, login rate-limiting (5 failed attempts / 60 s), per-user data isolation |
| **Patient CRUD** | Create / list (search, filter, sort, paginate) / detail / update / delete — every save re-runs validation + AI |
| **Validation** | Email format, real calendar date, no future DOB, `dd/mm/yyyy` or `dd.mm.yyyy`, numeric lab ranges, unique email. **All errors are returned together** |
| **AI assessment** | Google Gemini writes marker notes, recommendations and remarks dynamically. Health score, risk, marker cards. Every patient records its `ai_source` |
| **AI Copilot** | Chat page with patient-context picker — the patient's labs, score and flags are injected into the prompt so answers are grounded in their record |
| **Smart intake** | Paste a referral note or dictation; AI extracts name, DOB, email and lab values straight into the patient form (`POST /api/ai/parse-intake`) |
| **Panel insights** | One-click AI brief over your whole patient panel — overview, priority patients, patterns, suggested actions (`POST /api/ai/panel-insights`) |
| **Care plans** | Per-patient structured plan — lifestyle, diet, monitoring, follow-up, red flags (`POST /api/ai/care-plan/{id}`). All AI endpoints audit-logged |
| **Assessment history** | Snapshot per change, score-over-time chart, "Re-run AI" button |
| **Settings & system status** | Profile editing, password change, and a live read-out of the running deployment: API version, database dialect/health, active AI engine, token lifetimes, uptime, per-account counts |
| **Dry-run validation** | `POST /api/patients/validate` powers inline form validation without persisting anything; `GET /api/validation/rules` is generated from the validator's own constants |
| **Data quality** | Duplicate-name detection surfaced as a warning banner with row badges |
| **Bulk data** | CSV import (per-row errors) and CSV export |
| **Reports** | Per-patient PDF clinical report (ReportLab) |
| **Analytics** | Risk distribution, averages, glucose buckets, needs-attention list |
| **Real-time** | WebSocket `/ws/events` pushes create/update/delete/import events to every open tab |
| **Audit** | Every mutation written to `audit_logs`; Activity page |
| **UI/UX** | React + Tailwind + Framer Motion, dark/light theme, skeleton loaders, toasts, responsive layout, animated gauge & charts |
| **Production hardening** | DB-backed health check (`503` when the database is down), security headers, no-store cache policy on the API, Postgres via `DATABASE_URL`, single-container Docker image serving API + SPA |
| **Tests** | 55 pytest cases covering auth, account, security headers, validation, the assessment-sheet records (both via the API and via CSV import), AI scoring, CSV, PDF, audit, analytics, data-quality endpoints |

---

## Project layout

```
carepulse/
├── backend/                 FastAPI service
│   ├── app/
│   │   ├── main.py          app factory, CORS, routers, static frontend (prod)
│   │   ├── config.py        pydantic-settings (reads .env)
│   │   ├── database.py      SQLAlchemy engine/session
│   │   ├── models.py        User, Patient, Assessment, AuditLog
│   │   ├── schemas.py       request / response models
│   │   ├── validators.py    Task-2 validation rules (all errors at once)
│   │   ├── ai_service.py    assess_risk() + generate_remarks() with provider fallback
│   │   ├── report_service.py PDF generation
│   │   ├── security.py      bcrypt + JWT helpers
│   │   ├── deps.py          bearer-token dependency
│   │   ├── events.py        WebSocket broadcaster
│   │   └── routers/         auth, system (account + status), quality (rules, dry-run, duplicates),
│   │                        patients, analytics, realtime
│   ├── tests/               pytest suite (55 tests)
│   ├── requirements.txt
│   └── .env.example         ← copy to .env and fill the xxxxx values
├── frontend/                React 18 + Vite + Tailwind + Framer Motion
│   └── src/
│       ├── api/client.js    axios instance with auto token refresh
│       ├── hooks/           useAuth, useLiveEvents (WebSocket), useTheme
│       ├── components/      Layout, PatientForm (dry-run validation), ImportModal, ui kit
│       └── pages/           Login, Dashboard, Patients, PatientDetail, Activity, Settings
├── data/task2_records.csv   the assessment-sheet records as a plain CSV (import it via the UI)
├── scripts/replay_task_records.py   CLI: POST the CSV rows to a running API and print each verdict
├── docs/                    API reference, architecture, interview Q&A, video script
├── Dockerfile · docker-compose.yml
└── README.md
```

---

## Quick start (local)

Requirements: **Python 3.10+**, **Node 20.19+ (or 22+)**.

### 1 · Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # fill in the xxxxx values (see below)
uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

### 2 · Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173  (proxies /api and /ws to :8000)
```

### 3 · Try it

1. Register an account → you land on the dashboard.
2. **Patients → Add patient** — type the assessment-sheet records one by one (errors appear inline, all at once),
   or **Import CSV** and pick `data/task2_records.csv` → 6 created, 4 failed with per-row reasons.
3. Edit a record's email to `gokul@infocare.com` (pencil icon), delete one (trash icon) — the list refreshes live.
4. Open any patient → health-score gauge, marker cards, recommendations, history chart, **PDF report**.
5. **Settings** shows which AI engine is active, database health, uptime and your validation rules.

Or from the terminal, with the backend running:

```bash
python scripts/replay_task_records.py --email you@clinic.com --password '...'
```

---

## Configuration (`backend/.env`)

| Variable | Purpose | Default / placeholder |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL. SQLite by default; use `postgresql+psycopg://user:pass@host/db` for Postgres | `sqlite:///./carepulse.db` |
| `JWT_SECRET_KEY` | Signing key for tokens — **set a long random string** | `xxxxx` |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_DAYS` | Token lifetimes | `30` / `7` |
| `GEMINI_API_KEY` | Google AI Studio key — powers every AI feature. Leave `xxxxx`/blank → AI calls return `unavailable`/503 | `xxxxx` |
| `GEMINI_MODEL` | Model override | `gemini-2.5-flash` |
| `CORS_ORIGINS` | Comma-separated allowed origins | localhost dev URLs |

All AI content is generated by **Gemini**; each record's `ai_source` field (`gemini` / `unavailable`) shows whether the AI call succeeded.

---

## Running the tests

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest -q      # 55 passed
```

`tests/test_task_records.py` reads `data/task2_records.csv` and POSTs each row unchanged, asserting the exact status
per record (`201, 422, 201, 422, 201, 409, 201, 422, 201, 201`) and that record #8 returns **two** errors at once;
it then imports the same CSV through `/api/patients/import` and asserts 6 created / 4 failed.

---

## Production build

```bash
cd frontend && npm run build          # → frontend/dist
cd ../backend && uvicorn app.main:app  # serves API + built frontend on :8000
```

Or with Docker:

```bash
docker compose up --build             # http://localhost:8000
```

See `docs/DEPLOYMENT.md` for Render / Railway / VPS instructions, Postgres and the production checklist.

---

## The assessment-sheet records (`data/task2_records.csv`)

| # | Name | DOB | Email | Result |
|---|---|---|---|---|
| 1 | Robyn Pears | 28.01.1960 | robyn@gmail.com | ✅ 201 |
| 2 | Darryl Tim | 12.11.1993 | timd@smh | ❌ 422 — email has no top-level domain |
| 3 | Sam Kerr | 09.12.2006 | sam@news.com.au | ✅ 201 |
| 4 | Madison XI | 31.11.1998 | madison@hotmail.com | ❌ 422 — 31 November is not a valid date |
| 5 | Madison XI | 12.09.1998 | madison@hotmail.com | ✅ 201 |
| 6 | Robyn Pears | 28.01.1960 | robyn@gmail.com | ❌ 409 — duplicate of #1 |
| 7 | Mary Fit | 15.06.1975 | mary@fit.com | ✅ 201 |
| 8 | Kris Wu | 19.10.2030 | Kris.wu.gmail.com | ❌ 422 — future DOB **and** email missing `@` (both shown) |
| 9 | Tenille Singh | 30.11.1991 | tenille@yahoo.com | ✅ 201 |
| 10 | Prem Kumar | 28.04.1990 | prem@telstra.com | ✅ 201 |

---

## Security notes

* No secrets are committed — `.env` is git-ignored, `.env.example` uses `xxxxx` placeholders.
* Passwords are bcrypt-hashed; tokens are short-lived with refresh rotation.
* Every patient endpoint is scoped to the authenticated owner — users can never see each other's data.
* Input is validated server-side regardless of what the UI does; the dry-run endpoint uses the same rules.

See `docs/` for the API reference, architecture, interview Q&A and the video script.
