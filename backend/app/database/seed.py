"""
Initial Database Seeder for PhishGuard.
Runs ONLY when the database is empty. Every seeded scan is genuinely analyzed
by the trained Random Forest classifier and correlated with baseline threat
indicators so dashboard metrics, charts, and correlation pages start populated
with real, auditable ML outputs rather than hardcoded UI numbers.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Tuple

from app.correlation.engine import correlate_threat_intelligence
from app.database.db import db
from app.intelligence.base import build_provider_result
from app.ml.predictor import predictor
from app.security import validate_and_normalize_url


INITIAL_IOCS = [
    # Domain & URL IoCs demonstrating multi-source correlation + duplicate detection
    ("domain", "login-security.xyz", "Credential Phishing", "VirusTotal", 92, "Malicious"),
    ("domain", "login-security.xyz", "Credential Phishing", "URLhaus", 88, "Malicious"),
    ("url", "http://login-security.xyz", "Credential Harvesting", "PhishGuard Feed", 90, "Malicious"),
    ("domain", "fake-bank.net", "Banking Trojan / Phishing", "VirusTotal", 96, "Malicious"),
    ("domain", "fake-bank.net", "Malware Distribution", "URLhaus", 94, "Malicious"),
    ("ip", "185.220.101.44", "High-Risk Abusive IP", "AbuseIPDB", 91, "Malicious"),
    ("domain", "malicious-domain.xyz", "Malware C2 / Phishing", "URLhaus", 95, "Malicious"),
    ("domain", "malicious-domain.xyz", "Phishing Infrastructure", "VirusTotal", 89, "Malicious"),
    ("domain", "phishing-site.com", "Brand Impersonation", "VirusTotal", 86, "Malicious"),
    ("domain", "paypal-verify-account.top", "PayPal Credential Harvesting", "VirusTotal", 97, "Malicious"),
    ("ip", "194.26.135.88", "Phishing Hosting IP", "AbuseIPDB", 84, "Suspicious"),
    ("domain", "microsoft-365-auth.tk", "O365 Credential Phishing", "URLhaus", 93, "Malicious"),
    ("domain", "secure-chase-alert.buzz", "Banking Phishing", "VirusTotal", 91, "Malicious"),
    ("ip", "45.142.212.61", "Brute-Force / Phishing Relay", "AbuseIPDB", 88, "Malicious"),
]

# (url, days_ago, minutes_ago, optional_ip)
INITIAL_SCANS: List[Tuple[str, int, int, str | None]] = [
    # 6 days ago
    ("https://github.com/fastapi/fastapi", 6, 30, "140.82.121.4"),
    ("https://docs.python.org/3/library/urllib.html", 6, 120, "151.101.1.223"),
    ("http://secure-chase-alert.buzz/login.php", 6, 200, "194.26.135.88"),
    ("https://www.cloudflare.com/learning/security/", 6, 260, "104.16.132.229"),
    # 5 days ago
    ("https://stackoverflow.com/questions/security", 5, 45, "172.64.155.249"),
    ("http://paypal-verify-account.top/webscr?cmd=_login-run", 5, 90, "45.142.212.61"),
    ("https://www.nist.gov/cyberframework", 5, 180, "132.163.4.101"),
    ("https://tinyurl.com/y7x2k9m1", 5, 310, "104.20.138.65"),
    ("https://reactjs.org/docs/getting-started.html", 5, 400, "104.18.22.46"),
    # 4 days ago
    ("https://aws.amazon.com/security/", 4, 25, "13.226.238.10"),
    ("http://microsoft-365-auth.tk/signin/verify", 4, 75, "185.220.101.44"),
    ("https://en.wikipedia.org/wiki/Phishing", 4, 150, "208.80.154.224"),
    ("https://supabase.com/docs/guides/auth", 4, 210, "104.18.38.10"),
    ("http://dhl-parcel-track.click/invoice/confirm", 4, 340, "194.26.135.88"),
    # 3 days ago
    ("https://www.microsoft.com/en-us/security", 3, 55, "20.112.250.133"),
    ("http://apple-icloud-unlock.icu/auth/recover", 3, 110, "45.142.212.61"),
    ("https://stripe.com/docs/security", 3, 195, "54.187.205.235"),
    ("https://cutt.ly/9mPq4Rz", 3, 250, "172.67.152.89"),
    ("http://malicious-domain.xyz/payload/verify.php", 3, 390, "185.220.101.44"),
    # 2 days ago
    ("https://www.cisa.gov/known-exploited-vulnerabilities-catalog", 2, 40, "104.18.12.111"),
    ("http://phishing-site.com/account/login", 2, 85, "194.26.135.88"),
    ("https://scikit-learn.org/stable/modules/ensemble.html", 2, 175, "185.199.108.153"),
    ("https://mozilla.org/en-US/security/", 2, 240, "34.117.33.233"),
    ("http://185.220.101.44:8080/banking/confirm.php", 2, 315, "185.220.101.44"),
    # 1 day ago
    ("https://tailwindcss.com/docs/installation", 1, 35, "76.76.21.21"),
    ("https://vitejs.dev/guide/", 1, 125, "76.76.21.98"),
    ("http://amazon-billing-update.vip/signin/verify", 1, 190, "45.142.212.61"),
    ("https://rb.gy/k4x8p2", 1, 270, "104.21.48.209"),
    ("https://www.google.com/safetycenter/", 1, 360, "142.250.190.78"),
    # Today (most recent 5 match the clean enterprise dashboard activity look)
    ("http://fake-bank.net", 0, 10, "185.220.101.44"),
    ("https://openai.com", 0, 8, "104.18.33.45"),
    ("https://bit.ly/8xYazQ", 0, 6, "67.199.248.11"),
    ("http://login-security.xyz", 0, 4, "194.26.135.88"),
    ("https://github.com", 0, 2, "140.82.121.4"),
]


def seed_database_if_empty() -> None:
    """Populate baseline ML-analyzed scans & IoCs only on first boot."""
    if db.count_scans() > 0:
        return

    now = datetime.now(timezone.utc)

    # 1. Seed initial Threat Intelligence IoCs
    for ind_type, ind_val, category, source, conf, rep in INITIAL_IOCS:
        db.upsert_indicator(
            indicator_type=ind_type,
            indicator_value=ind_val,
            threat_category=category,
            source=source,
            confidence_score=conf,
            reputation=rep,
            raw_metadata={"seeded_baseline": True},
            last_checked=(now - timedelta(hours=3)).isoformat(),
        )

    # 2. Run actual ML model + correlation engine on each baseline URL
    predictor.ensure_loaded()
    for raw_url, days_ago, mins_ago, ip_addr in INITIAL_SCANS:
        target = validate_and_normalize_url(raw_url)
        ml_res = predictor.predict(target.normalized_url)
        ts = (now - timedelta(days=days_ago, minutes=mins_ago)).isoformat()

        # Provider status reflects true unconfigured state unless env keys are present
        provider_results = {
            "virustotal": build_provider_result(
                "VirusTotal",
                "not_configured",
                indicator_type="url",
                indicator_value=target.normalized_url,
                message="VirusTotal API key not configured; historical IoC database checked instead.",
            ),
            "urlhaus": build_provider_result(
                "URLhaus",
                "not_configured",
                indicator_type="url",
                indicator_value=target.normalized_url,
                message="URLhaus Auth-Key not configured; historical IoC database checked instead.",
            ),
            "abuseipdb": build_provider_result(
                "AbuseIPDB",
                "not_configured",
                indicator_type="ip",
                indicator_value=ip_addr,
                message="AbuseIPDB API key not configured; historical IoC database checked instead.",
            ),
        }

        corr = correlate_threat_intelligence(
            normalized_url=target.normalized_url,
            domain=target.hostname,
            ip_address=ip_addr,
            ml_result=ml_res,
            provider_results=provider_results,
            persist=False,
        )

        detection_source = (
            "ML + Threat Correlation"
            if corr["independent_evidence_count"] > 0
            else "Random Forest ML"
        )

        saved_scan = db.save_scan({
            "url": raw_url,
            "normalized_url": target.normalized_url,
            "domain": target.hostname,
            "ip_address": ip_addr,
            "classification": corr["final_classification"],
            "risk_score": corr["combined_risk_score"],
            "ml_prediction": ml_res["prediction"],
            "ml_confidence": ml_res["confidence"],
            "detection_source": detection_source,
            "threat_category": corr["threat_category"],
            "extracted_features": ml_res["features"],
            "virustotal_result": provider_results["virustotal"],
            "urlhaus_result": provider_results["urlhaus"],
            "abuseipdb_result": provider_results["abuseipdb"],
            "detection_reasons": corr["detection_reasons"],
            "recommendations": corr["recommendations"],
            "scanned_at": ts,
        })

        corr["scan_id"] = saved_scan["id"]
        corr["correlated_at"] = ts
        db.save_correlation(corr)
