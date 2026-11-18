"""
BioAge Pro — OWASP Top 10 Non-Destructive Security Control Tests
"""

import os
import requests

API_BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def test_security_headers_present():
    res = requests.get(f"{API_BASE}/api/health", timeout=10)
    assert res.status_code == 200
    headers = {k.lower(): v for k, v in res.headers.items()}
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert "referrer-policy" in headers
    assert "x-powered-by" not in headers


def test_sensitive_files_and_backend_blocked():
    sensitive_paths = [
        "/.env",
        "/backend/.env",
        "/backend/server.js",
        "/backend/database/data/database.json",
        "/package.json",
        "/.git/config",
    ]
    for path in sensitive_paths:
        res = requests.get(f"{API_BASE}{path}", timeout=10)
        assert res.status_code in (403, 404), f"Sensitive path {path} returned {res.status_code}"


def test_auth_missing_credentials_rejected():
    res = requests.post(f"{API_BASE}/api/auth/login", json={}, timeout=10)
    assert res.status_code == 400


def test_auth_sql_injection_payload_rejected():
    res = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "' OR '1'='1", "password": "' OR '1'='1"},
        timeout=10,
    )
    assert res.status_code in (400, 401, 404)
    assert res.json().get("success") is not True


def test_registration_weak_password_rejected():
    res = requests.post(
        f"{API_BASE}/api/auth/register/send-otp",
        json={
            "name": "Security Test User",
            "email": "weakpass_test@example.com",
            "password": "123",
        },
        timeout=10,
    )
    assert res.status_code == 400


def test_bioage_calculate_handles_malicious_strings_safely():
    payload = {
        "chronologicalAge": 30,
        "gender": "<script>alert(1)</script>",
        "height": 170,
        "weight": 70,
        "restingHeartRate": 68,
        "bloodPressureSystolic": 120,
        "bloodPressureDiastolic": 80,
    }
    res = requests.post(f"{API_BASE}/api/bioage/calculate", json=payload, timeout=10)
    assert res.status_code == 200
    assert "<script>" not in res.text
