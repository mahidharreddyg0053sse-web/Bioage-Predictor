"""
Non-destructive Application Security & OWASP Top 10 Verification Tests for PhishGuard.

Tests run directly against the in-process FastAPI ASGI application (owned by this repo)
using safe, non-destructive test inputs to verify protection against:
  - SQL Injection (OWASP A03)
  - Cross-Site Scripting / XSS (OWASP A03)
  - Server-Side Request Forgery / SSRF & Dangerous URI Schemes (OWASP A10)
  - Exposed Credentials & Secret Leakage (OWASP A02 / A05)
  - Security Headers & Misconfigurations (OWASP A05)
  - API Rate Limiting Controls (OWASP A04)
"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.seed import seed_database_if_empty  # noqa: E402
from app.main import app  # noqa: E402
from app.ml.predictor import predictor  # noqa: E402
from app.security import InMemoryRateLimiter  # noqa: E402

pytestmark = [pytest.mark.security]


def _run_async(coro):
    return asyncio.run(coro)


async def _make_client():
    predictor.ensure_loaded()
    seed_database_if_empty()
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


SQLI_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1--",
    "'; DROP TABLE scan_history;--",
    "' UNION SELECT sql FROM sqlite_master--",
    "1' AND (SELECT COUNT(*) FROM profiles) > 0--",
]

XSS_PAYLOADS = [
    "<script>alert(1)</script>",
    "\"><img src=x onerror=alert(1)>",
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "https://example.com/?q=<script>alert(1)</script>",
]

SSRF_AND_SCHEME_PAYLOADS = [
    "http://127.0.0.1/admin",
    "http://localhost:8000/api/settings",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/internal",
    "http://192.168.1.1/router",
    "http://0.0.0.0/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "ftp://example.com/file.txt",
]


def test_sql_injection_protection_on_search_and_lookup_endpoints():
    """Verify SQLi payloads never cause 500s, SQL syntax errors, or database tampering."""

    async def _check():
        async with await _make_client() as client:
            baseline = await client.get("/api/scan/history?page=1&page_size=5")
            assert baseline.status_code == 200
            baseline_total = baseline.json()["total"]
            assert baseline_total > 0

            for payload in SQLI_PAYLOADS:
                # 1. Scan history search query
                r_hist = await client.get("/api/scan/history", params={"search": payload})
                assert r_hist.status_code == 200
                body_lower = r_hist.text.lower()
                assert "sqlite" not in body_lower
                assert "syntax error" not in body_lower
                assert "traceback" not in body_lower
                # Must NOT return all rows via boolean tautology
                assert r_hist.json()["total"] == 0

                # 2. Threat indicators search query
                r_ioc = await client.get(
                    "/api/threat-intelligence/indicators", params={"search": payload}
                )
                assert r_ioc.status_code == 200
                assert r_ioc.json()["total"] == 0

                # 3. Direct scan ID lookup with SQLi string
                r_id = await client.get(f"/api/scan/{payload}")
                assert r_id.status_code in (400, 404, 422)

            # Confirm scan_history table was NOT dropped or modified
            after = await client.get("/api/scan/history?page=1&page_size=5")
            assert after.status_code == 200
            assert after.json()["total"] == baseline_total

    _run_async(_check())


def test_xss_protection_and_strict_json_content_type():
    """Verify dangerous XSS schemes are rejected and JSON responses prevent HTML sniffing."""

    async def _check():
        async with await _make_client() as client:
            # Dangerous URI schemes must be rejected with 400
            for bad_scheme in ("javascript:alert(1)", "data:text/html,<script>alert(1)</script>"):
                r = await client.post("/api/scan", json={"url": bad_scheme, "resolve_dns": False})
                assert r.status_code == 400

            # Query parameters with XSS payloads must always return strict application/json + nosniff
            for payload in XSS_PAYLOADS:
                r = await client.get("/api/scan/history", params={"search": payload})
                assert r.status_code == 200
                assert r.headers.get("content-type", "").startswith("application/json")
                assert r.headers.get("x-content-type-options") == "nosniff"

            # Feature extraction on URL containing script tag returns JSON only (never HTML)
            r_feat = await client.post(
                "/api/scan/features",
                json={"url": "https://example.com/?q=%3Cscript%3Ealert(1)%3C/script%3E"},
            )
            assert r_feat.status_code == 200
            assert r_feat.headers.get("content-type", "").startswith("application/json")
            assert r_feat.headers.get("x-content-type-options") == "nosniff"

    _run_async(_check())


def test_ssrf_and_dangerous_url_scheme_blocking():
    """Verify SSRF guard blocks loopback, private RFC1918, cloud metadata, and non-HTTP schemes."""

    async def _check():
        async with await _make_client() as client:
            for target in SSRF_AND_SCHEME_PAYLOADS:
                r_scan = await client.post("/api/scan", json={"url": target, "resolve_dns": False})
                assert r_scan.status_code == 400, f"SSRF/scheme payload was NOT blocked: {target}"

                r_feat = await client.post("/api/scan/features", json={"url": target})
                assert r_feat.status_code == 400, f"Feature endpoint allowed blocked URL: {target}"

            # Private IP queries on AbuseIPDB endpoint must also be blocked
            for private_ip in ("127.0.0.1", "10.0.0.5", "192.168.0.1", "169.254.169.254"):
                r_ip = await client.get(
                    "/api/threat-intelligence/abuseipdb", params={"ip": private_ip}
                )
                assert r_ip.status_code == 400, f"Private IP was NOT blocked: {private_ip}"

    _run_async(_check())


def test_security_headers_and_error_handling_misconfiguration():
    """Verify OWASP recommended HTTP security headers and no stack-trace disclosure."""

    async def _check():
        async with await _make_client() as client:
            for endpoint in ("/api/health", "/api/analytics", "/api/settings", "/api/reports"):
                resp = await client.get(endpoint)
                assert resp.status_code == 200
                assert resp.headers.get("x-content-type-options") == "nosniff"
                assert resp.headers.get("x-frame-options") == "DENY"
                assert resp.headers.get("referrer-policy") == "no-referrer"

            # Non-existent scan must return structured JSON 404 without stack trace
            r_404 = await client.get("/api/scan/nonexistent-scan-id-0000")
            assert r_404.status_code == 404
            assert "traceback" not in r_404.text.lower()
            assert "file \"" not in r_404.text.lower()

    _run_async(_check())


def test_no_exposed_credentials_in_api_or_frontend_code():
    """Verify API responses and frontend source never leak backend secrets or hardcoded keys."""

    async def _check():
        async with await _make_client() as client:
            r = await client.get("/api/settings")
            assert r.status_code == 200
            payload_text = r.text
            for secret_key in (
                "supabase_service_role_key",
                "virustotal_api_key",
                "urlhaus_api_key",
                "abuseipdb_api_key",
            ):
                assert secret_key not in payload_text.lower()

    _run_async(_check())

    # Scan frontend source files for accidental backend secret references or hardcoded keys
    secret_patterns = [
        re.compile(r"SUPABASE_SERVICE_ROLE_KEY", re.IGNORECASE),
        re.compile(r"VIRUSTOTAL_API_KEY\s*=\s*['\"][A-Za-z0-9_-]{16,}['\"]"),
        re.compile(r"ABUSEIPDB_API_KEY\s*=\s*['\"][A-Za-z0-9_-]{16,}['\"]"),
        re.compile(r"BEGIN\s+(RSA|EC|OPENSSH)\s+PRIVATE\s+KEY"),
        re.compile(r"ghp_[A-Za-z0-9]{36}"),
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ]

    for src_file in FRONTEND_SRC.rglob("*"):
        if src_file.is_file() and src_file.suffix in (".js", ".jsx", ".ts", ".tsx", ".json", ".html"):
            content = src_file.read_text(encoding="utf-8", errors="ignore")
            for pattern in secret_patterns:
                assert not pattern.search(content), (
                    f"Potential secret pattern '{pattern.pattern}' found in {src_file}"
                )


def test_rate_limiter_enforces_http_429():
    """Verify sliding-window rate limiter blocks excessive requests with HTTP 429."""
    limiter = InMemoryRateLimiter(max_requests_per_minute=3)
    fake_request = SimpleNamespace(client=SimpleNamespace(host="203.0.113.10"))

    limiter.check(fake_request)
    limiter.check(fake_request)
    limiter.check(fake_request)

    with pytest.raises(HTTPException) as exc_info:
        limiter.check(fake_request)
    assert exc_info.value.status_code == 429
