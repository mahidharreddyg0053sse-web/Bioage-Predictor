"""Shared utilities and normalized response builder for Threat Intelligence providers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_provider_result(
    provider: str,
    status: str,
    *,
    indicator_type: Optional[str] = None,
    indicator_value: Optional[str] = None,
    matched: bool = False,
    malicious_count: int = 0,
    suspicious_count: int = 0,
    total_engines: int = 0,
    reputation_score: Optional[int] = None,
    confidence_score: Optional[int] = None,
    threat_category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    details: Optional[Dict[str, Any]] = None,
    message: str = "",
) -> Dict[str, Any]:
    return {
        "provider": provider,
        "status": status,
        "indicator_type": indicator_type,
        "indicator_value": indicator_value,
        "matched": matched,
        "malicious_count": malicious_count,
        "suspicious_count": suspicious_count,
        "total_engines": total_engines,
        "reputation_score": reputation_score,
        "confidence_score": confidence_score,
        "threat_category": threat_category,
        "tags": tags or [],
        "details": details or {},
        "message": message,
        "checked_at": utc_now_iso(),
    }
