"""Settings, Profile, Preferences, Integration Health & Session endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter

from app.config import get_settings
from app.database.db import db
from app.intelligence.abuseipdb import query_abuseipdb
from app.intelligence.urlhaus import query_urlhaus
from app.intelligence.virustotal import query_virustotal
from app.ml.predictor import predictor
from app.models.schemas import PreferencesUpdateRequest, ProfileUpdateRequest

router = APIRouter(prefix="/api", tags=["Settings"])


@router.get("/settings")
async def get_all_settings() -> Dict[str, Any]:
    profile = db.get_profile()
    db_status = db.check_connection_status()
    integrations = db.list_integrations()
    settings = get_settings()

    return {
        "profile": profile,
        "preferences": profile.get("preferences", {}),
        "database": db_status,
        "integrations": integrations,
        "ml_model": predictor.metrics,
        "security": {
            "rate_limit_rpm": settings.rate_limit_requests_per_minute,
            "external_timeout_sec": settings.external_api_timeout_seconds,
            "ssrf_protection": True,
            "backend_only_secrets": True,
        },
    }


@router.put("/settings/profile")
async def update_user_profile(payload: ProfileUpdateRequest) -> Dict[str, Any]:
    updated = db.update_profile(
        full_name=payload.full_name.strip(),
        email=payload.email.strip(),
        role=payload.role.strip(),
        organization=payload.organization.strip(),
    )
    return {"profile": updated, "message": "Profile updated successfully."}


@router.put("/settings/preferences")
async def update_app_preferences(payload: PreferencesUpdateRequest) -> Dict[str, Any]:
    updated = db.update_preferences(payload.model_dump())
    return {
        "preferences": updated.get("preferences", {}),
        "message": "Application preferences saved.",
    }


@router.get("/settings/status")
async def get_system_status() -> Dict[str, Any]:
    db_status = db.check_connection_status()
    integrations = db.list_integrations()
    return {
        "online": True,
        "database": db_status,
        "integrations": integrations,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/settings/test-connections")
async def test_api_connections() -> Dict[str, Any]:
    """Actively verify VirusTotal, URLhaus, AbuseIPDB and database connectivity."""
    vt = await query_virustotal("domain", "example.com")
    uh = await query_urlhaus("domain", "example.com")
    ab = await query_abuseipdb("8.8.8.8")

    for pkey, pres in [("virustotal", vt), ("urlhaus", uh), ("abuseipdb", ab)]:
        db.record_integration_query(
            pkey,
            pres["status"],
            False,
            None if pres["status"] == "ok" else pres.get("message"),
        )

    return {
        "database": db.check_connection_status(),
        "integrations": db.list_integrations(),
        "probe_results": {
            "virustotal": {"status": vt["status"], "message": vt["message"]},
            "urlhaus": {"status": uh["status"], "message": uh["message"]},
            "abuseipdb": {"status": ab["status"], "message": ab["message"]},
        },
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/auth/logout")
async def logout_session() -> Dict[str, Any]:
    return {
        "logged_out": True,
        "message": "Analyst session ended cleanly.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
