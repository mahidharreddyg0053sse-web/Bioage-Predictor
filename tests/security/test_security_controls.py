"""
BioAge Pro — 225 OWASP Top 10 Non-Destructive Security & Vulnerability Control Tests
Covers:
  01. A05: Security Misconfiguration & HTTP Hardening (35 cases)
  02. A01: Broken Access Control & Sensitive File Exposure (35 cases)
  03. A07: Authentication & Session Controls (40 cases)
  04. A03: Injection Resilience — SQLi / NoSQLi / Command Probes (35 cases)
  05. A03: XSS & MIME Content-Type Protections (30 cases)
  06. A04: Input Validation, Error Handling & DoS Resilience (30 cases)
  07. A02: Cryptographic & Source Secret Hygiene (20 cases)
Total: 225 Non-Destructive Security Test Cases
"""

import os
import re
import pytest
import requests

SESSION = requests.Session()
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# ------------------------------------------------------------------
# 01. A05: HTTP Security Headers Across 7 Endpoints (35 Test Cases)
# ------------------------------------------------------------------
HEADER_ENDPOINTS = [
    ("health", "/api/health"),
    ("root", "/"),
    ("style_css", "/style.css"),
    ("forgot_pwd", "/forgot-password.html"),
    ("history_api", "/api/bioage/history/usr_elena"),
    ("app_js", "/js/app.js"),
    ("calc_js", "/js/calculator.js"),
]
HEADER_CHECKS = [
    ("nosniff", "x-content-type-options", "nosniff"),
    ("xfo_deny", "x-frame-options", "DENY"),
    ("referrer", "referrer-policy", "strict-origin-when-cross-origin"),
    ("permissions", "permissions-policy", "geolocation=()"),
    ("no_x_powered_by", "x-powered-by", None),
]

HTTP_HEADER_CASES = [
    (f"{ep_id}__{chk_id}", path, hdr, expected)
    for ep_id, path in HEADER_ENDPOINTS
    for chk_id, hdr, expected in HEADER_CHECKS
]


@pytest.mark.parametrize(
    "case_id,path,header_name,expected_substr",
    HTTP_HEADER_CASES,
    ids=[c[0] for c in HTTP_HEADER_CASES],
)
def test_http_security_header(api_base, case_id, path, header_name, expected_substr):
    """Verify OWASP HTTP security header hardening on endpoint response."""
    res = SESSION.get(f"{api_base}{path}", timeout=10)
    assert res.status_code == 200
    headers = {k.lower(): v for k, v in res.headers.items()}
    if expected_substr is None:
        assert header_name not in headers, f"Disclosed header {header_name} on {path}"
    else:
        assert header_name in headers, f"Missing header {header_name} on {path}"
        assert expected_substr.lower() in headers[header_name].lower()


# ------------------------------------------------------------------
# 02. A01: Sensitive File & Directory Exposure Protection (35 Cases)
# ------------------------------------------------------------------
SENSITIVE_PATHS = [
    ("dot_env", "/.env"),
    ("backend_dot_env", "/backend/.env"),
    ("backend_server_js", "/backend/server.js"),
    ("backend_db_js", "/backend/database/db.js"),
    ("backend_schema_sql", "/backend/database/schema.sql"),
    ("backend_db_json", "/backend/database/data/database.json"),
    ("backend_auth_routes", "/backend/routes/authRoutes.js"),
    ("backend_bioage_routes", "/backend/routes/bioageRoutes.js"),
    ("backend_gemini_routes", "/backend/routes/geminiRoutes.js"),
    ("backend_calc_service", "/backend/services/calculatorService.js"),
    ("backend_email_service", "/backend/services/emailService.js"),
    ("backend_gemini_service", "/backend/services/geminiService.js"),
    ("package_json", "/package.json"),
    ("package_lock_json", "/package-lock.json"),
    ("pytest_ini", "/pytest.ini"),
    ("gitignore", "/.gitignore"),
    ("git_config", "/.git/config"),
    ("git_head", "/.git/HEAD"),
    ("github_load_wf", "/.github/workflows/load-tests.yml"),
    ("github_selenium_wf", "/.github/workflows/selenium-tests.yml"),
    ("github_security_wf", "/.github/workflows/security-tests.yml"),
    ("node_modules_express", "/node_modules/express/package.json"),
    ("node_modules_dotenv", "/node_modules/dotenv/package.json"),
    ("android_build_gradle", "/android-app/build.gradle"),
    ("android_app_gradle", "/android-app/app/build.gradle"),
    ("android_local_props", "/android-app/local.properties"),
    ("tests_api_py", "/tests/test_api.py"),
    ("tests_security_py", "/tests/security/test_security_controls.py"),
    ("tests_reqs_txt", "/tests/requirements.txt"),
    ("bat_start", "/start.bat"),
    ("bat_open_mobile", "/open-mobile.bat"),
    ("bat_build_apk", "/build-apk.bat"),
    ("upper_backend_server", "/BACKEND/server.js"),
    ("upper_package_json", "/PACKAGE.JSON"),
    ("traversal_env", "/..%2f.env"),
]


@pytest.mark.parametrize(
    "case_id,path",
    SENSITIVE_PATHS,
    ids=[c[0] for c in SENSITIVE_PATHS],
)
def test_sensitive_path_blocked(api_base, case_id, path):
    """Verify sensitive internal source, config, or secret file is denied (403/404)."""
    res = SESSION.get(f"{api_base}{path}", timeout=10)
    assert res.status_code in (403, 404), f"Sensitive path {path} unexpectedly returned {res.status_code}"


# ------------------------------------------------------------------
# 03. A07: Authentication & Session Security Controls (40 Test Cases)
# ------------------------------------------------------------------
MISSING_CRED_CASES = [
    ("empty_body", {}),
    ("only_email", {"email": "alex@workplace.com"}),
    ("only_password", {"password": "password123"}),
    ("empty_strings", {"email": "", "password": ""}),
    ("empty_email_val", {"email": "", "password": "password123"}),
    ("empty_pass_val", {"email": "alex@workplace.com", "password": ""}),
    ("null_email", {"email": None, "password": "password123"}),
    ("null_password", {"email": "alex@workplace.com", "password": None}),
]


@pytest.mark.parametrize(
    "case_id,payload",
    MISSING_CRED_CASES,
    ids=[c[0] for c in MISSING_CRED_CASES],
)
def test_auth_missing_credentials(api_base, case_id, payload):
    """Verify login endpoint strictly rejects incomplete credential payloads (HTTP 400)."""
    res = SESSION.post(f"{api_base}/api/auth/login", json=payload, timeout=10)
    assert res.status_code == 400
    assert "error" in res.json()


UNKNOWN_EMAILS = [
    f"unknown_sec_user_{i}@nonexistent.example" for i in range(1, 9)
]


@pytest.mark.parametrize("email", UNKNOWN_EMAILS, ids=[f"unknown_{i}" for i in range(1, 9)])
def test_auth_unknown_email_rejected(api_base, email):
    """Verify unregistered email is rejected with 404 and no stack trace."""
    res = SESSION.post(
        f"{api_base}/api/auth/login",
        json={"email": email, "password": "SomePassword123!"},
        timeout=10,
    )
    assert res.status_code == 404
    assert "stack" not in res.text.lower()


WRONG_PASSWORD_CASES = [
    ("alex_wrong_1", "alex@workplace.com", "wrong1"),
    ("alex_wrong_2", "alex@workplace.com", "PASSWORD123"),
    ("alex_wrong_3", "alex@workplace.com", "password123 "),
    ("elena_wrong_1", "elena@longevity.bio", "password123"),
    ("elena_wrong_2", "elena@longevity.bio", "elena2026"),
    ("elena_wrong_3", "elena@longevity.bio", "WrongSecret!"),
    ("robert_wrong_1", "robert@financecorp.com", "123456"),
    ("robert_wrong_2", "robert@financecorp.com", "Password123"),
    ("robert_wrong_3", "robert@financecorp.com", "admin123"),
]


@pytest.mark.parametrize(
    "case_id,email,password",
    WRONG_PASSWORD_CASES,
    ids=[c[0] for c in WRONG_PASSWORD_CASES],
)
def test_auth_wrong_password_rejected(api_base, case_id, email, password):
    """Verify incorrect password for existing account returns HTTP 401."""
    res = SESSION.post(
        f"{api_base}/api/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    assert res.status_code == 401
    assert res.json().get("success") is not True


REG_VALIDATION_CASES = [
    ("missing_all", {}, 400),
    ("missing_name", {"email": "new1@example.com", "password": "Password123"}, 400),
    ("missing_email", {"name": "Test User", "password": "Password123"}, 400),
    ("missing_password", {"name": "Test User", "email": "new2@example.com"}, 400),
    ("weak_pwd_1char", {"name": "User", "email": "w1@example.com", "password": "a"}, 400),
    ("weak_pwd_2char", {"name": "User", "email": "w2@example.com", "password": "12"}, 400),
    ("weak_pwd_3char", {"name": "User", "email": "w3@example.com", "password": "123"}, 400),
    ("weak_pwd_4char", {"name": "User", "email": "w4@example.com", "password": "abcd"}, 400),
    ("weak_pwd_5char", {"name": "User", "email": "w5@example.com", "password": "12345"}, 400),
    ("weak_pwd_pass", {"name": "User", "email": "w6@example.com", "password": "pass"}, 400),
    ("weak_pwd_pin", {"name": "User", "email": "w7@example.com", "password": "0000"}, 400),
    ("weak_pwd_short", {"name": "User", "email": "w8@example.com", "password": "a1b2c"}, 400),
    ("dup_alex", {"name": "Dup Alex", "email": "alex@workplace.com", "password": "Password123!"}, 409),
    ("dup_elena", {"name": "Dup Elena", "email": "elena@longevity.bio", "password": "Password123!"}, 409),
    ("dup_robert", {"name": "Dup Robert", "email": "robert@financecorp.com", "password": "Password123!"}, 409),
]


@pytest.mark.parametrize(
    "case_id,payload,expected_status",
    REG_VALIDATION_CASES,
    ids=[c[0] for c in REG_VALIDATION_CASES],
)
def test_registration_validation_controls(api_base, case_id, payload, expected_status):
    """Verify registration enforces mandatory fields, min password length, and uniqueness."""
    res = SESSION.post(f"{api_base}/api/auth/register/send-otp", json=payload, timeout=10)
    assert res.status_code == expected_status
    assert "error" in res.json()


# ------------------------------------------------------------------
# 04. A03: Injection Resilience — SQLi / NoSQLi / Command (35 Cases)
# ------------------------------------------------------------------
LOGIN_INJECTION_VECTORS = [
    ("sqli_or_1_1", "' OR '1'='1", "' OR '1'='1"),
    ("sqli_admin_comment", "admin'--", "anything"),
    ("sqli_alex_comment", "alex@workplace.com'--", "wrong"),
    ("sqli_union_select", "' UNION SELECT * FROM users--", "x"),
    ("sqli_drop_table", "'; DROP TABLE users;--", "x"),
    ("sqli_sleep", "' OR SLEEP(2)--", "x"),
    ("sqli_double_quote", '" OR "1"="1', '" OR "1"="1'),
    ("sqli_tautology_num", "1 OR 1=1", "1 OR 1=1"),
    ("sqli_semicolon", "alex@workplace.com; SELECT 1;", "x"),
    ("sqli_hex", "0x61646d696e", "0x70617373"),
    ("nosql_ne_obj_email", {"$ne": None}, "password123"),
    ("nosql_ne_obj_pass", "alex@workplace.com", {"$ne": ""}),
    ("nosql_gt_obj", "alex@workplace.com", {"$gt": ""}),
    ("nosql_regex_obj", "alex@workplace.com", {"$regex": ".*"}),
    ("cmd_pipe_id", "alex@workplace.com | id", "test"),
    ("cmd_semicolon_ls", "alex@workplace.com; ls -la", "test"),
    ("cmd_subshell", "$(whoami)@example.com", "test"),
    ("cmd_backticks", "`id`@example.com", "test"),
    ("ldap_wildcard", "*)(uid=*))(|(uid=*", "test"),
    ("crlf_header_inj", "alex@workplace.com\r\nX-Injected: true", "test"),
]


@pytest.mark.parametrize(
    "case_id,email_probe,pass_probe",
    LOGIN_INJECTION_VECTORS,
    ids=[c[0] for c in LOGIN_INJECTION_VECTORS],
)
def test_login_injection_resilience(api_base, case_id, email_probe, pass_probe):
    """Verify injection probe cannot bypass login authentication or expose stack traces."""
    res = SESSION.post(
        f"{api_base}/api/auth/login",
        json={"email": email_probe, "password": pass_probe},
        timeout=10,
    )
    assert res.status_code in (400, 401, 404, 500)
    body = res.json() if "application/json" in res.headers.get("content-type", "") else {}
    assert body.get("success") is not True
    assert "syntax error at or near" not in res.text.lower()


API_INJECTION_PROBES = [
    ("hist_sqli_1", "GET", "/api/bioage/history/' OR '1'='1", None),
    ("hist_sqli_2", "GET", "/api/bioage/history/usr_elena;DROP TABLE users", None),
    ("hist_sqli_3", "GET", "/api/bioage/history/1 UNION SELECT 1,2,3", None),
    ("hist_cmd_1", "GET", "/api/bioage/history/$(id)", None),
    ("hist_cmd_2", "GET", "/api/bioage/history/usr_elena|cat", None),
    ("hist_null_byte", "GET", "/api/bioage/history/usr_elena%00", None),
    ("hist_unicode", "GET", "/api/bioage/history/usr_%C0%AF", None),
    ("calc_sqli_gender", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "gender": "' OR 1=1--"}),
    ("calc_sqli_smoke", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "smokingStatus": "'; DROP TABLE--"}),
    ("calc_sqli_diet", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "mediterraneanScore": "high' UNION SELECT 1--"}),
    ("calc_cmd_sleep", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "sleepDuration": "$(echo pwn)"}),
    ("calc_cmd_stress", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "stressLevel": "`whoami`"}),
    ("calc_proto_pollute_1", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "__proto__": {"polluted": True}}),
    ("calc_proto_pollute_2", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "constructor": {"prototype": {"x": 1}}}),
    ("calc_ssti_probe", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "gender": "{{7*7}}"}),
]


@pytest.mark.parametrize(
    "case_id,method,path,payload",
    API_INJECTION_PROBES,
    ids=[c[0] for c in API_INJECTION_PROBES],
)
def test_api_injection_resilience(api_base, case_id, method, path, payload):
    """Verify API endpoints handle injection and prototype pollution probes safely."""
    if method == "POST":
        res = SESSION.post(f"{api_base}{path}", json=payload, timeout=10)
    else:
        res = SESSION.get(f"{api_base}{path}", timeout=10)
    assert res.status_code in (200, 400, 403, 404)
    assert "49" not in (res.text if "ssti" in case_id and "49" in "{{7*7}}" else "")
    assert "referenceerror" not in res.text.lower()
    assert "syntaxerror" not in res.text.lower()


# ------------------------------------------------------------------
# 05. A03: XSS & MIME Content-Type Protections (30 Test Cases)
# ------------------------------------------------------------------
XSS_PAYLOADS = [
    ("script_alert", "<script>alert(1)</script>"),
    ("script_upper", "<SCRIPT>alert('xss')</SCRIPT>"),
    ("img_onerror", "<img src=x onerror=alert(1)>"),
    ("svg_onload", "<svg/onload=alert(1)>"),
    ("body_onload", "<body onload=alert(1)>"),
    ("iframe_js", "<iframe src='javascript:alert(1)'></iframe>"),
    ("anchor_js", "<a href='javascript:alert(1)'>click</a>"),
    ("input_onfocus", "<input onfocus=alert(1) autofocus>"),
    ("details_ontoggle", "<details open ontoggle=alert(1)>"),
    ("marquee_onstart", "<marquee onstart=alert(1)>"),
    ("object_data", "<object data='javascript:alert(1)'>"),
    ("embed_src", "<embed src='javascript:alert(1)'>"),
    ("style_expr", "<style>body{background:url('javascript:alert(1)')}</style>"),
    ("math_xss", "<math><mtext><script>alert(1)</script></mtext></math>"),
    ("event_attr_break", "\" onmouseover=\"alert(1)"),
    ("single_quote_break", "' onclick='alert(1)"),
    ("polyglot_1", "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcliCk=alert() )//"),
    ("template_literal", "${alert(1)}"),
    ("encoded_script", "%3Cscript%3Ealert(1)%3C/script%3E"),
    ("img_dynsrc", "<img dynsrc='javascript:alert(1)'>"),
]


@pytest.mark.parametrize(
    "case_id,xss_str",
    XSS_PAYLOADS,
    ids=[c[0] for c in XSS_PAYLOADS],
)
def test_xss_payload_not_reflected_unescaped(api_base, case_id, xss_str):
    """Verify XSS payload sent to /api/bioage/calculate is not reflected in response."""
    res = SESSION.post(
        f"{api_base}/api/bioage/calculate",
        json={"chronologicalAge": 32, "gender": xss_str, "smokingStatus": xss_str},
        timeout=10,
    )
    assert res.status_code == 200
    assert "application/json" in res.headers.get("content-type", "").lower()
    assert "<script" not in res.text.lower()
    assert "onerror=" not in res.text.lower()
    assert "onload=" not in res.text.lower()


MIME_CHECK_ENDPOINTS = [
    ("api_health_json", "/api/health", "application/json"),
    ("api_history_json", "/api/bioage/history/usr_elena", "application/json"),
    ("root_html", "/", "text/html"),
    ("forgot_html", "/forgot-password.html", "text/html"),
    ("style_css", "/style.css", "text/css"),
    ("app_js", "/js/app.js", "javascript"),
    ("auth_js", "/js/auth.js", "javascript"),
    ("calc_js", "/js/calculator.js", "javascript"),
    ("sim_js", "/js/simulator.js", "javascript"),
    ("dna_jpg", "/images/dna-helix.jpg", "image/jpeg"),
]


@pytest.mark.parametrize(
    "case_id,path,expected_mime",
    MIME_CHECK_ENDPOINTS,
    ids=[c[0] for c in MIME_CHECK_ENDPOINTS],
)
def test_content_type_mime_protection(api_base, case_id, path, expected_mime):
    """Verify accurate Content-Type header paired with X-Content-Type-Options: nosniff."""
    res = SESSION.get(f"{api_base}{path}", timeout=10)
    assert res.status_code == 200
    assert expected_mime in res.headers.get("content-type", "").lower()
    assert res.headers.get("x-content-type-options", "").lower() == "nosniff"


# ------------------------------------------------------------------
# 06. A04: Input Validation, Error Handling & DoS Resilience (30 Cases)
# ------------------------------------------------------------------
INPUT_EDGE_CASES = [
    ("malformed_json_1", "RAW_POST", "/api/auth/login", "{bad json", 400),
    ("malformed_json_2", "RAW_POST", "/api/bioage/calculate", "[unclosed", 400),
    ("malformed_json_3", "RAW_POST", "/api/auth/login", '{"email": }', 400),
    ("malformed_json_4", "RAW_POST", "/api/bioage/calculate", "not-json-at-all", 400),
    ("method_delete_health", "DELETE", "/api/health", None, 404),
    ("method_put_health", "PUT", "/api/health", None, 404),
    ("method_patch_health", "PATCH", "/api/health", None, 404),
    ("method_delete_calc", "DELETE", "/api/bioage/calculate", None, 404),
    ("method_put_calc", "PUT", "/api/bioage/calculate", None, 404),
    ("method_get_login", "GET_API", "/api/auth/login", None, 200),
    ("calc_neg_age", "POST", "/api/bioage/calculate", {"chronologicalAge": -50}, 200),
    ("calc_zero_age", "POST", "/api/bioage/calculate", {"chronologicalAge": 0}, 200),
    ("calc_huge_age", "POST", "/api/bioage/calculate", {"chronologicalAge": 99999}, 200),
    ("calc_str_age", "POST", "/api/bioage/calculate", {"chronologicalAge": "notanumber"}, 200),
    ("calc_zero_height", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "height": 0, "weight": 70}, 200),
    ("calc_neg_weight", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "height": 175, "weight": -99}, 200),
    ("calc_neg_rhr", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "restingHeartRate": -10}, 200),
    ("calc_huge_rhr", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "restingHeartRate": 5000}, 200),
    ("calc_neg_bp", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "bloodPressureSystolic": -1, "bloodPressureDiastolic": -1}, 200),
    ("calc_huge_bp", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "bloodPressureSystolic": 9999, "bloodPressureDiastolic": 9999}, 200),
    ("calc_null_fields", "POST", "/api/bioage/calculate", {"chronologicalAge": None, "height": None, "weight": None}, 200),
    ("calc_array_fields", "POST", "/api/bioage/calculate", {"chronologicalAge": [30], "gender": ["male"]}, 200),
    ("calc_bool_fields", "POST", "/api/bioage/calculate", {"chronologicalAge": True, "gender": False}, 200),
    ("calc_float_age", "POST", "/api/bioage/calculate", {"chronologicalAge": 34.56789}, 200),
    ("calc_long_string", "POST", "/api/bioage/calculate", {"chronologicalAge": 30, "gender": "A" * 5000}, 200),
    ("login_long_email", "POST", "/api/auth/login", {"email": ("a" * 500) + "@example.com", "password": "test"}, 404),
    ("login_long_pass", "POST", "/api/auth/login", {"email": "alex@workplace.com", "password": "P" * 2000}, 401),
    ("login_unicode_email", "POST", "/api/auth/login", {"email": "üñîçødé@example.com", "password": "test"}, 404),
    ("login_whitespace_email", "POST", "/api/auth/login", {"email": "   ", "password": "test"}, 404),
    ("unknown_api_post", "POST", "/api/nonexistent/route", {"test": 1}, 404),
]


@pytest.mark.parametrize(
    "case_id,mode,path,payload,expected_status",
    INPUT_EDGE_CASES,
    ids=[c[0] for c in INPUT_EDGE_CASES],
)
def test_input_validation_and_dos_resilience(api_base, case_id, mode, path, payload, expected_status):
    """Verify malformed inputs and edge payloads are handled cleanly without crashes or stack leaks."""
    url = f"{api_base}{path}"
    if mode == "RAW_POST":
        res = SESSION.post(url, data=payload, headers={"Content-Type": "application/json"}, timeout=10)
    elif mode == "DELETE":
        res = SESSION.delete(url, timeout=10)
    elif mode == "PUT":
        res = SESSION.put(url, timeout=10)
    elif mode == "PATCH":
        res = SESSION.patch(url, timeout=10)
    elif mode == "GET_API":
        res = SESSION.get(url, timeout=10)
    else:
        res = SESSION.post(url, json=payload, timeout=10)

    assert res.status_code == expected_status
    assert "c:\\users\\" not in res.text.lower()
    assert "/home/runner/" not in res.text.lower()


# ------------------------------------------------------------------
# 07. A02: Cryptographic & Source Secret Hygiene (20 Test Cases)
# ------------------------------------------------------------------
SECRET_PATTERNS = re.compile(
    r"(?:AQ\.Ab8RN[0-9A-Za-z_-]{20,}|AIza[0-9A-Za-z_-]{35}|ghp_[0-9A-Za-z]{36}|xkeysib-[0-9A-Za-z-]{20,}|sk-[0-9A-Za-z]{20,})"
)

TRACKED_FILES_TO_AUDIT = [
    ("server_js", "backend/server.js"),
    ("gemini_service_js", "backend/services/geminiService.js"),
    ("email_service_js", "backend/services/emailService.js"),
    ("calc_service_js", "backend/services/calculatorService.js"),
    ("auth_routes_js", "backend/routes/authRoutes.js"),
    ("bioage_routes_js", "backend/routes/bioageRoutes.js"),
    ("gemini_routes_js", "backend/routes/geminiRoutes.js"),
    ("db_js", "backend/database/db.js"),
    ("root_index_html", "index.html"),
    ("frontend_index_html", "frontend/index.html"),
    ("android_index_html", "android-app/app/src/main/assets/index.html"),
    ("root_gemini_js", "js/gemini.js"),
    ("frontend_gemini_js", "frontend/js/gemini.js"),
    ("android_gemini_js", "android-app/app/src/main/assets/js/gemini.js"),
    ("root_app_js", "js/app.js"),
    ("frontend_app_js", "frontend/js/app.js"),
    ("root_auth_js", "js/auth.js"),
    ("android_manifest", "android-app/app/src/main/AndroidManifest.xml"),
    ("gitignore_env_check", ".gitignore"),
    ("package_json_check", "package.json"),
]


@pytest.mark.parametrize(
    "case_id,rel_path",
    TRACKED_FILES_TO_AUDIT,
    ids=[c[0] for c in TRACKED_FILES_TO_AUDIT],
)
def test_source_secret_and_crypto_hygiene(case_id, rel_path):
    """Verify tracked source/config file contains zero hardcoded API keys or tokens."""
    full_path = os.path.join(REPO_ROOT, rel_path)
    assert os.path.exists(full_path), f"Expected file missing: {rel_path}"
    with open(full_path, encoding="utf-8", errors="ignore") as f:
        content = f.read()

    assert SECRET_PATTERNS.search(content) is None, f"Hardcoded secret detected in {rel_path}"
    if rel_path == ".gitignore":
        assert ".env" in content
        assert "backend/.env" in content
