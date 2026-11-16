from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from sqlalchemy import text

from .database import Base, engine
from . import __version__
from .routers import ai, analytics, auth, patients, quality, realtime, system

app = FastAPI(title="CarePulse API", version=__version__,
              description="AI-assisted patient screening — CRUD, structured "
                          "assessments, audit trail, live updates.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)



@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


app.include_router(auth.router)
app.include_router(system.router)
app.include_router(quality.router)  # before patients: /patients/validate|duplicates must beat /patients/{pid}
app.include_router(patients.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(realtime.router)


@app.get("/api/health")
def health():
    """Liveness + readiness: fails with 503 if the database is unreachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse({"status": "degraded", "service": "carepulse", "database": "unreachable"}, status_code=503)
    return {"status": "ok", "service": "carepulse", "version": __version__, "database": engine.dialect.name}


# ---- production SPA serving (frontend/dist) ----
_ROOT = Path(__file__).resolve().parents[1]
DIST = next((d for d in (_ROOT / "static", _ROOT.parent / "frontend" / "dist") if d.is_dir()), None)
if DIST is not None:
    assets = DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
