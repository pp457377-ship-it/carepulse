# Deployment guide

CarePulse ships as **one container**: the React app is built at image-build time and served by the FastAPI
process alongside the API and WebSocket endpoint. Nothing is seeded — the first user to register creates their own account.

## 1 · Environment variables (never commit these)

| Variable | Production value |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://USER:xxxxx@HOST:5432/carepulse` (SQLite works for a single instance) |
| `JWT_SECRET_KEY` | 48+ random characters — `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | `30` / `7` (defaults) |
| `AI_PROVIDER` · `AI_API_KEY` · `AI_MODEL` | `gemini` + key (or `groq` / `openai`); leave key empty to run on the built-in rules engine |
| `CORS_ORIGINS` | your public URL, e.g. `https://carepulse.example.com` |

Postgres driver: add `psycopg[binary]` to `backend/requirements.txt` (already compatible with the SQLAlchemy URL above).

## 2 · Docker (any VPS)

```bash
cp backend/.env.example backend/.env   # fill in real values
docker compose up -d --build           # http://<host>:8000
curl http://<host>:8000/api/health     # {"status":"ok",...} — 503 if the DB is unreachable
```

Put Nginx/Caddy in front for TLS. WebSockets need `Upgrade`/`Connection` headers forwarded (Caddy does this automatically).

## 3 · Render / Railway / Fly (Dockerfile deploy)

1. Create a new **Web Service from the repo** and choose *Docker*.
2. Set the environment variables above; attach a managed Postgres and paste its URL into `DATABASE_URL`.
3. Health-check path: `/api/health`. Port: `8000`.
4. Deploy — the build runs `npm run build` and `pip install` inside the image.

## 4 · Separate frontend hosting (optional)

If you prefer Vercel/Netlify for the SPA: `cd frontend && npm run build`, deploy `dist/`, and set
`VITE_API_BASE` is not needed — the app calls relative `/api` and `/ws`, so configure the host to proxy those paths
to the backend, or serve both behind the same domain.

## 5 · Production checklist

- [ ] `JWT_SECRET_KEY` rotated from the placeholder
- [ ] `CORS_ORIGINS` restricted to the real domain
- [ ] Postgres `DATABASE_URL` + backups
- [ ] `AI_API_KEY` set (Settings page shows the active engine)
- [ ] TLS terminated at the proxy; `/ws/events` upgrade forwarded
- [ ] `/api/health` wired into the platform's health check
- [ ] `PYTHONPATH=. pytest -q` green before each release

## 6 · Scaling notes

- The WebSocket hub is in-process. For multiple replicas, swap `events.ConnectionManager` for a Redis pub/sub fan-out.
- Login rate-limiting is in-memory per process; move it to Redis for multi-replica deployments.
- All queries are owner-scoped and indexed on `owner_id`/`email`; add Alembic migrations when the schema evolves.
