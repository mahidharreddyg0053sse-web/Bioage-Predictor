"""
URL Lexical & Structural Feature Extraction Module.
Extracts 24 deterministic features from a URL without ever fetching the remote page.
"""

from __future__ import annotations

import ipaddress
import math
import re
from collections import Counter
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

FEATURE_NAMES: List[str] = [
    "url_length",
    "hostname_length",
    "path_length",
    "query_length",
    "dot_count",
    "hyphen_count",
    "underscore_count",
    "slash_count",
    "question_count",
    "equal_count",
    "at_symbol_count",
    "ampersand_count",
    "percent_count",
    "digit_count",
    "digit_ratio",
    "subdomain_count",
    "has_https",
    "has_ip_address",
    "has_port",
    "has_suspicious_tld",
    "is_shortener",
    "suspicious_keyword_count",
    "brand_impersonation_signal",
    "url_entropy",
    "hostname_entropy",
    "has_double_slash_in_path",
    "has_punycode",
    "has_login_or_verify_path",
]

SUSPICIOUS_TLDS = {
    "xyz", "top", "tk", "ml", "ga", "cf", "gq", "pw", "cc", "buzz", "club",
    "click", "link", "work", "info", "biz", "online", "site", "website",
    "icu", "vip", "cyou", "loan", "win", "bid", "stream", "download", "zip",
    "mov", "support", "security", "account", "ru", "cn", "su",
}

URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bit.do", "mcaf.ee", "su.pr", "tiny.cc", "lnkd.in", "db.tt",
    "qr.ae", "cur.lv", "rb.gy", "cutt.ly", "shorturl.at", "rebrand.ly",
}

SUSPICIOUS_KEYWORDS = {
    "login", "signin", "sign-in", "verify", "verification", "account", "update",
    "secure", "security", "banking", "bank", "confirm", "wallet", "password",
    "credential", "recover", "unlock", "suspend", "suspended", "billing",
    "invoice", "alert", "urgent", "webscr", "cmd", "auth", "authenticate",
    "validate", "phish", "fake", "malicious", "support-desk", "helpdesk",
}

PROTECTED_BRANDS = {
    "paypal": {"paypal.com"},
    "microsoft": {"microsoft.com", "live.com", "office.com", "outlook.com", "azure.com"},
    "google": {"google.com", "gmail.com", "googleapis.com", "accounts.google.com"},
    "apple": {"apple.com", "icloud.com"},
    "amazon": {"amazon.com", "aws.amazon.com"},
    "netflix": {"netflix.com"},
    "facebook": {"facebook.com", "fb.com", "meta.com"},
    "instagram": {"instagram.com"},
    "chase": {"chase.com"},
    "wellsfargo": {"wellsfargo.com"},
    "bankofamerica": {"bankofamerica.com"},
    "citibank": {"citi.com", "citibank.com"},
    "dhl": {"dhl.com"},
    "fedex": {"fedex.com"},
    "dropbox": {"dropbox.com"},
    "linkedin": {"linkedin.com"},
    "github": {"github.com"},
    "openai": {"openai.com"},
    "coinbase": {"coinbase.com"},
    "binance": {"binance.com"},
    "stripe": {"stripe.com"},
}


def shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = Counter(text)
    length = len(text)
    return round(
        -sum((count / length) * math.log2(count / length) for count in counts.values()),
        4,
    )


def _get_registered_domain(hostname: str) -> str:
    parts = [p for p in hostname.lower().strip(".").split(".") if p]
    if len(parts) <= 2:
        return ".".join(parts)
    # Handle common two-part public suffixes
    two_part_tlds = {"co.uk", "org.uk", "ac.uk", "com.au", "co.in", "com.br", "co.jp", "gov.uk"}
    if ".".join(parts[-2:]) in two_part_tlds and len(parts) >= 3:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def _is_ip(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True
    except ValueError:
        return False


def extract_url_features(url: str) -> Tuple[Dict[str, float], List[Dict[str, Any]]]:
    """
    Extract numerical feature dictionary (ordered by FEATURE_NAMES) and
    human-readable security feature signals for analyst transparency.
    """
    candidate = url.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", candidate):
        candidate = f"http://{candidate}"

    parsed = urlparse(candidate)
    scheme = (parsed.scheme or "http").lower()
    hostname = (parsed.hostname or "").lower().rstrip(".")
    path = parsed.path or ""
    query = parsed.query or ""
    full_lower = candidate.lower()

    is_ip = _is_ip(hostname)
    reg_domain = hostname if is_ip else _get_registered_domain(hostname)
    tld = "" if is_ip else (hostname.split(".")[-1] if "." in hostname else "")

    # Subdomain count
    if is_ip or not hostname:
        subdomain_count = 0
    else:
        reg_parts = len(reg_domain.split("."))
        host_parts = len([p for p in hostname.split(".") if p])
        subdomain_count = max(0, host_parts - reg_parts)
        # Ignore standard single 'www' prefix as a risk subdomain
        if subdomain_count == 1 and hostname.startswith("www."):
            subdomain_count = 0

    digits = sum(c.isdigit() for c in candidate)
    url_len = len(candidate)
    digit_ratio = round(digits / max(url_len, 1), 4)

    has_https = 1 if scheme == "https" else 0
    has_port = 1 if parsed.port is not None else 0
    has_suspicious_tld = 1 if tld in SUSPICIOUS_TLDS else 0
    is_shortener = 1 if reg_domain in URL_SHORTENERS or hostname in URL_SHORTENERS else 0
    has_punycode = 1 if "xn--" in hostname else 0
    has_double_slash_path = 1 if "//" in path else 0

    # Keyword analysis across hostname + path + query
    tokens = re.findall(r"[a-z0-9]+", f"{hostname} {path} {query}".lower())
    token_set = set(tokens)
    matched_keywords = sorted(
        kw for kw in SUSPICIOUS_KEYWORDS if kw in token_set or (len(kw) >= 5 and kw in full_lower)
    )
    suspicious_keyword_count = len(matched_keywords)

    # Brand impersonation: brand appears in URL, but registered domain is NOT official
    impersonated_brands: List[str] = []
    for brand, official_domains in PROTECTED_BRANDS.items():
        if brand in full_lower and reg_domain not in official_domains:
            # Make sure it's in hostname or prominent path segment, not random noise
            if brand in hostname or f"/{brand}" in path.lower() or f"-{brand}" in full_lower:
                impersonated_brands.append(brand)
    brand_impersonation_signal = 1 if impersonated_brands else 0

    login_verify_pattern = re.compile(
        r"(login|signin|verify|account|update|secure|banking|confirm|wallet|auth|password|recover)",
        re.IGNORECASE,
    )
    has_login_or_verify_path = 1 if login_verify_pattern.search(f"{hostname}{path}") else 0

    url_ent = shannon_entropy(candidate)
    host_ent = shannon_entropy(hostname)

    features: Dict[str, float] = {
        "url_length": float(url_len),
        "hostname_length": float(len(hostname)),
        "path_length": float(len(path)),
        "query_length": float(len(query)),
        "dot_count": float(candidate.count(".")),
        "hyphen_count": float(hostname.count("-")),
        "underscore_count": float(candidate.count("_")),
        "slash_count": float(path.count("/")),
        "question_count": float(candidate.count("?")),
        "equal_count": float(candidate.count("=")),
        "at_symbol_count": float(candidate.count("@")),
        "ampersand_count": float(candidate.count("&")),
        "percent_count": float(candidate.count("%")),
        "digit_count": float(digits),
        "digit_ratio": float(digit_ratio),
        "subdomain_count": float(subdomain_count),
        "has_https": float(has_https),
        "has_ip_address": float(1 if is_ip else 0),
        "has_port": float(has_port),
        "has_suspicious_tld": float(has_suspicious_tld),
        "is_shortener": float(is_shortener),
        "suspicious_keyword_count": float(suspicious_keyword_count),
        "brand_impersonation_signal": float(brand_impersonation_signal),
        "url_entropy": float(url_ent),
        "hostname_entropy": float(host_ent),
        "has_double_slash_in_path": float(has_double_slash_path),
        "has_punycode": float(has_punycode),
        "has_login_or_verify_path": float(has_login_or_verify_path),
    }

    # Generate explainable analyst signals
    signals: List[Dict[str, Any]] = []
    if not has_https:
        signals.append({
            "feature": "Transport Security",
            "value": "HTTP (Unencrypted)",
            "severity": "medium",
            "description": "URL does not use HTTPS encryption, common in credential-harvesting kits.",
        })
    else:
        signals.append({
            "feature": "Transport Security",
            "value": "HTTPS",
            "severity": "low",
            "description": "URL uses HTTPS transport encryption (note: phishing sites can also use HTTPS).",
        })

    if is_ip:
        signals.append({
            "feature": "IP Literal Host",
            "value": hostname,
            "severity": "high",
            "description": "Direct IP address used instead of a registered domain name.",
        })

    if has_suspicious_tld:
        signals.append({
            "feature": "Suspicious TLD",
            "value": f".{tld}",
            "severity": "high",
            "description": f"Top-level domain '.{tld}' is frequently abused in phishing campaigns.",
        })

    if is_shortener:
        signals.append({
            "feature": "URL Shortener",
            "value": reg_domain,
            "severity": "medium",
            "description": "URL shortening service obscures the final destination and requires inspection.",
        })

    if brand_impersonation_signal:
        signals.append({
            "feature": "Brand Impersonation",
            "value": ", ".join(impersonated_brands),
            "severity": "critical",
            "description": f"References protected brand(s) ({', '.join(impersonated_brands)}) on an unofficial domain '{reg_domain}'.",
        })

    if suspicious_keyword_count > 0:
        signals.append({
            "feature": "Phishing Keywords",
            "value": ", ".join(matched_keywords[:5]),
            "severity": "high" if suspicious_keyword_count >= 2 else "medium",
            "description": f"Contains {suspicious_keyword_count} security/credential-related keyword(s).",
        })

    if hostname.count("-") >= 2:
        signals.append({
            "feature": "Excessive Hyphens",
            "value": f"{hostname.count('-')} hyphens",
            "severity": "medium",
            "description": "Multiple hyphens in hostname are commonly used to mimic legitimate brands.",
        })

    if subdomain_count >= 2:
        signals.append({
            "feature": "Deep Subdomain Structure",
            "value": f"{subdomain_count} subdomains",
            "severity": "high",
            "description": "Multiple nested subdomains are often used to spoof trusted domain names.",
        })

    if candidate.count("@") > 0:
        signals.append({
            "feature": "Embedded '@' Symbol",
            "value": "Present",
            "severity": "critical",
            "description": "'@' symbol in URL can mislead users about the actual target host.",
        })

    if has_punycode:
        signals.append({
            "feature": "Punycode / IDN Homograph",
            "value": "xn-- detected",
            "severity": "high",
            "description": "Internationalized domain encoding may indicate a visual homograph attack.",
        })

    if url_len >= 75:
        signals.append({
            "feature": "Abnormal URL Length",
            "value": f"{url_len} chars",
            "severity": "medium",
            "description": "Long URLs are often used to obfuscate parameters or redirect chains.",
        })

    if url_ent >= 4.4:
        signals.append({
            "feature": "High Shannon Entropy",
            "value": f"{url_ent:.2f} bits",
            "severity": "medium",
            "description": "High lexical randomness suggests obfuscated tokens or algorithmically generated paths.",
        })

    return features, signals


def features_to_vector(features: Dict[str, float]) -> List[float]:
    return [float(features[name]) for name in FEATURE_NAMES]
