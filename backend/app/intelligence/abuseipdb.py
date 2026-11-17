"""AbuseIPDB v2 Threat Intelligence Client."""

from __future__ import annotations

from typing import Any, Dict
import httpx

from app.config import get_settings
from app.intelligence.base import build_provider_result

ABUSEIPDB_CHECK_ENDPOINT = "https://api.abuseipdb.com/api/v2/check"


async def query_abuseipdb(ip_address: str, max_age_days: int = 90) -> Dict[str, Any]:
    """
    Query AbuseIPDB v2 for IP address reputation and abuse confidence score.
    Never reports unavailable/unconfigured status as a clean result.
    """
    settings = get_settings()
    if not settings.abuseipdb_configured:
        return build_provider_result(
            "AbuseIPDB",
            "not_configured",
            indicator_type="ip",
            indicator_value=ip_address,
            message="AbuseIPDB API key is not configured (set ABUSEIPDB_API_KEY in backend .env). Result is unavailable — not treated as clean.",
        )

    headers = {
        "Key": settings.abuseipdb_api_key.strip(),
        "Accept": "application/json",
    }
    params = {
        "ipAddress": ip_address,
        "maxAgeInDays": str(max_age_days),
        "verbose": "",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.external_api_timeout_seconds) as client:
            resp = await client.get(ABUSEIPDB_CHECK_ENDPOINT, headers=headers, params=params)

        if resp.status_code in (401, 403):
            return build_provider_result(
                "AbuseIPDB",
                "unavailable",
                indicator_type="ip",
                indicator_value=ip_address,
                message="AbuseIPDB authentication failed. Verify ABUSEIPDB_API_KEY.",
            )

        if resp.status_code == 429:
            return build_provider_result(
                "AbuseIPDB",
                "rate_limited",
                indicator_type="ip",
                indicator_value=ip_address,
                message="AbuseIPDB daily rate limit exceeded.",
            )

        if resp.status_code >= 500:
            return build_provider_result(
                "AbuseIPDB",
                "unavailable",
                indicator_type="ip",
                indicator_value=ip_address,
                message=f"AbuseIPDB returned HTTP {resp.status_code}.",
            )

        payload = resp.json()
        data = payload.get("data", {})
        if not isinstance(data, dict) or "abuseConfidenceScore" not in data:
            return build_provider_result(
                "AbuseIPDB",
                "error",
                indicator_type="ip",
                indicator_value=ip_address,
                message="Unexpected response format from AbuseIPDB.",
            )

        score = int(data.get("abuseConfidenceScore", 0) or 0)
        total_reports = int(data.get("totalReports", 0) or 0)
        distinct_users = int(data.get("numDistinctUsers", 0) or 0)
        matched = score >= 25 or total_reports >= 3

        threat_cat = None
        if score >= 75:
            threat_cat = "High-Risk Abusive IP"
        elif score >= 25:
            threat_cat = "Suspicious IP"

        return build_provider_result(
            "AbuseIPDB",
            "ok",
            indicator_type="ip",
            indicator_value=ip_address,
            matched=matched,
            malicious_count=total_reports if matched else 0,
            total_engines=max(distinct_users, 1),
            reputation_score=100 - score,
            confidence_score=score,
            threat_category=threat_cat,
            tags=[t for t in [data.get("usageType"), data.get("countryCode")] if t],
            details={
                "abuse_confidence_score": score,
                "total_reports": total_reports,
                "num_distinct_users": distinct_users,
                "country_code": data.get("countryCode"),
                "isp": data.get("isp"),
                "domain": data.get("domain"),
                "is_tor": bool(data.get("isTor", False)),
                "is_whitelisted": bool(data.get("isWhitelisted", False)),
                "last_reported_at": data.get("lastReportedAt"),
            },
            message=(
                f"Abuse confidence {score}% across {total_reports} report(s) from {distinct_users} distinct reporter(s)."
                if total_reports > 0
                else "No abuse reports found in AbuseIPDB within the last 90 days."
            ),
        )
    except httpx.TimeoutException:
        return build_provider_result(
            "AbuseIPDB",
            "unavailable",
            indicator_type="ip",
            indicator_value=ip_address,
            message="AbuseIPDB request timed out. Treated as unavailable, not clean.",
        )
    except Exception as exc:
        return build_provider_result(
            "AbuseIPDB",
            "unavailable",
            indicator_type="ip",
            indicator_value=ip_address,
            message=f"AbuseIPDB API unavailable: {exc.__class__.__name__}.",
        )
