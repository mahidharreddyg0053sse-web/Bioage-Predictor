"""Unified Threat Intelligence Orchestrator Service."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from app.intelligence.abuseipdb import query_abuseipdb
from app.intelligence.base import build_provider_result
from app.intelligence.urlhaus import query_urlhaus
from app.intelligence.virustotal import query_virustotal


async def gather_threat_intelligence(
    normalized_url: str,
    domain: str,
    ip_address: Optional[str],
    is_ip_literal: bool = False,
) -> Dict[str, Dict[str, Any]]:
    """
    Query configured Threat Intelligence providers concurrently for the URL,
    domain, and resolved IP address.
    """
    vt_task = query_virustotal("url", normalized_url)
    urlhaus_url_task = query_urlhaus("url", normalized_url)
    urlhaus_host_task = query_urlhaus("domain" if not is_ip_literal else "ip", domain)

    if ip_address:
        abuse_task = query_abuseipdb(ip_address)
    else:
        async def _skipped_abuse() -> Dict[str, Any]:
            return build_provider_result(
                "AbuseIPDB",
                "skipped",
                indicator_type="ip",
                indicator_value=None,
                message="No public IP address resolved for domain; AbuseIPDB IP lookup skipped.",
            )
        abuse_task = _skipped_abuse()

    vt_res, uh_url_res, uh_host_res, abuse_res = await asyncio.gather(
        vt_task, urlhaus_url_task, urlhaus_host_task, abuse_task
    )

    # Combine URLhaus URL + Host lookup cleanly: prefer a positive match if either hit
    if uh_url_res.get("matched"):
        urlhaus_combined = uh_url_res
    elif uh_host_res.get("matched"):
        urlhaus_combined = uh_host_res
    else:
        urlhaus_combined = uh_url_res

    return {
        "virustotal": vt_res,
        "urlhaus": urlhaus_combined,
        "abuseipdb": abuse_res,
    }
