"""
Threat Intelligence Correlation Engine.

Core principles enforced:
1. Combines calibrated ML Random Forest prediction with external Threat Intelligence
   providers (VirusTotal, URLhaus, AbuseIPDB) and local IoC threat database matches.
2. Deduplicates threat indicators by canonical (indicator_type, normalized_value) so
   multiple reports of the exact same underlying indicator are explicitly surfaced as
   duplicates rather than double-counted as independent evidence.
3. Explicitly tracks unavailable/unconfigured external APIs and NEVER treats an
   unavailable API as a clean result.
4. Produces an explainable, itemized risk score (0-100), clear final classification
   (Safe / Suspicious / Phishing / Malicious), human-readable detection reasons,
   investigation summary, and actionable security recommendations.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.database.db import db


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical_key(indicator_type: str, indicator_value: str) -> str:
    return f"{indicator_type.lower()}:{indicator_value.strip().lower().rstrip('/')}"


def _classify_risk_score(
    score: int,
    ml_prediction: str,
    independent_ti_matches: int,
    has_malware_tag: bool,
) -> str:
    if score >= 82 and (has_malware_tag or independent_ti_matches >= 2 or score >= 88):
        return "Malicious"
    if score >= 62:
        return "Phishing"
    if score >= 34:
        return "Suspicious"
    return "Safe"


def _determine_threat_category(
    classification: str,
    features: Dict[str, float],
    evidence_items: List[Dict[str, Any]],
) -> str:
    for item in evidence_items:
        cat = item.get("threat_category")
        if cat and cat.lower() not in ("none", "unknown", "clean"):
            return cat
    if classification == "Safe":
        return "Clean / Benign"
    if features.get("brand_impersonation_signal", 0) > 0:
        return "Brand Impersonation Phishing"
    if features.get("has_ip_address", 0) > 0:
        return "IP-Hosted Credential Phishing"
    if features.get("is_shortener", 0) > 0:
        return "Obfuscated Redirect / Shortener"
    if features.get("has_punycode", 0) > 0:
        return "IDN Homograph Phishing"
    if features.get("has_login_or_verify_path", 0) > 0:
        return "Credential Harvesting"
    if classification == "Malicious":
        return "Malicious Infrastructure"
    if classification == "Phishing":
        return "Phishing URL"
    return "Suspicious URL Pattern"


def correlate_threat_intelligence(
    *,
    normalized_url: str,
    domain: str,
    ip_address: Optional[str],
    ml_result: Dict[str, Any],
    provider_results: Dict[str, Dict[str, Any]],
    scan_id: Optional[str] = None,
    persist: bool = True,
) -> Dict[str, Any]:
    """
    Execute full ML + Threat Intelligence correlation with duplicate indicator
    detection, independent evidence counting, and explainable risk scoring.
    """
    features = ml_result.get("features", {})
    feature_signals = ml_result.get("feature_signals", [])
    ml_prediction = ml_result["prediction"]
    ml_confidence = float(ml_result["confidence"])
    ml_phish_prob = float(ml_result["phishing_probability"])

    available_sources: List[str] = []
    unavailable_sources: List[Dict[str, str]] = []
    raw_evidence: List[Dict[str, Any]] = []

    # 1. Process live external TI provider responses
    for provider_key, p_res in provider_results.items():
        p_name = p_res.get("provider", provider_key)
        p_status = p_res.get("status", "unavailable")

        if p_status == "ok":
            available_sources.append(p_name)
        elif p_status != "skipped":
            unavailable_sources.append({
                "provider": p_name,
                "status": p_status,
                "reason": p_res.get("message", "Provider unavailable."),
            })

        if p_status == "ok" and p_res.get("matched"):
            ind_type = p_res.get("indicator_type") or "url"
            ind_val = p_res.get("indicator_value") or normalized_url
            ckey = _canonical_key(ind_type, ind_val)
            raw_evidence.append({
                "indicator_type": ind_type,
                "indicator_value": ind_val,
                "canonical_key": ckey,
                "source": p_name,
                "threat_category": p_res.get("threat_category") or "Malicious Indicator",
                "severity": "critical" if (p_res.get("confidence_score") or 0) >= 80 else "high",
                "confidence": p_res.get("confidence_score"),
                "summary": p_res.get("message") or f"Matched in {p_name}.",
            })
            # Persist newly discovered positive IoC into local threat_indicators table
            if persist:
                db.upsert_indicator(
                    indicator_type=ind_type,
                    indicator_value=ind_val,
                    threat_category=p_res.get("threat_category") or "Malicious Indicator",
                    source=p_name,
                    confidence_score=p_res.get("confidence_score") or 80,
                    reputation="Malicious",
                    raw_metadata=p_res.get("details", {}),
                )

    # 2. Check stored Threat Intelligence IoC repository (historically ingested VirusTotal/URLhaus/AbuseIPDB/Analyst IoCs)
    stored_iocs = db.find_matching_indicators(normalized_url, domain, ip_address)
    if stored_iocs:
        available_sources.append("PhishGuard Threat IoC DB")

    for ioc in stored_iocs:
        reputation = (ioc.get("reputation") or "").lower()
        if reputation in ("clean", "benign", "safe"):
            continue
        raw_evidence.append({
            "indicator_type": ioc["indicator_type"],
            "indicator_value": ioc["indicator_value"],
            "canonical_key": ioc["canonical_key"],
            "source": ioc["source"],
            "threat_category": ioc["threat_category"],
            "severity": "critical" if (ioc.get("confidence_score") or 0) >= 80 else "high",
            "confidence": ioc.get("confidence_score"),
            "summary": f"Matched known {ioc['indicator_type'].upper()} IoC from {ioc['source']} ({ioc['threat_category']}).",
        })

    # 3. Deduplicate evidence by canonical underlying indicator!
    # Rule: Do NOT treat multiple reports of the exact same underlying indicator
    # as independent evidence. Track both unique independent evidence and duplicates.
    seen_canonical_to_source: Dict[str, str] = {}
    seen_source_key_pairs: Set[Tuple[str, str]] = set()
    external_matches: List[Dict[str, Any]] = []
    duplicate_indicators: List[Dict[str, Any]] = []
    matching_sources_set: Set[str] = set()

    for item in raw_evidence:
        pair = (item["canonical_key"], item["source"].lower())
        if pair in seen_source_key_pairs:
            # Exact same source + indicator already recorded (e.g. live lookup + cached DB row)
            dup = {
                **item,
                "is_duplicate": True,
                "duplicate_of_source": item["source"],
                "summary": f"Duplicate report of {item['canonical_key']} already seen in {item['source']}; excluded from independent evidence weight.",
            }
            duplicate_indicators.append(dup)
            continue
        seen_source_key_pairs.add(pair)
        matching_sources_set.add(item["source"])

        if item["canonical_key"] in seen_canonical_to_source:
            first_source = seen_canonical_to_source[item["canonical_key"]]
            dup = {
                **item,
                "is_duplicate": True,
                "duplicate_of_source": first_source,
                "summary": (
                    f"Corroborates same underlying indicator ({item['indicator_type']}: {item['indicator_value']}) "
                    f"previously reported by {first_source}. Tracked as duplicate indicator rather than independent evidence."
                ),
            }
            duplicate_indicators.append(dup)
            external_matches.append(dup)
        else:
            seen_canonical_to_source[item["canonical_key"]] = item["source"]
            unique_item = {
                **item,
                "is_duplicate": False,
                "duplicate_of_source": None,
            }
            external_matches.append(unique_item)

    independent_evidence = [m for m in external_matches if not m["is_duplicate"]]
    independent_count = len(independent_evidence)
    matching_sources_count = len(matching_sources_set)

    # 4. Explainable Combined Risk Score Calculation (0 - 100)
    # Component A: Calibrated ML Probability Contribution (0 - 65 pts)
    ml_component = round(ml_phish_prob * 65.0, 2)

    # Component B: Independent Threat Intelligence Evidence (0 - 30 pts)
    # Only independent unique indicators contribute full TI weight; duplicates add at most +3 corroboration cap
    ti_component = 0.0
    for ev in independent_evidence:
        ev_conf = (ev.get("confidence") or 75) / 100.0
        ti_component += 18.0 * max(0.5, ev_conf)
    ti_component = min(30.0, ti_component)
    corroboration_bonus = min(3.0, len(duplicate_indicators) * 1.5) if duplicate_indicators else 0.0

    # Component C: High-Severity Structural Heuristics (0 - 15 pts)
    structural_component = 0.0
    if features.get("brand_impersonation_signal", 0) > 0:
        structural_component += 6.0
    if features.get("has_ip_address", 0) > 0:
        structural_component += 5.0
    if features.get("has_punycode", 0) > 0:
        structural_component += 5.0
    if features.get("at_symbol_count", 0) > 0:
        structural_component += 6.0
    if features.get("has_suspicious_tld", 0) > 0 and features.get("has_login_or_verify_path", 0) > 0:
        structural_component += 4.0
    if features.get("is_shortener", 0) > 0:
        structural_component += 4.0
    structural_component = min(15.0, structural_component)

    # If external TI confirms maliciousness even when ML was mild, enforce minimum floor
    raw_score = ml_component + ti_component + corroboration_bonus + structural_component
    if independent_count >= 2:
        raw_score = max(raw_score, 85.0)
    elif independent_count == 1:
        raw_score = max(raw_score, 68.0)

    combined_risk_score = max(0, min(100, int(round(raw_score))))

    has_malware_tag = any(
        any(k in (m.get("threat_category") or "").lower() for k in ("malware", "malicious", "trojan", "botnet", "ransomware", "c2"))
        for m in independent_evidence
    )
    final_classification = _classify_risk_score(
        combined_risk_score, ml_prediction, independent_count, has_malware_tag
    )
    threat_category = _determine_threat_category(final_classification, features, independent_evidence)

    # 5. Correlation Status (explicitly accounting for unavailable sources!)
    if ml_prediction == "phishing" and independent_count > 0:
        correlation_status = "Correlated Threat (ML + TI Confirmed)"
    elif ml_prediction == "legitimate" and independent_count > 0:
        correlation_status = "Threat Intelligence Override"
    elif ml_prediction == "phishing" and independent_count == 0:
        if unavailable_sources:
            correlation_status = "ML-Only Detection (External TI Partial/Unavailable)"
        else:
            correlation_status = "ML-Only Detection (Zero-Day / Unlisted)"
    else:
        if unavailable_sources and not available_sources:
            correlation_status = "Unverified — External TI Unavailable"
        elif unavailable_sources:
            correlation_status = "Low Risk — Partial TI Coverage"
        else:
            correlation_status = "Clean — Verified Across Sources"

    # 6. Human-readable Detection Reasons
    detection_reasons: List[str] = []
    if ml_prediction == "phishing":
        detection_reasons.append(
            f"Random Forest ML model classified this URL as phishing with {ml_phish_prob * 100:.1f}% calibrated probability."
        )
    else:
        detection_reasons.append(
            f"Random Forest ML model assessed lexical/structural features as legitimate ({(1 - ml_phish_prob) * 100:.1f}% confidence)."
        )

    for ev in independent_evidence:
        detection_reasons.append(
            f"Independent Threat Intelligence match ({ev['source']}): {ev['summary']}"
        )

    if duplicate_indicators:
        detection_reasons.append(
            f"Detected {len(duplicate_indicators)} duplicate indicator report(s) referencing already-counted IoCs; deduplicated to avoid inflating risk."
        )

    for sig in feature_signals:
        if sig["severity"] in ("critical", "high"):
            detection_reasons.append(f"{sig['feature']}: {sig['description']}")

    if unavailable_sources:
        unavail_names = ", ".join(u["provider"] for u in unavailable_sources)
        detection_reasons.append(
            f"External intelligence coverage notice: {unavail_names} unavailable/unconfigured — NOT treated as a clean signal."
        )

    # 7. Actionable Security Recommendations
    recommendations: List[str] = []
    if final_classification in ("Malicious", "Phishing"):
        recommendations.extend([
            "Block this URL and parent domain immediately across secure web gateways, DNS firewalls, and email filters.",
            "Do not visit the URL in a standard browser; use an isolated sandbox if deeper forensic inspection is required.",
            "Search SIEM and proxy logs for any internal endpoints that recently accessed this domain or IP address.",
            "If credentials may have been submitted, force password reset and revoke active user sessions immediately.",
        ])
    elif final_classification == "Suspicious":
        recommendations.extend([
            "Place URL under elevated monitoring and warn users before permitting navigation.",
            "Verify domain registration age, TLS certificate issuer, and redirect chain in an isolated environment.",
            "Cross-check sender email headers or referral source if this URL arrived via external communication.",
        ])
    else:
        recommendations.append(
            "No phishing or malicious indicators detected in current analysis."
        )
        if unavailable_sources:
            recommendations.append(
                "Configure VirusTotal, URLhaus, and AbuseIPDB API keys in backend .env to enable full real-time external reputation verification."
            )
        else:
            recommendations.append(
                "Continue standard perimeter monitoring; re-scan if the URL behavior or destination changes."
            )

    # 8. Investigation Summary
    summary_parts = [
        f"Target '{normalized_url}' (domain: {domain}"
        + (f", resolved IP: {ip_address}" if ip_address else ", IP unresolved")
        + f") received a combined risk score of {combined_risk_score}/100 ({final_classification}).",
        f"ML verdict: {ml_prediction.upper()} ({ml_confidence * 100:.1f}% confidence).",
        f"Matched {independent_count} independent threat indicator(s) across {matching_sources_count} source(s)"
        + (f" ({len(duplicate_indicators)} duplicate indicator report(s) deduplicated)." if duplicate_indicators else "."),
    ]
    if unavailable_sources:
        summary_parts.append(
            f"Note: {len(unavailable_sources)} external TI source(s) were unavailable/unconfigured and excluded from clean assumptions."
        )
    investigation_summary = " ".join(summary_parts)

    score_breakdown = {
        "ml_score": round(ml_component, 2),
        "ml_max": 65,
        "independent_ti_score": round(ti_component, 2),
        "independent_ti_max": 30,
        "corroboration_bonus": round(corroboration_bonus, 2),
        "corroboration_max": 3,
        "structural_heuristics_score": round(structural_component, 2),
        "structural_heuristics_max": 15,
        "deduplicated_reports_excluded": len(duplicate_indicators),
        "final_score": combined_risk_score,
    }

    correlation_payload = {
        "id": str(uuid.uuid4()),
        "scan_id": scan_id,
        "url": normalized_url,
        "domain": domain,
        "ip_address": ip_address,
        "ml_prediction": ml_prediction,
        "ml_confidence": ml_confidence,
        "ml_phishing_probability": ml_phish_prob,
        "external_matches": external_matches,
        "duplicate_indicators": duplicate_indicators,
        "matching_sources_count": matching_sources_count,
        "independent_evidence_count": independent_count,
        "available_sources": available_sources,
        "unavailable_sources": unavailable_sources,
        "correlation_status": correlation_status,
        "combined_risk_score": combined_risk_score,
        "final_classification": final_classification,
        "threat_category": threat_category,
        "score_breakdown": score_breakdown,
        "detection_reasons": detection_reasons,
        "recommendations": recommendations,
        "investigation_summary": investigation_summary,
        "provider_results": provider_results,
        "correlated_at": _utc_now(),
    }

    if persist:
        saved = db.save_correlation(correlation_payload)
        correlation_payload["id"] = saved["id"]
        correlation_payload["correlated_at"] = saved["correlated_at"]

    return correlation_payload
