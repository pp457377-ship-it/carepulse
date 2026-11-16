# Demo video script (6–8 minutes)

Record with the backend (`uvicorn app.main:app --reload`) and frontend (`npm run dev`) running.
Open http://localhost:5173 in a clean browser profile. Speak the *italic* lines.

## 0:00 — Intro (30 s)
*"This is CarePulse, my submission for Task 2. It's a FastAPI + React application that stores patient
lab results, validates them strictly, and uses an AI service to generate health remarks. Let me walk through it."*

Show the login page briefly, point out the feature cards on the left, then **Create account**.

## 0:30 — Architecture in one breath (30 s)
Open http://localhost:8000/docs in a second tab.
*"The backend exposes a documented REST API with JWT authentication. Patients, assessments and audit logs live in
SQLite here, Postgres-ready. Every write also pushes a WebSocket event so the UI updates live."*

## 1:00 — Entering the 10 records (2 min)
Open **Patients → Add patient** and type the records from the sheet exactly as supplied (dotted dates included).
Valid ones save with a toast showing the risk and score. For the invalid ones, the form shows the errors inline the
moment you finish typing — narrate the four failures:
* *#2 Darryl Tim — `timd@smh` has no top-level domain, so the email format check fails: 422.*
* *#4 Madison XI — 31 November doesn't exist; the date parser rejects an impossible calendar date: 422.*
* *#6 Robyn Pears — identical to record 1; the unique-email rule returns 409 Conflict.*
* *#8 Kris Wu — two problems at once: the date of birth is in 2030, and the email has no @. The API returns both
  errors together, so the user can fix everything in one go.*

*"Six records accepted, four rejected — and every rejection explains itself."*
(Short on time? **Import CSV** → `data/task2_records.csv` does the same in one step: 6 created, 4 failed with per-row reasons.)

## 3:00 — Edit requirement (45 s)
Click the pencil icon on Sam Kerr, change the email to `gokul@infocare.com`.
*"Notice the form pre-validates against the server as I type — same rules, nothing saved yet."* → **Save changes**.
The row updates in place and the Activity page records the change.

## 3:45 — Validation live (45 s)
**Add patient** → type a name, DOB `31/02/2000`, email `test@x`, glucose `abc`.
*"All three errors appear together, inline, before I even press save."* Fix them, save, watch the toast with the risk & score.

## 4:30 — AI assessment & detail page (1 min)
Click a patient name (e.g. Robyn Pears).
*"The AI layer scores each marker, derives a 0–100 health score, a risk level, recommendations and a written remark.
The `source` badge shows whether Gemini, Groq, OpenAI or the built-in rules engine produced it."*
Click **Re-run AI** → the history chart gains a point. Click **PDF report** → open the download.

## 5:30 — Delete requirement (30 s)
Back on **Patients**, delete one record (trash icon → confirm).
*"The row animates out and the counter drops — the list refreshes immediately, and the Activity page records the deletion."*
Show **Activity**.

## 6:00 — Dashboard + Settings (45 s)
Open **Dashboard**: *"Risk distribution, lab averages, glucose buckets, and the patients who need attention."*
Open **Settings**: *"This is read live from the deployment — database health, which AI engine is active, uptime,
and the validation rules generated from the backend's own constants."*

## 6:45 — Tests & wrap-up (30 s)
In a terminal: `PYTHONPATH=. .venv/bin/pytest -q` → *"55 tests pass, including one that feeds the sheet's CSV through the API and asserts
the exact status of each record."*
*"No secrets are in the repo — `.env.example` has placeholders. Thanks for watching."*
