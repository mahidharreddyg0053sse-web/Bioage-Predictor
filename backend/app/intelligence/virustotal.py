"""VirusTotal v3 Threat Intelligence Client."""

from __future__ import annotations

import base64
from typing import Any, Dict
import httpx

from app.config import get_settings
from app.intelligence.base import build_provider_result

VT_BASE_URL = "https://www.virustotal.com/api/v3"


def _vt_url_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").rstrip("=")


async def query_virustotal(indicator_type: str, value: str) -> Dict[str, Any]:
    """
    Query VirusTotal v3 for a URL, domain, or IP address.
    Never reports 'not_configured' or 'unavailable' as a clean result.
    """
    settings = get_settings()
    if not settings.virustotal_configured:
        return build_provider_result(
            "VirusTotal",
            "not_configured",
            indicator_type=indicator_type,
            indicator_value=value,
            message="VirusTotal API key is not configured (set VIRUSTOTAL_API_KEY in backend .env). Result is unavailable — not treated as clean.",
        )

    headers = {
        "x-apikey": settings.virustotal_api_key.strip(),
        "Accept": "application/json",
    }

    if indicator_type == "url":
        endpoint = f"{VT_BASE_URL}/urls/{_vt_url_id(value)}"
    elif indicator_type == "domain":
        endpoint = f"{VT_BASE_URL}/domains/{value}"
    elif indicator_type == "ip":
        endpoint = f"{VT_BASE_URL}/ip_addresses/{value}"
    else:
        return build_provider_result(
            "VirusTotal",
            "error",
            indicator_type=indicator_type,
            indicator_value=value,
            message=f"Unsupported VirusTotal indicator type '{indicator_type}'.",
        )

    try:
        async with httpx.AsyncClient(timeout=settings.external_api_timeout_seconds) as client:
            resp = await client.get(endpoint, headers=headers)

        if resp.status_code == 404:
            return build_provider_result(
                "VirusTotal",
                "ok",
                indicator_type=indicator_type,
                indicator_value=value,
                matched=False,
                message="Indicator not found in VirusTotal database (no prior malicious detections indexed).",
            )

        if resp.status_code == 401 or resp.status_code == 403:
            return build_provider_result(
                "VirusTotal",
                "unavailable",
                indicator_type=indicator_type,
                indicator_value=value,
                message="VirusTotal authentication failed. Verify VIRUSTOTAL_API_KEY.",
            )

        if resp.status_code == 429:
            return build_provider_result(
                "VirusTotal",
                "rate_limited",
                indicator_type=indicator_type,
                indicator_value=value,
                message="VirusTotal API rate limit exceeded. Retry later.",
            )

        if resp.status_code >= 500:
            return build_provider_result(
                "VirusTotal",
                "unavailable",
                indicator_type=indicator_type,
                indicator_value=value,
                message=f"VirusTotal service returned HTTP {resp.status_code}.",
            )

        payload = resp.json()
        attrs = payload.get("data", {}).get("attributes", {})
        if not isinstance(attrs, dict):
            return build_provider_result(
                "VirusTotal",
                "error",
                indicator_type=indicator_type,
                indicator_value=value,
                message="Unexpected response structure from VirusTotal API.",
            )

        stats = attrs.get("last_analysis_stats", {}) or {}
        malicious = int(stats.get("malicious", 0) or 0)
        suspicious = int(stats.get("suspicious", 0) or 0)
        harmless = int(stats.get("harmless", 0) or 0)
        undetected = int(stats.get("undetected", 0) or 0)
        total = malicious + suspicious + harmless + undetected

        reputation = attrs.get("reputation")
        tags = [str(t) for t in (attrs.get("tags") or [])[:10]]
        categories = attrs.get("categories") or {}
        cat_values = list(categories.values()) if isinstance(categories, dict) else []
        matched = (malicious + suspicious) > 0

        threat_cat = None
        if malicious > 0:
            threat_cat = "Phishing / Malicious" if any("phish" in str(c).lower() for c in cat_values) else "Malicious"
        elif suspicious > 0:
            threat_cat = "Suspicious"

        confidence = min(100, int(((malicious * 1.0 + suspicious * 0.5) / max(total, 1)) * 100 * 5)) if matched else 0

        return build_provider_result(
            "VirusTotal",
            "ok",
            indicator_type=indicator_type,
            indicator_value=value,
            matched=matched,
            malicious_count=malicious,
            suspicious_count=suspicious,
            total_engines=total,
            reputation_score=int(reputation) if isinstance(reputation, (int, float)) else None,
            confidence_score=confidence,
            threat_category=threat_cat,
            tags=tags,
            details={
                "harmless": harmless,
                "undetected": undetected,
                "categories": categories,
                "last_analysis_date": attrs.get("last_analysis_date"),
            },
            message=(
                f"Flagged by {malicious} malicious and {suspicious} suspicious security vendors out of {total}."
                if matched
                else f"0 malicious detections across {total} VirusTotal security vendors."
            ),
        )
    except httpx.TimeoutException:
        return build_provider_result(
            "VirusTotal",
            "unavailable",
            indicator_type=indicator_type,
            indicator_value=value,
            message="VirusTotal API request timed out. Treated as unavailable, not clean.",
        )
    except Exception as exc:
        return build_provider_result(
            "VirusTotal",
            "unavailable",
            indicator_type=indicator_type,
            indicator_value=value,
            message=f"VirusTotal API unavailable: {exc.__class__.__name__}.",
        )
