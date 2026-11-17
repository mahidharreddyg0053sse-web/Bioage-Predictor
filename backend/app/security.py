"""Security utilities: URL validation, SSRF protection, safe DNS lookup, and rate limiting."""

from __future__ import annotations

import ipaddress
import re
import socket
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Optional, Tuple
from urllib.parse import urlparse

from fastapi import HTTPException, Request, status

MAX_URL_LENGTH = 2048
ALLOWED_SCHEMES = {"http", "https"}

# Blocked hostnames to prevent SSRF / internal network probing
BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",
    "0.0.0.0",
}

HOSTNAME_PATTERN = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.?$"
)


@dataclass
class ValidatedTarget:
    original_url: str
    normalized_url: str
    scheme: str
    hostname: str
    port: Optional[int]
    path: str
    query: str
    is_ip_literal: bool


def is_private_or_reserved_ip(ip_str: str) -> bool:
    """Return True if the IP is private, loopback, link-local, multicast, or reserved."""
    try:
        ip_obj = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )


def validate_and_normalize_url(raw_url: str) -> ValidatedTarget:
    """
    Validate user-supplied URL and enforce SSRF protections.
    - Never fetches the target URL directly.
    - Rejects non-HTTP(S) schemes (file://, javascript:, data:, ftp:, etc.).
    - Rejects private/loopback/link-local/cloud-metadata IP literals and localhost.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid URL is required.",
        )

    cleaned = raw_url.strip()
    if len(cleaned) > MAX_URL_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"URL exceeds maximum allowed length of {MAX_URL_LENGTH} characters.",
        )

    if any(ch in cleaned for ch in ("\r", "\n", "\t", "\x00", " ")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL contains invalid whitespace or control characters.",
        )

    # Reject explicit dangerous schemes before auto-prepending http://
    scheme_match = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):", cleaned)
    if scheme_match:
        scheme = scheme_match.group(1).lower()
        if scheme not in ALLOWED_SCHEMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported URL scheme '{scheme}'. Only http and https are allowed.",
            )
        candidate = cleaned
    else:
        candidate = f"http://{cleaned}"

    parsed = urlparse(candidate)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only http:// and https:// URLs are permitted.",
        )

    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must contain a valid hostname or IP address.",
        )

    # Reject explicit localhost / metadata hostnames
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Internal, loopback, or metadata hostnames are blocked for security.",
        )

    # Validate IP literal vs domain hostname
    is_ip_literal = False
    try:
        ip_obj = ipaddress.ip_address(hostname)
        is_ip_literal = True
        if is_private_or_reserved_ip(str(ip_obj)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scanning private, loopback, or reserved IP addresses is blocked (SSRF protection).",
            )
    except ValueError:
        if "." not in hostname or not HOSTNAME_PATTERN.match(hostname):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hostname format is invalid. Provide a valid domain (e.g., https://example.com).",
            )

    try:
        port = parsed.port
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL contains an invalid port number.",
        )

    normalized_path = parsed.path or ""
    normalized_query = parsed.query or ""
    port_part = f":{port}" if port and not ((parsed.scheme == "http" and port == 80) or (parsed.scheme == "https" and port == 443)) else ""
    query_part = f"?{normalized_query}" if normalized_query else ""
    normalized_url = f"{parsed.scheme.lower()}://{hostname}{port_part}{normalized_path}{query_part}"

    return ValidatedTarget(
        original_url=cleaned,
        normalized_url=normalized_url,
        scheme=parsed.scheme.lower(),
        hostname=hostname,
        port=port,
        path=normalized_path,
        query=normalized_query,
        is_ip_literal=is_ip_literal,
    )


def validate_ip_address(ip_str: str) -> str:
    """Validate a public IPv4/IPv6 address for AbuseIPDB / TI lookups."""
    cleaned = (ip_str or "").strip()
    try:
        ip_obj = ipaddress.ip_address(cleaned)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IP address format.",
        )
    if is_private_or_reserved_ip(str(ip_obj)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Private, loopback, or reserved IP addresses cannot be queried.",
        )
    return str(ip_obj)


def validate_domain(domain: str) -> str:
    """Validate a domain name for Threat Intelligence lookups."""
    cleaned = (domain or "").strip().lower().rstrip(".")
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        cleaned = (urlparse(cleaned).hostname or "").strip().lower().rstrip(".")
    if not cleaned or cleaned in BLOCKED_HOSTNAMES or "." not in cleaned or not HOSTNAME_PATTERN.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain name.",
        )
    return cleaned


def safe_resolve_ip(hostname: str, timeout_seconds: float = 2.0) -> Tuple[Optional[str], Optional[str]]:
    """
    Safely resolve a hostname to an IPv4 address without fetching the target URL.
    Returns (ip_address, warning_message). Blocks private/internal IPs if resolved.
    """
    try:
        ipaddress.ip_address(hostname)
        if is_private_or_reserved_ip(hostname):
            return None, "Resolved IP is private/reserved and blocked."
        return hostname, None
    except ValueError:
        pass

    prev_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(timeout_seconds)
        infos = socket.getaddrinfo(hostname, None, family=socket.AF_INET)
        for info in infos:
            resolved_ip = info[4][0]
            if is_private_or_reserved_ip(resolved_ip):
                return None, "Hostname resolves to a private/internal IP (blocked by SSRF guard)."
            return resolved_ip, None
    except (socket.gaierror, socket.timeout, OSError):
        return None, "DNS resolution unavailable or domain did not resolve."
    finally:
        socket.setdefaulttimeout(prev_timeout)
    return None, None


class InMemoryRateLimiter:
    """Sliding-window rate limiter per client IP."""

    def __init__(self, max_requests_per_minute: int = 120):
        self.max_requests = max_requests_per_minute
        self.window_seconds = 60.0
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = self._hits[client_ip]
        cutoff = now - self.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please retry in a few seconds.",
            )
        bucket.append(now)
