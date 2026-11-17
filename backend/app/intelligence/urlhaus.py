"""URLhaus (abuse.ch) Threat Intelligence Client."""

from __future__ import annotations

from typing import Any, Dict
import httpx

from app.config import get_settings
from app.intelligence.base import build_provider_result

URLHAUS_URL_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/url/"
URLHAUS_HOST_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/host/"


async def query_urlhaus(indicator_type: str, value: str) -> Dict[str, Any]:
    """
    Query URLhaus API for a URL or host/domain/IP.
    Uses URLHAUS_API_KEY (Auth-Key header) when configured.
    Never treats unreachable or unconfigured API as a clean result.
    """
    settings = get_settings()
    if not settings.urlhaus_configured:
        return build_provider_result(
            "URLhaus",
            "not_configured",
            indicator_type=indicator_type,
            indicator_value=value,
            message="URLhaus Auth-Key is not configured (set URLHAUS_API_KEY in backend .env). Result is unavailable — not treated as clean.",
        )

    headers = {
        "Auth-Key": settings.urlhaus_api_key.strip(),
        "Accept": "application/json",
    }

    if indicator_type == "url":
        endpoint = URLHAUS_URL_ENDPOINT
        data = {"url": value}
    elif indicator_type in ("domain", "ip", "host"):
        endpoint = URLHAUS_HOST_ENDPOINT
        data = {"host": value}
    else:
        return build_provider_result(
            "URLhaus",
            "error",
            indicator_type=indicator_type,
            indicator_value=value,
            message=f"Unsupported URLhaus indicator type '{indicator_type}'.",
        )

    try:
        async with httpx.AsyncClient(timeout=settings.external_api_timeout_seconds) as client:
            resp = await client.post(endpoint, data=data, headers=headers)

        if resp.status_code in (401, 403):
            return build_provider_result(
                "URLhaus",
                "unavailable",
                indicator_type=indicator_type,
                indicator_value=value,
                message="URLhaus authentication failed. Verify URLHAUS_API_KEY.",
            )

        if resp.status_code == 429:
            return build_provider_result(
                "URLhaus",
                "rate_limited",
                indicator_type=indicator_type,
                indicator_value=value,
                message="URLhaus rate limit exceeded.",
            )

        if resp.status_code >= 500:
            return build_provider_result(
                "URLhaus",
                "unavailable",
                indicator_type=indicator_type,
                indicator_value=value,
                message=f"URLhaus API returned HTTP {resp.status_code}.",
            )

        payload = resp.json()
        if not isinstance(payload, dict):
            return build_provider_result(
                "URLhaus",
                "error",
                indicator_type=indicator_type,
                indicator_value=value,
                message="Invalid response payload from URLhaus.",
            )

        query_status = payload.get("query_status", "")
        if query_status == "no_results":
            return build_provider_result(
                "URLhaus",
                "ok",
                indicator_type=indicator_type,
                indicator_value=value,
                matched=False,
                message="No malicious URLs reported in URLhaus for this indicator.",
            )

        if query_status != "ok":
            return build_provider_result(
                "URLhaus",
                "error",
                indicator_type=indicator_type,
                indicator_value=value,
                message=f"URLhaus query returned status: {query_status}.",
            )

        if indicator_type == "url":
            threat = payload.get("threat") or "Malware Distribution"
            url_status = payload.get("url_status") or "unknown"
            tags = [str(t) for t in (payload.get("tags") or [])[:10]]
            return build_provider_result(
                "URLhaus",
                "ok",
                indicator_type="url",
                indicator_value=value,
                matched=True,
                malicious_count=1,
                total_engines=1,
                confidence_score=95 if url_status == "online" else 80,
                threat_category=str(threat),
                tags=tags,
                details={
                    "url_status": url_status,
                    "date_added": payload.get("date_added"),
                    "reporter": payload.get("reporter"),
                    "blacklists": payload.get("blacklists", {}),
                },
                message=f"Listed in URLhaus as '{threat}' (status: {url_status}).",
            )

        # Host lookup
        url_count = int(payload.get("url_count", 0) or 0)
        urls_list = payload.get("urls") or []
        online_count = sum(1 for u in urls_list if isinstance(u, dict) and u.get("url_status") == "online")
        tags = []
        for u in urls_list[:5]:
            if isinstance(u, dict) and u.get("tags"):
                tags.extend(u["tags"])
        dedup_tags = sorted(set(str(t) for t in tags))[:10]
        matched = url_count > 0

        return build_provider_result(
            "URLhaus",
            "ok",
            indicator_type=indicator_type,
            indicator_value=value,
            matched=matched,
            malicious_count=url_count,
            total_engines=1,
            confidence_score=min(98, 65 + url_count * 5) if matched else 0,
            threat_category="Malicious Host" if matched else None,
            tags=dedup_tags,
            details={
                "url_count": url_count,
                "online_urls": online_count,
                "blacklists": payload.get("blacklists", {}),
                "firstseen": payload.get("firstseen"),
            },
            message=(
                f"Host associated with {url_count} malicious URL(s) in URLhaus ({online_count} currently online)."
                if matched
                else "Host has no malicious URL records in URLhaus."
            ),
        )
    except httpx.TimeoutException:
        return build_provider_result(
            "URLhaus",
            "unavailable",
            indicator_type=indicator_type,
            indicator_value=value,
            message="URLhaus API request timed out. Treated as unavailable, not clean.",
        )
    except Exception as exc:
        return build_provider_result(
            "URLhaus",
            "unavailable",
            indicator_type=indicator_type,
            indicator_value=value,
            message=f"URLhaus API unavailable: {exc.__class__.__name__}.",
        )
