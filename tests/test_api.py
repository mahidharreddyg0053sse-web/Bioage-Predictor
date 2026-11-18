"""
BioAge Pro — Backend REST API Smoke Tests
"""

import os
import requests

API_BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def test_health_endpoint():
    res = requests.get(f"{API_BASE}/api/health", timeout=10)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ONLINE"
    assert "BioAge Pro" in body["service"]


def test_bioage_calculate_endpoint():
    payload = {
        "chronologicalAge": 35,
        "gender": "female",
        "height": 168,
        "weight": 62,
        "restingHeartRate": 58,
        "bloodPressureSystolic": 114,
        "bloodPressureDiastolic": 74,
        "mediterraneanScore": "high",
        "ultraProcessedFood": "rare",
        "sugarIntake": "minimal",
        "dailyWater": "optimal",
        "intermittentFasting": "yes",
        "sleepDuration": "optimal",
        "sleepConsistency": "consistent",
        "sleepQuality": "refreshed",
        "cardioMinutes": "high",
        "strengthDays": "optimal",
        "dailySteps": "high",
        "sedentaryHours": "low",
        "smokingStatus": "never",
        "alcoholIntake": "none",
        "stressLevel": "low",
        "socialConnection": "strong",
        "hasLabs": "no",
    }
    res = requests.post(f"{API_BASE}/api/bioage/calculate", json=payload, timeout=10)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "result" in body
    assert "biologicalAge" in body["result"]
    assert body["result"]["biologicalAge"] > 0


def test_auth_login_valid_demo_user():
    res = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "alex@workplace.com", "password": "password123"},
        timeout=10,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["user"]["email"] == "alex@workplace.com"


def test_auth_login_invalid_credentials():
    res = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "alex@workplace.com", "password": "wrongpassword"},
        timeout=10,
    )
    assert res.status_code == 401
    assert "error" in res.json()


def test_bioage_history_fetch():
    res = requests.get(f"{API_BASE}/api/bioage/history/usr_elena", timeout=10)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert isinstance(body["history"], list)
