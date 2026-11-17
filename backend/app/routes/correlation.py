"""Threat Correlation Engine API endpoints."""

from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Query

from app.correlation.engine import correlate_threat_intelligence
from app.database.db import db
from app.intelligence.service import gather_threat_intelligence
from app.ml.predictor import predictor
from app.models.schemas import CorrelationRequest
from app.security import safe_resolve_ip, validate_and_normalize_url

router = APIRouter(prefix="/api/threat-correlation", tags=["Threat Correlation"])


@router.post("")
async def run_threat_correlation(payload: CorrelationRequest) -> Dict[str, Any]:
    """
    Correlate Random Forest ML prediction with VirusTotal, URLhaus, AbuseIPDB,
    and stored Threat Indicators while explicitly deduplicating overlapping IoCs.
    """
    target = validate_and_normalize_url(payload.url)
    ml_res = predictor.predict(target.normalized_url)

    ip_address: Optional[str] = None
    if payload.resolve_dns:
        ip_address, _ = safe_resolve_ip(target.hostname)
    elif target.is_ip_literal:
        ip_address = target.hostname

    provider_results = await gather_threat_intelligence(
        normalized_url=target.normalized_url,
        domain=target.hostname,
        ip_address=ip_address,
        is_ip_literal=target.is_ip_literal,
    )

    for pkey, pres in provider_results.items():
        if pres.get("status") != "skipped":
            err = None if pres.get("status") == "ok" else pres.get("message")
            db.record_integration_query(pkey, pres.get("status", "unavailable"), bool(pres.get("matched")), err)

    correlation = correlate_threat_intelligence(
        normalized_url=target.normalized_url,
        domain=target.hostname,
        ip_address=ip_address,
        ml_result=ml_res,
        provider_results=provider_results,
        scan_id=payload.scan_id,
        persist=True,
    )
    return correlation


@router.get("/history")
async def list_correlation_history(limit: int = Query(default=25, ge=1, le=100)) -> Dict[str, Any]:
    items = db.list_correlations(limit=limit)
    return {
        "items": items,
        "total": len(items),
    }
