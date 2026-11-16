# Architecture

```
┌──────────────── Browser ────────────────┐        ┌──────────────── FastAPI ────────────────┐
│ React 18 + Vite                         │  REST  │ routers/auth      JWT, bcrypt, rate-limit│
│  ├ api/client.js  (axios, auto-refresh) │◄──────►│ routers/patients  CRUD, CSV, PDF, history│
│  ├ hooks/useAuth  (session state)       │        │ routers/quality   rules, dry-run, dupes  │
│  ├ hooks/useLiveEvents (WebSocket)      │◄──WS───│ routers/analytics summary, trends, audit │
│  └ pages/*  Dashboard · Patients ·      │        │ routers/realtime  /ws/events broadcaster │
│                                         │        │ routers/system    account, live status   │
│             Detail · Activity · Settings│        ├──────────────────────────────────────────┤
└─────────────────────────────────────────┘        │ validators.py   all-errors-at-once rules │
                                                   │ ai_service.py   assess_risk + remarks    │
                                                   │ report_service  ReportLab PDF            │
                                                   ├──────────────────────────────────────────┤
                                                   │ SQLAlchemy 2.0 → SQLite (dev) / Postgres │
                                                   │ users · patients · assessments · audit   │
                                                   └──────────────────────────────────────────┘
                                                                   │ httpx
                                                                   ▼
                                                   Gemini / Groq / OpenAI-compatible (optional)
```

## Request lifecycle — `POST /api/patients`

1. **Auth** — `deps.current_user` decodes the bearer JWT, loads the user, rejects inactive accounts.
2. **Schema** — Pydantic `PatientIn` enforces types/lengths.
3. **Business validation** — `validators.validate_patient_payload` collects *every* failure
   (name charset, email regex, DOB parse / calendar validity / not-in-future, lab numeric bounds) and
   returns them as one 422. A duplicate email for the same owner returns 409.
4. **AI assessment** — `ai_service.assess_risk` scores each marker (normal / borderline / low / high / critical)
   with a severity; score = 100 − Σ deductions (mild 8, moderate 18, severe 35); risk = low ≥80, moderate ≥55, else high.
   `generate_remarks` asks the configured LLM for a 2–3 sentence clinical remark, falling back to the rules text.
5. **Persist** — patient row + `Assessment` snapshot (markers, recommendations, score, risk, ai_source) in one transaction.
6. **Side effects** — `AuditLog` row; `events.broadcast("patient.created", …)` fans out to every WebSocket client.

## Data model

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, full_name, email (unique), password_hash, role, is_active | owner of everything below |
| `patients` | id, owner_id → users, full_name, date_of_birth (`dd/mm/yyyy`), email, glucose, haemoglobin, cholesterol, remarks, risk_level, health_score, ai_source, timestamps | unique (owner_id, email) |
| `assessments` | id, patient_id → patients (cascade), health_score, risk_level, ai_source, detail (JSON), created_at | one row per (re)assessment |
| `audit_logs` | id, user_id, action, entity, entity_id, detail, created_at | append-only |

## Security

* bcrypt password hashing (cost 12), 72-byte max enforced in the schema.
* Access token 30 min / refresh token 7 days, typed (`"type": "access" | "refresh"`) so one cannot stand in for the other.
* Login throttling: 5 failures per email per 60 s → 429.
* Ownership scoping on every patient query → other users' records are 404, not 403, to avoid existence leaks.
* CORS restricted to `CORS_ORIGINS`. Secrets only via environment (`.env` git-ignored; `.env.example` ships `xxxxx`).

## Frontend design system

* Tailwind tokens: `ink` (dark surfaces), `pulse` (cyan accent), `mint`/`amber`/`rose` (risk colours).
* Reusable primitives in `components/ui.jsx`: `ScoreGauge`, `RiskBadge`, `Modal`, `StatCard`, `SkeletonRows`, `Empty`, `PageHeader`.
* Framer Motion for route/element entrance, layout animation of the nav pill, table row exit, gauge sweep.
* `PatientForm` debounces to `POST /api/patients/validate` so users see server-side errors inline *before* saving — the
  same rules, never persisted.
* `useLiveEvents` reconnects automatically and lets each page refetch on server pushes, so two browser tabs stay in sync.

## Scaling notes

* Swap SQLite for Postgres by changing `DATABASE_URL`; no code changes (SQLAlchemy 2.0, no SQLite-only SQL).
* The WebSocket broadcaster is in-process; for multiple API replicas put Redis pub/sub behind `events.py`.
* AI calls are synchronous per request today; a queue (Celery/RQ) would decouple them for very high write volume.
