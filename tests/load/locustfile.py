"""
Locust Load Testing Scenarios for PhishGuard FastAPI Backend.

Profiles:
  - PhishGuardNormalUser: Simulates steady normal SOC analyst traffic across
    health, dashboard, analytics, scan history, feature extraction, ML scans,
    threat correlation, indicators, reports, and settings.
  - PhishGuardHeavyUser: Simulates high-concurrency heavy burst traffic to test
    throughput, latency tail (p95/p99), and error rate under stress.

Usage:
  locust -f tests/load/locustfile.py PhishGuardNormalUser --headless \
      --host http://127.0.0.1:8000 --users 15 --spawn-rate 5 --run-time 30s
"""

from __future__ import annotations

import itertools
from locust import HttpUser, between, task

SAMPLE_URLS = [
    "https://github.com/openai/openai-python",
    "https://www.python.org/downloads/",
    "http://login-security.xyz/account/verify",
    "http://paypal-verify-account.top/signin",
    "https://docs.fastapi.tiangolo.com/",
    "http://secure-bank-update.info/login?session=verify",
]

_url_cycle = itertools.cycle(SAMPLE_URLS)


def _next_url() -> str:
    return next(_url_cycle)


class PhishGuardNormalUser(HttpUser):
    """Simulates realistic normal concurrent user traffic against PhishGuard."""

    wait_time = between(0.4, 1.2)

    @task(4)
    def check_health(self) -> None:
        with self.client.get("/api/health", name="GET /api/health", catch_response=True) as resp:
            if resp.status_code != 200 or resp.json().get("status") != "online":
                resp.failure(f"Unexpected health response: {resp.status_code}")

    @task(3)
    def load_dashboard(self) -> None:
        with self.client.get("/api/dashboard", name="GET /api/dashboard", catch_response=True) as resp:
            if resp.status_code != 200 or "summary" not in resp.json():
                resp.failure(f"Dashboard payload invalid: {resp.status_code}")

    @task(3)
    def load_analytics(self) -> None:
        with self.client.get("/api/analytics", name="GET /api/analytics", catch_response=True) as resp:
            if resp.status_code != 200 or "threat_overview" not in resp.json():
                resp.failure(f"Analytics payload invalid: {resp.status_code}")

    @task(3)
    def browse_scan_history(self) -> None:
        with self.client.get(
            "/api/scan/history?page=1&page_size=10",
            name="GET /api/scan/history",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or "items" not in resp.json():
                resp.failure(f"History payload invalid: {resp.status_code}")

    @task(3)
    def extract_url_features(self) -> None:
        url = _next_url()
        with self.client.post(
            "/api/scan/features",
            json={"url": url},
            name="POST /api/scan/features",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or resp.json().get("feature_count") != 28:
                resp.failure(f"Feature extraction failed: {resp.status_code}")

    @task(2)
    def execute_ml_url_scan(self) -> None:
        url = _next_url()
        with self.client.post(
            "/api/scan",
            json={"url": url, "resolve_dns": False},
            name="POST /api/scan",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or "risk_score" not in resp.json():
                resp.failure(f"URL scan failed: {resp.status_code}")

    @task(2)
    def run_threat_correlation(self) -> None:
        url = _next_url()
        with self.client.post(
            "/api/threat-correlation",
            json={"url": url, "resolve_dns": False},
            name="POST /api/threat-correlation",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or "combined_risk_score" not in resp.json():
                resp.failure(f"Threat correlation failed: {resp.status_code}")

    @task(2)
    def list_indicators(self) -> None:
        with self.client.get(
            "/api/threat-intelligence/indicators?limit=25",
            name="GET /api/threat-intelligence/indicators",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200 or "items" not in resp.json():
                resp.failure(f"Indicators query failed: {resp.status_code}")

    @task(1)
    def list_reports_and_settings(self) -> None:
        with self.client.get("/api/reports", name="GET /api/reports", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Reports list failed: {resp.status_code}")
        with self.client.get("/api/settings", name="GET /api/settings", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Settings fetch failed: {resp.status_code}")


class PhishGuardHeavyUser(HttpUser):
    """Simulates heavy concurrent burst traffic across high-frequency API endpoints."""

    wait_time = between(0.1, 0.35)

    @task(5)
    def burst_health(self) -> None:
        with self.client.get("/api/health", name="GET /api/health", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Health failed under load: {resp.status_code}")

    @task(4)
    def burst_feature_extraction(self) -> None:
        with self.client.post(
            "/api/scan/features",
            json={"url": _next_url()},
            name="POST /api/scan/features",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Features failed under load: {resp.status_code}")

    @task(3)
    def burst_scan_history(self) -> None:
        with self.client.get(
            "/api/scan/history?page=1&page_size=10",
            name="GET /api/scan/history",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"History failed under load: {resp.status_code}")

    @task(2)
    def burst_analytics(self) -> None:
        with self.client.get("/api/analytics", name="GET /api/analytics", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Analytics failed under load: {resp.status_code}")

    @task(2)
    def burst_full_scan(self) -> None:
        with self.client.post(
            "/api/scan",
            json={"url": _next_url(), "resolve_dns": False},
            name="POST /api/scan",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Scan failed under load: {resp.status_code}")
