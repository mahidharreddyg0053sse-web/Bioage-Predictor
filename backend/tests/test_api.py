"""End-to-end backend API & security verification tests for PhishGuard."""

import asyncio
import sys
from pathlib import Path
import httpx

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.seed import seed_database_if_empty
from app.main import app
from app.ml.predictor import predictor


async def _run_full_workflow():
    predictor.ensure_loaded()
    seed_database_if_empty()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health check
        r = await client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "online"

        # 2. Dashboard & Analytics from real DB records
        r = await client.get("/api/analytics")
        assert r.status_code == 200
        data = r.json()
        assert data["summary"]["total_urls_scanned"] > 0
        assert len(data["daily_activity"]) == 7
        assert len(data["threat_overview"]) == 4

        # 3. Feature extraction
        r = await client.post("/api/scan/features", json={"url": "http://paypal-verify-login.xyz/account/confirm"})
        assert r.status_code == 200
        fdata = r.json()
        assert fdata["feature_count"] == 28
        assert fdata["features"]["has_suspicious_tld"] == 1.0
        assert fdata["features"]["brand_impersonation_signal"] == 1.0

        # 4. SSRF & Input Validation Guards
        for bad_url in [
            "http://127.0.0.1/admin",
            "http://localhost:8000/secret",
            "http://169.254.169.254/latest/meta-data",
            "http://10.0.0.1/internal",
            "javascript:alert(1)",
            "file:///etc/passwd",
        ]:
            resp = await client.post("/api/scan", json={"url": bad_url, "resolve_dns": False})
            assert resp.status_code == 400, f"Expected 400 for {bad_url}, got {resp.status_code}"

        # 5. Legitimate URL Scan
        r_safe = await client.post("/api/scan", json={"url": "https://github.com/openai/openai-python", "resolve_dns": False})
        assert r_safe.status_code == 200
        safe_data = r_safe.json()
        assert safe_data["classification"] == "Safe"
        assert safe_data["ml_prediction"] == "legitimate"
        assert safe_data["risk_score"] < 34
        # Unconfigured APIs must NOT claim status == 'ok'
        assert safe_data["virustotal_result"]["status"] != "ok"

        # 6. Phishing / Malicious URL Scan + Correlation
        r_phish = await client.post("/api/scan", json={"url": "http://login-security.xyz", "resolve_dns": False})
        assert r_phish.status_code == 200
        phish_data = r_phish.json()
        assert phish_data["classification"] in ("Phishing", "Malicious")
        assert phish_data["risk_score"] >= 62
        scan_id = phish_data["id"]

        # 7. Scan Detail & History
        r_detail = await client.get(f"/api/scan/{scan_id}")
        assert r_detail.status_code == 200
        assert r_detail.json()["id"] == scan_id

        r_hist = await client.get("/api/scan/history?search=login-security&page=1&page_size=5")
        assert r_hist.status_code == 200
        assert r_hist.json()["total"] >= 1

        # 8. Dedicated Threat Correlation + Duplicate Indicator Detection
        r_corr = await client.post("/api/threat-correlation", json={"url": "http://login-security.xyz", "resolve_dns": False})
        assert r_corr.status_code == 200
        corr_data = r_corr.json()
        assert len(corr_data["duplicate_indicators"]) >= 1
        assert corr_data["independent_evidence_count"] >= 1
        assert corr_data["combined_risk_score"] >= 70
        assert len(corr_data["unavailable_sources"]) >= 1

        # 9. Threat Intelligence Provider Endpoints
        r_vt = await client.get("/api/threat-intelligence/virustotal?indicator=login-security.xyz&indicator_type=domain")
        assert r_vt.status_code == 200
        assert r_vt.json()["provider_result"]["status"] in ("ok", "not_configured", "unavailable")

        r_uh = await client.get("/api/threat-intelligence/urlhaus?indicator=http://login-security.xyz&indicator_type=url")
        assert r_uh.status_code == 200

        r_ab = await client.get("/api/threat-intelligence/abuseipdb?ip=185.220.101.44")
        assert r_ab.status_code == 200

        # 10. Report Generation (PDF) & CSV Export
        r_pdf = await client.post("/api/reports/generate", json={"report_type": "url_scan", "scan_id": scan_id})
        assert r_pdf.status_code == 200
        rep_id = r_pdf.json()["id"]

        r_dl = await client.get(f"/api/reports/{rep_id}/download")
        assert r_dl.status_code == 200
        assert r_dl.content.startswith(b"%PDF-")

        r_ti_pdf = await client.post("/api/reports/generate", json={"report_type": "threat_intelligence"})
        assert r_ti_pdf.status_code == 200

        r_csv = await client.get("/api/reports/export/csv")
        assert r_csv.status_code == 200
        assert b"Scan ID,Scanned At,URL" in r_csv.content

        # 11. Settings & Profile Update
        r_set = await client.get("/api/settings")
        assert r_set.status_code == 200
        assert "profile" in r_set.json()
        assert "database" in r_set.json()

        r_pref = await client.put("/api/settings/preferences", json={
            "auto_correlate": True,
            "risk_alert_threshold": 75,
            "default_page_size": 10,
            "enable_dns_resolution": True,
        })
        assert r_pref.status_code == 200
        assert r_pref.json()["preferences"]["risk_alert_threshold"] == 75


def test_full_backend_workflow():
    asyncio.run(_run_full_workflow())


if __name__ == "__main__":
    test_full_backend_workflow()
    print("ALL 11 END-TO-END BACKEND VERIFICATION CHECKS PASSED!")
