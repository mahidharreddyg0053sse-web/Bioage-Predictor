"""Dashboard & Security Analytics API endpoints driven exclusively by live database records."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from fastapi import APIRouter

from app.database.db import db
from app.ml.predictor import predictor

router = APIRouter(prefix="/api", tags=["Analytics & Dashboard"])


def _parse_iso_date(iso_str: str) -> datetime:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


def _compute_analytics_payload() -> Dict[str, Any]:
    scans = db.get_all_scans(limit=1000)
    indicators = db.list_indicators(limit=500)
    correlations = db.list_correlations(limit=500)
    integrations = db.list_integrations()

    total_scans = len(scans)
    class_counts = Counter(s["classification"] for s in scans)
    safe_count = class_counts.get("Safe", 0)
    phishing_count = class_counts.get("Phishing", 0)
    suspicious_count = class_counts.get("Suspicious", 0)
    malicious_count = class_counts.get("Malicious", 0)
    critical_threats = sum(1 for s in scans if s["risk_score"] >= 80 or s["classification"] == "Malicious")

    # Last 7 days daily breakdown (activity + average risk score + sparklines)
    today = datetime.now(timezone.utc).date()
    daily_buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for s in scans:
        dt = _parse_iso_date(s["scanned_at"]).date()
        daily_buckets[dt.isoformat()].append(s)

    last_7_days = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        key = day.isoformat()
        day_scans = daily_buckets.get(key, [])
        avg_risk = (
            round(sum(x["risk_score"] for x in day_scans) / len(day_scans), 1)
            if day_scans
            else 0
        )
        last_7_days.append({
            "date": day.strftime("%b %d"),
            "iso_date": key,
            "total": len(day_scans),
            "safe": sum(1 for x in day_scans if x["classification"] == "Safe"),
            "phishing": sum(1 for x in day_scans if x["classification"] == "Phishing"),
            "suspicious": sum(1 for x in day_scans if x["classification"] == "Suspicious"),
            "malicious": sum(1 for x in day_scans if x["classification"] == "Malicious"),
            "critical": sum(1 for x in day_scans if x["risk_score"] >= 80 or x["classification"] == "Malicious"),
            "avg_risk": avg_risk,
        })

    # Weekly trend (past 4 weeks)
    weekly_activity = []
    for week_idx in range(3, -1, -1):
        end_d = today - timedelta(days=week_idx * 7)
        start_d = end_d - timedelta(days=6)
        w_scans = [
            s for s in scans
            if start_d <= _parse_iso_date(s["scanned_at"]).date() <= end_d
        ]
        weekly_activity.append({
            "week": f"{start_d.strftime('%b %d')}–{end_d.strftime('%b %d')}",
            "total": len(w_scans),
            "threats": sum(1 for x in w_scans if x["classification"] in ("Phishing", "Malicious", "Suspicious")),
            "safe": sum(1 for x in w_scans if x["classification"] == "Safe"),
        })

    # Threat overview percentages
    def pct(n: int) -> float:
        return round((n / total_scans) * 100.0, 1) if total_scans > 0 else 0.0

    threat_overview = [
        {"name": "Safe", "value": safe_count, "percentage": pct(safe_count), "color": "#10B981"},
        {"name": "Phishing", "value": phishing_count, "percentage": pct(phishing_count), "color": "#EF4444"},
        {"name": "Suspicious", "value": suspicious_count, "percentage": pct(suspicious_count), "color": "#F59E0B"},
        {"name": "Malicious", "value": malicious_count, "percentage": pct(malicious_count), "color": "#2563EB"},
    ]

    # Threat category distribution
    cat_counter = Counter(s.get("threat_category") or "Other" for s in scans if s["classification"] != "Safe")
    threat_categories = [
        {"category": cat, "count": cnt}
        for cat, cnt in cat_counter.most_common(8)
    ]

    # Risk-level distribution
    risk_buckets = {
        "Low (0-33)": sum(1 for s in scans if s["risk_score"] <= 33),
        "Medium (34-61)": sum(1 for s in scans if 34 <= s["risk_score"] <= 61),
        "High (62-81)": sum(1 for s in scans if 62 <= s["risk_score"] <= 81),
        "Critical (82-100)": sum(1 for s in scans if s["risk_score"] >= 82),
    }
    risk_distribution = [{"level": k, "count": v} for k, v in risk_buckets.items()]

    # Intelligence source statistics derived from actual indicators + live integration queries
    source_ioc_counts = Counter(ind["source"] for ind in indicators)
    int_map = {item["provider_name"]: item for item in integrations}

    vt_int = int_map.get("virustotal", {})
    uh_int = int_map.get("urlhaus", {})
    ab_int = int_map.get("abuseipdb", {})

    total_corr_matches = sum(c.get("independent_evidence_count", 0) for c in correlations)
    total_deduped = sum(len(c.get("duplicate_indicators", [])) for c in correlations)

    source_stats = [
        {
            "key": "virustotal",
            "name": "VirusTotal",
            "count": source_ioc_counts.get("VirusTotal", 0) + vt_int.get("total_queries", 0),
            "iocs": source_ioc_counts.get("VirusTotal", 0),
            "queries": vt_int.get("total_queries", 0),
            "matches": vt_int.get("total_matches", 0) + source_ioc_counts.get("VirusTotal", 0),
            "label": "IoCs Checked",
            "status": vt_int.get("status", "not_configured"),
            "is_configured": vt_int.get("is_configured", False),
        },
        {
            "key": "urlhaus",
            "name": "URLhaus",
            "count": source_ioc_counts.get("URLhaus", 0) + uh_int.get("total_queries", 0),
            "iocs": source_ioc_counts.get("URLhaus", 0),
            "queries": uh_int.get("total_queries", 0),
            "matches": uh_int.get("total_matches", 0) + source_ioc_counts.get("URLhaus", 0),
            "label": "Malicious URLs",
            "status": uh_int.get("status", "not_configured"),
            "is_configured": uh_int.get("is_configured", False),
        },
        {
            "key": "abuseipdb",
            "name": "AbuseIPDB",
            "count": source_ioc_counts.get("AbuseIPDB", 0) + ab_int.get("total_queries", 0),
            "iocs": source_ioc_counts.get("AbuseIPDB", 0),
            "queries": ab_int.get("total_queries", 0),
            "matches": ab_int.get("total_matches", 0) + source_ioc_counts.get("AbuseIPDB", 0),
            "label": "IP Reports",
            "status": ab_int.get("status", "not_configured"),
            "is_configured": ab_int.get("is_configured", False),
        },
        {
            "key": "total_matches",
            "name": "Total Matches",
            "count": len(indicators),
            "iocs": len(indicators),
            "queries": total_corr_matches,
            "matches": total_corr_matches,
            "label": "Threat Indicators",
            "status": "active",
            "is_configured": True,
        },
    ]

    # Simple period-over-period trend % based on first half vs second half of the 7-day window
    def calc_trend(field: str) -> int:
        first_half = sum(d[field] for d in last_7_days[:3])
        second_half = sum(d[field] for d in last_7_days[3:])
        if first_half == 0:
            return 100 if second_half > 0 else 0
        return int(round(((second_half - first_half) / first_half) * 100))

    return {
        "summary": {
            "total_urls_scanned": total_scans,
            "phishing_detected": phishing_count,
            "safe_urls": safe_count,
            "suspicious_urls": suspicious_count,
            "malicious_urls": malicious_count,
            "critical_threats": critical_threats,
            "total_indicators": len(indicators),
            "total_correlations": len(correlations),
            "deduplicated_indicators": total_deduped,
            "avg_risk_score": round(sum(s["risk_score"] for s in scans) / total_scans, 1) if total_scans else 0,
            "trends": {
                "total": calc_trend("total"),
                "phishing": calc_trend("phishing"),
                "safe": calc_trend("safe"),
                "critical": calc_trend("critical"),
            },
        },
        "threat_overview": threat_overview,
        "daily_activity": last_7_days,
        "weekly_activity": weekly_activity,
        "threat_categories": threat_categories,
        "risk_distribution": risk_distribution,
        "source_statistics": source_stats,
        "recent_scans": scans[:6],
        "ml_model_metrics": predictor.metrics,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/analytics")
async def get_analytics() -> Dict[str, Any]:
    return _compute_analytics_payload()


@router.get("/dashboard")
async def get_dashboard() -> Dict[str, Any]:
    return _compute_analytics_payload()
