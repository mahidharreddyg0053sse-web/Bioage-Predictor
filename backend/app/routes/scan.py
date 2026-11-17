"""URL Scanner and Scan History API endpoints."""

from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.correlation.engine import correlate_threat_intelligence
from app.database.db import db
from app.intelligence.service import gather_threat_intelligence
from app.ml.feature_extractor import extract_url_features
from app.ml.predictor import predictor
from app.models.schemas import FeaturesRequest, ScanRequest
from app.security import safe_resolve_ip, validate_and_normalize_url

router = APIRouter(prefix="/api/scan", tags=["URL Scanner"])


@router.post("/features")
async def extract_features_endpoint(payload: FeaturesRequest) -> Dict[str, Any]:
    """Validate URL and return all extracted lexical/structural features and signals."""
    target = validate_and_normalize_url(payload.url)
    features, signals = extract_url_features(target.normalized_url)
    return {
        "url": target.original_url,
        "normalized_url": target.normalized_url,
        "domain": target.hostname,
        "scheme": target.scheme,
        "feature_count": len(features),
        "features": features,
        "feature_signals": signals,
    }


@router.post("")
async def scan_url_endpoint(payload: ScanRequest) -> Dict[str, Any]:
    """
    Full end-to-end URL Scan:
    1. Validate URL & enforce SSRF protection
    2. Extract URL features
    3. Run Random Forest ML prediction
    4. Safely resolve domain IP (without fetching URL)
    5. Query external Threat Intelligence APIs (VirusTotal, URLhaus, AbuseIPDB)
    6. Correlate ML + External TI with deduplication
    7. Persist scan + correlation records to database
    """
    target = validate_and_normalize_url(payload.url)

    # Run ML inference
    ml_res = predictor.predict(target.normalized_url)

    # Safe DNS resolution
    ip_address: Optional[str] = None
    dns_note: Optional[str] = None
    if payload.resolve_dns:
        ip_address, dns_note = safe_resolve_ip(target.hostname)
    elif target.is_ip_literal:
        ip_address = target.hostname

    # Query Threat Intelligence providers
    provider_results = await gather_threat_intelligence(
        normalized_url=target.normalized_url,
        domain=target.hostname,
        ip_address=ip_address,
        is_ip_literal=target.is_ip_literal,
    )

    # Track live integration query counts & status
    for pkey, pres in provider_results.items():
        if pres.get("status") != "skipped":
            err = None if pres.get("status") == "ok" else pres.get("message")
            db.record_integration_query(pkey, pres.get("status", "unavailable"), bool(pres.get("matched")), err)

    # Run Threat Correlation Engine
    corr = correlate_threat_intelligence(
        normalized_url=target.normalized_url,
        domain=target.hostname,
        ip_address=ip_address,
        ml_result=ml_res,
        provider_results=provider_results,
        persist=False,
    )

    detection_source = (
        "ML + Threat Correlation"
        if corr["independent_evidence_count"] > 0
        else "Random Forest ML"
    )

    saved_scan = db.save_scan({
        "url": target.original_url,
        "normalized_url": target.normalized_url,
        "domain": target.hostname,
        "ip_address": ip_address,
        "classification": corr["final_classification"],
        "risk_score": corr["combined_risk_score"],
        "ml_prediction": ml_res["prediction"],
        "ml_confidence": ml_res["confidence"],
        "detection_source": detection_source,
        "threat_category": corr["threat_category"],
        "extracted_features": ml_res["features"],
        "virustotal_result": provider_results["virustotal"],
        "urlhaus_result": provider_results["urlhaus"],
        "abuseipdb_result": provider_results["abuseipdb"],
        "detection_reasons": corr["detection_reasons"],
        "recommendations": corr["recommendations"],
    })

    corr["scan_id"] = saved_scan["id"]
    saved_corr = db.save_correlation(corr)
    corr["id"] = saved_corr["id"]
    corr["correlated_at"] = saved_corr["correlated_at"]

    return {
        **saved_scan,
        "ml_phishing_probability": ml_res["phishing_probability"],
        "feature_signals": ml_res["feature_signals"],
        "top_contributors": ml_res["top_contributors"],
        "model_info": ml_res["model_info"],
        "dns_note": dns_note,
        "correlation": corr,
    }


@router.get("/history")
async def get_scan_history(
    search: str = Query(default="", description="Filter by URL, domain, or threat category"),
    classification: str = Query(default="all", description="Filter by classification"),
    min_risk: Optional[int] = Query(default=None, ge=0, le=100),
    max_risk: Optional[int] = Query(default=None, ge=0, le=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
) -> Dict[str, Any]:
    items, total = db.list_scans(
        search=search,
        classification=classification,
        min_risk=min_risk,
        max_risk=max_risk,
        page=page,
        page_size=page_size,
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{scan_id}")
async def get_scan_detail(scan_id: str) -> Dict[str, Any]:
    scan = db.get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found.",
        )
    _, signals = extract_url_features(scan["normalized_url"])
    correlation = db.get_correlation_by_scan_id(scan_id)
    return {
        **scan,
        "feature_signals": signals,
        "correlation": correlation,
    }


@router.delete("/{scan_id}")
async def delete_scan_record(scan_id: str) -> Dict[str, Any]:
    deleted = db.delete_scan(scan_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found.",
        )
    return {"deleted": True, "id": scan_id}
