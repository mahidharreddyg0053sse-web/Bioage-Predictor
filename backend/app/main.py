"""PhishGuard FastAPI Application Entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database.db import db
from app.database.seed import seed_database_if_empty
from app.ml.predictor import predictor
from app.routes import analytics, correlation, reports, scan, settings as settings_routes, threat_intel
from app.security import InMemoryRateLimiter

settings = get_settings()
rate_limiter = InMemoryRateLimiter(max_requests_per_minute=settings.rate_limit_requests_per_minute)


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.ensure_loaded()
    seed_database_if_empty()
    yield


app = FastAPI(
    title="PhishGuard API",
    description="AI-Based Phishing URL and Threat Intelligence Correlation System",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def apply_rate_limit_and_security_headers(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        try:
            rate_limiter.check(request)
        except Exception as exc:
            detail = getattr(exc, "detail", "Too many requests.")
            status_code = getattr(exc, "status_code", 429)
            return JSONResponse(status_code=status_code, content={"detail": detail})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "PhishGuard API",
        "version": settings.app_version,
        "database": db.check_connection_status()["status"],
    }


app.include_router(scan.router)
app.include_router(threat_intel.router)
app.include_router(correlation.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(settings_routes.router)
