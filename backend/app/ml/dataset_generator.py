"""
Reproducible Phishing & Legitimate URL Dataset Builder for Random Forest Training.
Generates a diverse, realistic 5,000-URL corpus grounded in real-world benign
and phishing URL patterns (typosquatting, credential harvesting, IP literals,
URL shorteners, suspicious TLDs, punycode, deep subdomains, high-entropy paths).
"""

from __future__ import annotations

import random
import string
from typing import List, Tuple
import pandas as pd

from app.ml.feature_extractor import FEATURE_NAMES, extract_url_features

LEGIT_DOMAINS = [
    "github.com", "openai.com", "google.com", "microsoft.com", "apple.com",
    "amazon.com", "cloudflare.com", "mozilla.org", "wikipedia.org", "stackoverflow.com",
    "python.org", "docs.python.org", "npmjs.com", "pypi.org", "gitlab.com",
    "linkedin.com", "reddit.com", "nytimes.com", "bbc.co.uk", "reuters.com",
    "mit.edu", "stanford.edu", "harvard.edu", "nist.gov", "cisa.gov",
    "stripe.com", "paypal.com", "dropbox.com", "slack.com", "notion.so",
    "figma.com", "vercel.com", "netlify.com", "supabase.com", "aws.amazon.com",
    "cloud.google.com", "azure.microsoft.com", "developer.mozilla.org", "fastapi.tiangolo.com",
    "reactjs.org", "tailwindcss.com", "vitejs.dev", "scikit-learn.org", "kaggle.com",
    "coursera.org", "udemy.com", "medium.com", "substack.com", "atlassian.com",
    "zoom.us", "adobe.com", "salesforce.com", "shopify.com", "airbnb.com",
    "booking.com", "uber.com", "spotify.com", "netflix.com", "youtube.com",
    "chase.com", "wellsfargo.com", "bankofamerica.com", "dhl.com", "fedex.com",
    "oracle.com", "ibm.com", "intel.com", "nvidia.com", "amd.com",
]

LEGIT_PATHS = [
    "", "/", "/about", "/pricing", "/docs", "/blog", "/contact", "/products",
    "/features", "/security", "/privacy", "/terms", "/careers", "/news",
    "/docs/getting-started", "/blog/2026/security-best-practices", "/api/v2/reference",
    "/wiki/Machine_learning", "/questions/123456/python-fastapi-guide",
    "/repositories/phishguard", "/search?q=cybersecurity+threat+intelligence",
    "/articles/network-defense?page=2", "/support/articles/getting-started",
    "/downloads/release-notes", "/community/discussions", "/learn/tutorials",
    "/catalog/item/4821", "/en-us/documentation/overview", "/status",
    "/dashboard", "/explore", "/trending", "/topics/security",
]

PHISH_BRANDS = [
    "paypal", "microsoft", "apple", "amazon", "google", "netflix", "chase",
    "wellsfargo", "bankofamerica", "dhl", "fedex", "dropbox", "facebook",
    "instagram", "linkedin", "coinbase", "binance", "office365", "icloud",
    "stripe", "citibank", "bank", "securebank", "webmail",
]

PHISH_ACTIONS = [
    "login", "signin", "verify", "secure", "account", "update", "confirm",
    "security", "auth", "wallet", "billing", "unlock", "recover", "alert",
    "suspend", "validate", "portal", "service", "support", "check",
]

PHISH_TLDS = [
    "xyz", "top", "tk", "ml", "ga", "cf", "gq", "pw", "cc", "buzz", "club",
    "click", "link", "work", "info", "biz", "online", "site", "icu", "vip",
    "net", "com", "org", "co", "ru",
]

PHISH_PATHS = [
    "/login.php", "/verify/account", "/signin/auth", "/update-billing.html",
    "/secure/confirm?session=", "/webscr?cmd=_login-run&token=",
    "/account/unlock/step1", "/portal/password-reset", "/validate/user",
    "/auth/oauth2/authorize?redirect=", "/banking/verify-identity",
    "/security-check/confirm", "/invoice/download/doc.php", "/wp-includes/login.php",
    "/cgi-bin/verify.pl?id=", "/recovery/credential-check", "",
]

SHORTENERS = ["bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "is.gd", "shorturl.at", "t.co"]


def _rand_token(rng: random.Random, length: int) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(rng.choices(alphabet, k=length))


def generate_url_dataset(n_legit: int = 2500, n_phish: int = 2500, seed: int = 42) -> Tuple[List[str], List[int]]:
    rng = random.Random(seed)
    urls: List[str] = []
    labels: List[int] = []

    # 1. Legitimate URLs (label = 0)
    for i in range(n_legit):
        domain = rng.choice(LEGIT_DOMAINS)
        scheme = "https" if rng.random() < 0.94 else "http"
        prefix = "www." if rng.random() < 0.30 and domain.count(".") == 1 else ""
        path = rng.choice(LEGIT_PATHS)
        # Occasionally add clean query params or numeric article IDs
        if rng.random() < 0.22 and "?" not in path:
            path = f"{path}/{rng.randint(100, 99999)}"
        if rng.random() < 0.15 and "?" not in path:
            path = f"{path}?ref={rng.choice(['home', 'nav', 'docs', 'search'])}&lang=en"
        # Include some legitimate login pages on real official domains so the model learns domain context
        if rng.random() < 0.08:
            path = rng.choice(["/login", "/signin", "/account", "/settings"])
        url = f"{scheme}://{prefix}{domain}{path}"
        urls.append(url)
        labels.append(0)

    # 2. Phishing / Malicious URLs (label = 1)
    for i in range(n_phish):
        pattern = i % 10
        scheme = "http" if rng.random() < 0.65 else "https"

        if pattern in (0, 1):
            # Brand + action hyphenated domain on suspicious or cheap TLD
            brand = rng.choice(PHISH_BRANDS)
            act1 = rng.choice(PHISH_ACTIONS)
            act2 = rng.choice(PHISH_ACTIONS)
            tld = rng.choice(PHISH_TLDS[:20])
            host = f"{brand}-{act1}.{tld}" if rng.random() < 0.5 else f"{brand}-{act1}-{act2}.{tld}"
            path = rng.choice(PHISH_PATHS)
            if path.endswith("="):
                path += _rand_token(rng, rng.randint(12, 32))
            url = f"{scheme}://{host}{path}"

        elif pattern in (2, 3):
            # Deep subdomain brand spoofing: paypal.com.verify-account.xyz
            brand = rng.choice(PHISH_BRANDS)
            act = rng.choice(PHISH_ACTIONS)
            tld = rng.choice(PHISH_TLDS)
            host = f"{brand}.com.{act}-portal.{tld}" if rng.random() < 0.5 else f"secure.{brand}.{act}-center.{tld}"
            path = rng.choice(PHISH_PATHS)
            if path.endswith("="):
                path += _rand_token(rng, rng.randint(16, 40))
            url = f"{scheme}://{host}{path}"

        elif pattern == 4:
            # IP-literal phishing host (using documentation/public test ranges)
            oct1 = rng.choice([45, 91, 103, 185, 194, 198, 203])
            oct2 = rng.randint(1, 254)
            oct3 = rng.randint(1, 254)
            oct4 = rng.randint(1, 254)
            port = f":{rng.choice([8080, 8443, 8888, 3000])}" if rng.random() < 0.35 else ""
            path = rng.choice(PHISH_PATHS)
            if path.endswith("="):
                path += _rand_token(rng, 16)
            url = f"http://{oct1}.{oct2}.{oct3}.{oct4}{port}{path or '/login.php'}"

        elif pattern == 5:
            # Obfuscated URL shortener phishing lure
            shortener = rng.choice(SHORTENERS)
            code = _rand_token(rng, rng.randint(6, 9))
            url = f"{scheme}://{shortener}/{code}"

        elif pattern == 6:
            # Generic fake/phishing/malicious domain on suspicious TLD
            prefix = rng.choice(["login", "fake", "phishing", "malicious", "secure", "verify", "update", "banking", "account"])
            suffix = rng.choice(["site", "domain", "bank", "portal", "security", "check", "desk", "service"])
            tld = rng.choice(PHISH_TLDS[:22])
            num = str(rng.randint(1, 999)) if rng.random() < 0.35 else ""
            path = rng.choice(PHISH_PATHS) if rng.random() < 0.6 else ""
            if path.endswith("="):
                path += _rand_token(rng, 20)
            url = f"{scheme}://{prefix}-{suffix}{num}.{tld}{path}"

        elif pattern == 7:
            # @ symbol credential trick or double slash redirect
            brand = rng.choice(PHISH_BRANDS)
            tld = rng.choice(PHISH_TLDS[:18])
            if rng.random() < 0.5:
                url = f"{scheme}://{brand}.com@{rng.choice(PHISH_ACTIONS)}-{rng.randint(10,99)}.{tld}/signin"
            else:
                url = f"{scheme}://{rng.choice(PHISH_ACTIONS)}-site.{tld}//redirect/{brand}/verify?id={_rand_token(rng, 18)}"

        elif pattern == 8:
            # Punycode homograph phishing domain
            brand = rng.choice(PHISH_BRANDS)
            tld = rng.choice(PHISH_TLDS[:18])
            url = f"{scheme}://xn--{brand}-{_rand_token(rng, 4).lower()}.{tld}/login?session={_rand_token(rng, 16)}"

        else:
            # Long high-entropy obfuscated phishing URL with encoded params
            tld = rng.choice(PHISH_TLDS[:20])
            act = rng.choice(PHISH_ACTIONS)
            host = f"{act}-{_rand_token(rng, 6).lower()}.{tld}"
            url = (
                f"{scheme}://{host}/{rng.choice(PHISH_BRANDS)}/verify"
                f"?token={_rand_token(rng, 28)}&email=user%40domain.com&redirect={_rand_token(rng, 18)}"
            )

        urls.append(url)
        labels.append(1)

    return urls, labels


def build_feature_dataframe(n_legit: int = 2500, n_phish: int = 2500, seed: int = 42) -> pd.DataFrame:
    urls, labels = generate_url_dataset(n_legit=n_legit, n_phish=n_phish, seed=seed)
    rows = []
    for url, label in zip(urls, labels):
        feats, _ = extract_url_features(url)
        row = {name: feats[name] for name in FEATURE_NAMES}
        row["label"] = label
        rows.append(row)
    return pd.DataFrame(rows)
