"""Threat Intelligence API endpoints (VirusTotal, URLhaus, AbuseIPDB & IoC Repository)."""

from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Query

from app.database.db import db
from app.intelligence.abuseipdb import query_abuseipdb
from app.intelligence.urlhaus import query_urlhaus
from app.intelligence.virustotal import query_virustotal
from app.models.schemas import IndicatorCreateRequest
from app.security import validate_and_normalize_url, validate_domain, validate_ip_address

router = APIRouter(prefix="/api/threat-intelligence", tags=["Threat Intelligence"])


@router.get("/virustotal")
async def virustotal_lookup(
    indicator: str = Query(..., min_length=2, description="URL, domain, or IP address"),
    indicator_type: str = Query(default="domain", pattern="^(url|domain|ip)$"),
) -> Dict[str, Any]:
    if indicator_type == "url":
        val = validate_and_normalize_url(indicator).normalized_url
    elif indicator_type == "ip":
        val = validate_ip_address(indicator)
    else:
        val = validate_domain(indicator)

    result = await query_virustotal(indicator_type, val)
    db.record_integration_query(
        "virustotal",
        result["status"],
        bool(result.get("matched")),
        None if result["status"] == "ok" else result.get("message"),
    )

    if result["status"] == "ok" and result.get("matched"):
        db.upsert_indicator(
            indicator_type=indicator_type,
            indicator_value=val,
            threat_category=result.get("threat_category") or "Malicious",
            source="VirusTotal",
            confidence_score=result.get("confidence_score") or 80,
            reputation="Malicious",
            raw_metadata=result.get("details", {}),
        )

    # Also return any local IoC matches for analyst context
    local_matches = db.list_indicators(search=val, limit=10)
    return {
        "provider_result": result,
        "local_ioc_matches": local_matches,
    }


@router.get("/urlhaus")
async def urlhaus_lookup(
    indicator: str = Query(..., min_length=2, description="URL or domain/host"),
    indicator_type: str = Query(default="url", pattern="^(url|domain|ip)$"),
) -> Dict[str, Any]:
    if indicator_type == "url":
        val = validate_and_normalize_url(indicator).normalized_url
    elif indicator_type == "ip":
        val = validate_ip_address(indicator)
    else:
        val = validate_domain(indicator)

    result = await query_urlhaus(indicator_type, val)
    db.record_integration_query(
        "urlhaus",
        result["status"],
        bool(result.get("matched")),
        None if result["status"] == "ok" else result.get("message"),
    )

    if result["status"] == "ok" and result.get("matched"):
        db.upsert_indicator(
            indicator_type=indicator_type,
            indicator_value=val,
            threat_category=result.get("threat_category") or "Malware URL",
            source="URLhaus",
            confidence_score=result.get("confidence_score") or 90,
            reputation="Malicious",
            raw_metadata=result.get("details", {}),
        )

    local_matches = db.list_indicators(search=val, limit=10)
    return {
        "provider_result": result,
        "local_ioc_matches": local_matches,
    }


@router.get("/abuseipdb")
async def abuseipdb_lookup(
    ip: str = Query(..., min_length=3, description="Public IPv4 or IPv6 address"),
    max_age_days: int = Query(default=90, ge=1, le=365),
) -> Dict[str, Any]:
    val = validate_ip_address(ip)
    result = await query_abuseipdb(val, max_age_days=max_age_days)
    db.record_integration_query(
        "abuseipdb",
        result["status"],
        bool(result.get("matched")),
        None if result["status"] == "ok" else result.get("message"),
    )

    if result["status"] == "ok" and result.get("matched"):
        db.upsert_indicator(
            indicator_type="ip",
            indicator_value=val,
            threat_category=result.get("threat_category") or "Abusive IP",
            source="AbuseIPDB",
            confidence_score=result.get("confidence_score") or 75,
            reputation="Malicious" if (result.get("confidence_score") or 0) >= 75 else "Suspicious",
            raw_metadata=result.get("details", {}),
        )

    local_matches = db.list_indicators(search=val, limit=10)
    return {
        "provider_result": result,
        "local_ioc_matches": local_matches,
    }


@router.get("/indicators")
async def list_threat_indicators(
    search: str = Query(default=""),
    indicator_type: str = Query(default="all"),
    source: str = Query(default="all"),
    limit: int = Query(default=100, ge=1, le=250),
) -> Dict[str, Any]:
    items = db.list_indicators(
        search=search, indicator_type=indicator_type, source=source, limit=limit
    )
    integrations = db.list_integrations()
    return {
        "items": items,
        "total": len(items),
        "integrations": integrations,
    }


@router.post("/indicators")
async def add_threat_indicator(payload: IndicatorCreateRequest) -> Dict[str, Any]:
    if payload.indicator_type == "url":
        val = validate_and_normalize_url(payload.indicator_value).normalized_url
    elif payload.indicator_type == "domain":
        val = validate_domain(payload.indicator_value)
    elif payload.indicator_type == "ip":
        val = validate_ip_address(payload.indicator_value)
    else:
        val = payload.indicator_value.strip().lower()

    saved = db.upsert_indicator(
        indicator_type=payload.indicator_type,
        indicator_value=val,
        threat_category=payload.threat_category,
        source=payload.source,
        confidence_score=payload.confidence_score,
        reputation=payload.reputation,
    )
    return saved
