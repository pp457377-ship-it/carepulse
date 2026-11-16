# Likely interview questions

**Why FastAPI?** Async-ready, Pydantic validation built in, automatic OpenAPI docs, dependency injection makes auth and
DB sessions clean and testable.

**How does validation work and why return all errors at once?** `validators.validate_patient_payload` runs every rule and
accumulates messages instead of raising on the first failure. Record #8 in the sheet has two defects; the task wants
both explained, and a user fixing a form wants the full list in one round trip.

**How do you handle `31.11.1998`?** The parser accepts `/`, `.` or `-` separators, then builds a real `date` object —
`date(1998, 11, 31)` raises, which becomes `date_of_birth: not a valid calendar date`. Dates are then stored
normalised as `dd/mm/yyyy`.

**Where does the AI come in?** `ai_service.assess_risk` is deterministic and always runs — it produces the marker statuses,
score and risk so the app is testable and works offline. `generate_remarks` calls Gemini (or an OpenAI-compatible endpoint
like Groq/OpenAI) via `httpx` when a key is configured, with a timeout and fallback to the rules text. `ai_source` is stored
so results are explainable.

**How is the health score computed?** 100 minus a deduction per abnormal marker: mild −8, moderate −18, severe −35.
≥80 low risk, ≥55 moderate, otherwise high. Thresholds follow common clinical cut-offs (ADA for glucose, WHO for Hb,
NCEP for cholesterol).

**How do you secure the API?** bcrypt passwords; short-lived JWT access tokens plus typed refresh tokens; login throttling;
every patient query filtered by `owner_id`; CORS allow-list; secrets only from environment.

**Why 404 instead of 403 for another user's record?** Avoids leaking that the ID exists.

**What happens on edit?** If any lab value changed the AI assessment re-runs and a new `Assessment` snapshot is stored;
an email/name-only edit keeps the existing remark (tested).

**How does real-time work?** `/ws/events` keeps a set of WebSocket connections; routers call `broadcast()` after each
mutation. The React hook refetches on each event, so multiple tabs stay in sync. For multiple server replicas you would
back it with Redis pub/sub.

**What about the dry-run endpoint?** `POST /api/patients/validate` runs the exact create rules (including the duplicate
check, with `exclude_id` for edits) and returns `{valid, errors}` without touching the DB. The form debounces to it, so
users see server-authoritative errors inline.

**Testing strategy?** 49 pytest cases via `TestClient` on a fresh SQLite DB per test: auth and token types, rate limiting,
cross-user isolation, each validation rule, the 10-record replay with exact statuses, AI re-run semantics, CSV import/export,
PDF generation, audit and analytics, the Task-2 helper endpoints.

**How would you take this to production?** Postgres via `DATABASE_URL`, Alembic migrations, HTTPS behind a reverse proxy,
Redis for the broadcaster and rate limiter, a task queue for AI calls, structured logging and Sentry, Docker image already
provided.
