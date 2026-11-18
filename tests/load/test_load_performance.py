"""
BioAge Pro — 220+ Automated Load, Latency, Concurrency & Throughput Test Cases
Covers:
  01. Endpoint Latency SLA Verification (40 cases)
  02. BioAge Calculation Engine Throughput & Latency (60 cases)
  03. Auth & Session Endpoint Burst Load (30 cases)
  04. Concurrent Multi-User Bursts via ThreadPoolExecutor (40 cases)
  05. Payload Stress & Boundary Performance (30 cases)
  06. Locust Normal & Heavy Traffic Benchmark SLA Gates (20 cases)
Total: 220 Load & Performance Test Cases
"""

import concurrent.futures
import csv
import json
import os
import time
import pytest
import requests

SESSION = requests.Session()

BASE_PAYLOAD = {
    "chronologicalAge": 34,
    "gender": "male",
    "height": 178,
    "weight": 76,
    "restingHeartRate": 62,
    "bloodPressureSystolic": 118,
    "bloodPressureDiastolic": 76,
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

# ------------------------------------------------------------------
# 01. Endpoint Latency SLA Verification (40 Test Cases)
# ------------------------------------------------------------------
ENDPOINT_LATENCY_CASES = [
    (f"health_run_{i}", "/api/health", 200, 300) for i in range(1, 9)
] + [
    (f"homepage_run_{i}", "/", 200, 500) for i in range(1, 7)
] + [
    ("static_style_css_1", "/style.css", 200, 500),
    ("static_style_css_2", "/style.css", 200, 500),
    ("static_forgot_pwd_1", "/forgot-password.html", 200, 500),
    ("static_forgot_pwd_2", "/forgot-password.html", 200, 500),
    ("static_js_app", "/js/app.js", 200, 500),
    ("static_js_auth", "/js/auth.js", 200, 500),
    ("static_js_calculator", "/js/calculator.js", 200, 500),
    ("static_js_dashboard", "/js/dashboard.js", 200, 500),
    ("static_js_data", "/js/data.js", 200, 500),
    ("static_js_dna", "/js/dnaVisualizer.js", 200, 500),
    ("static_js_gemini", "/js/gemini.js", 200, 500),
    ("static_js_network", "/js/networkLoader.js", 200, 500),
    ("static_js_simulator", "/js/simulator.js", 200, 500),
    ("static_dna_image", "/images/dna-helix.jpg", 200, 500),
] + [
    (f"history_elena_{i}", "/api/bioage/history/usr_elena", 200, 400) for i in range(1, 5)
] + [
    (f"history_alex_{i}", "/api/bioage/history/usr_alex", 200, 400) for i in range(1, 5)
] + [
    (f"history_robert_{i}", "/api/bioage/history/usr_robert", 200, 400) for i in range(1, 5)
]


@pytest.mark.parametrize(
    "case_id,path,expected_status,max_ms",
    ENDPOINT_LATENCY_CASES,
    ids=[c[0] for c in ENDPOINT_LATENCY_CASES],
)
def test_endpoint_latency_sla(load_host, case_id, path, expected_status, max_ms):
    """Verify endpoint returns expected HTTP status within strict latency SLA."""
    t0 = time.perf_counter()
    res = SESSION.get(f"{load_host}{path}", timeout=10)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert res.status_code == expected_status
    assert elapsed_ms <= max_ms, f"{path} took {elapsed_ms:.1f}ms (SLA <= {max_ms}ms)"


# ------------------------------------------------------------------
# 02. BioAge Calculation Engine Throughput & Latency (60 Test Cases)
# ------------------------------------------------------------------
ENGINE_COHORTS = []
_genders = ["male", "female"]
_meds = ["high", "moderate", "low"]
_sleeps = ["optimal", "adequate", "mild_deficit", "severe_deficit"]
_cardios = ["high", "moderate", "low", "sedentary"]
_smokes = ["never", "former", "light", "heavy"]
_stresses = ["low", "moderate", "high", "severe"]

for idx in range(60):
    age = 18 + (idx % 68)
    gender = _genders[idx % 2]
    height = 155 + (idx % 35)
    weight = 52 + (idx % 58)
    rhr = 48 + (idx % 45)
    sys_bp = 104 + (idx % 56)
    dia_bp = 66 + (idx % 34)
    ENGINE_COHORTS.append(
        (
            f"cohort_{idx+1:02d}_age{age}_{gender}",
            {
                **BASE_PAYLOAD,
                "chronologicalAge": age,
                "gender": gender,
                "height": height,
                "weight": weight,
                "restingHeartRate": rhr,
                "bloodPressureSystolic": sys_bp,
                "bloodPressureDiastolic": dia_bp,
                "mediterraneanScore": _meds[idx % len(_meds)],
                "sleepDuration": _sleeps[idx % len(_sleeps)],
                "cardioMinutes": _cardios[idx % len(_cardios)],
                "smokingStatus": _smokes[idx % len(_smokes)],
                "stressLevel": _stresses[idx % len(_stresses)],
            },
        )
    )


@pytest.mark.parametrize(
    "cohort_id,payload",
    ENGINE_COHORTS,
    ids=[c[0] for c in ENGINE_COHORTS],
)
def test_bioage_engine_throughput_and_latency(load_host, cohort_id, payload):
    """Verify POST /api/bioage/calculate computes biological age under 500ms SLA."""
    t0 = time.perf_counter()
    res = SESSION.post(f"{load_host}/api/bioage/calculate", json=payload, timeout=10)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert 10 <= body["result"]["biologicalAge"] <= 130
    assert elapsed_ms <= 500, f"Calculation took {elapsed_ms:.1f}ms (SLA <= 500ms)"


# ------------------------------------------------------------------
# 03. Auth & Session Endpoint Burst Load (30 Test Cases)
# ------------------------------------------------------------------
AUTH_LOAD_CASES = [
    (f"valid_alex_{i}", "alex@workplace.com", "password123", 200) for i in range(1, 8)
] + [
    (f"valid_elena_{i}", "elena@longevity.bio", "ElenaNewPassword2026!", 200) for i in range(1, 8)
] + [
    (f"valid_robert_{i}", "robert@financecorp.com", "password123", 200) for i in range(1, 7)
] + [
    (f"invalid_pass_{i}", "alex@workplace.com", f"wrongpass_{i}", 401) for i in range(1, 6)
] + [
    (f"unknown_user_{i}", f"missing_load_user_{i}@example.com", "password123", 404) for i in range(1, 6)
]


@pytest.mark.parametrize(
    "case_id,email,password,expected_status",
    AUTH_LOAD_CASES,
    ids=[c[0] for c in AUTH_LOAD_CASES],
)
def test_auth_endpoint_burst_load(load_host, case_id, email, password, expected_status):
    """Verify POST /api/auth/login responds accurately under burst traffic (< 500ms)."""
    t0 = time.perf_counter()
    res = SESSION.post(
        f"{load_host}/api/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert res.status_code == expected_status
    assert elapsed_ms <= 500, f"Auth request took {elapsed_ms:.1f}ms"


# ------------------------------------------------------------------
# 04. Concurrent Multi-User Burst Simulation (40 Test Cases)
# ------------------------------------------------------------------
CONCURRENT_BURSTS = []
_burst_specs = [
    ("health", "GET", "/api/health", None, 200),
    ("homepage", "GET", "/", None, 200),
    ("calculate", "POST", "/api/bioage/calculate", BASE_PAYLOAD, 200),
    ("history", "GET", "/api/bioage/history/usr_elena", None, 200),
    ("login", "POST", "/api/auth/login", {"email": "alex@workplace.com", "password": "password123"}, 200),
]
for ep_name, method, path, body, expected in _burst_specs:
    for concurrency in [5, 10, 15, 20, 25, 30, 40, 50]:
        CONCURRENT_BURSTS.append((f"{ep_name}_c{concurrency}", method, path, body, expected, concurrency))


@pytest.mark.parametrize(
    "case_id,method,path,body,expected_status,concurrency",
    CONCURRENT_BURSTS,
    ids=[c[0] for c in CONCURRENT_BURSTS],
)
def test_concurrent_multi_user_burst(load_host, case_id, method, path, body, expected_status, concurrency):
    """Execute parallel concurrent requests and assert 0% error rate & P95 < 1500ms."""
    url = f"{load_host}{path}"

    def fire_one(_):
        t0 = time.perf_counter()
        if method == "POST":
            r = requests.post(url, json=body, timeout=15)
        else:
            r = requests.get(url, timeout=15)
        return r.status_code, (time.perf_counter() - t0) * 1000.0

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        outcomes = list(pool.map(fire_one, range(concurrency)))

    statuses = [s for s, _ in outcomes]
    latencies = sorted(ms for _, ms in outcomes)
    p95_idx = min(int(len(latencies) * 0.95), len(latencies) - 1)
    p95_ms = latencies[p95_idx]

    assert all(s == expected_status for s in statuses), f"Non-{expected_status} statuses detected: {set(statuses)}"
    assert p95_ms <= 1500, f"Concurrent burst ({concurrency} users) P95={p95_ms:.1f}ms > 1500ms"


# ------------------------------------------------------------------
# 05. Payload Stress & Boundary Performance (30 Test Cases)
# ------------------------------------------------------------------
BOUNDARY_PAYLOADS = [
    ("min_age_18", {**BASE_PAYLOAD, "chronologicalAge": 18}),
    ("max_age_100", {**BASE_PAYLOAD, "chronologicalAge": 100}),
    ("min_height_120", {**BASE_PAYLOAD, "height": 120}),
    ("max_height_230", {**BASE_PAYLOAD, "height": 230}),
    ("min_weight_35", {**BASE_PAYLOAD, "weight": 35}),
    ("max_weight_200", {**BASE_PAYLOAD, "weight": 200}),
    ("min_rhr_40", {**BASE_PAYLOAD, "restingHeartRate": 40}),
    ("max_rhr_120", {**BASE_PAYLOAD, "restingHeartRate": 120}),
    ("min_sys_bp_80", {**BASE_PAYLOAD, "bloodPressureSystolic": 80}),
    ("max_sys_bp_200", {**BASE_PAYLOAD, "bloodPressureSystolic": 200}),
    ("min_dia_bp_50", {**BASE_PAYLOAD, "bloodPressureDiastolic": 50}),
    ("max_dia_bp_130", {**BASE_PAYLOAD, "bloodPressureDiastolic": 130}),
    ("minimal_fields_only", {"chronologicalAge": 30, "gender": "female"}),
    ("empty_payload_defaults", {}),
    ("labs_optimal_1", {**BASE_PAYLOAD, "hasLabs": "yes", "fastingGlucose": 80, "cholesterolRatio": 2.5, "hsCrp": "low"}),
    ("labs_elevated_1", {**BASE_PAYLOAD, "hasLabs": "yes", "fastingGlucose": 115, "cholesterolRatio": 4.8, "hsCrp": "moderate"}),
    ("labs_high_risk_1", {**BASE_PAYLOAD, "hasLabs": "yes", "fastingGlucose": 145, "cholesterolRatio": 6.2, "hsCrp": "high"}),
    ("labs_borderline_2", {**BASE_PAYLOAD, "hasLabs": "yes", "fastingGlucose": 99, "cholesterolRatio": 3.5, "hsCrp": "low"}),
    ("labs_diabetic_2", {**BASE_PAYLOAD, "hasLabs": "yes", "fastingGlucose": 180, "cholesterolRatio": 5.5, "hsCrp": "high"}),
    ("labs_null_values", {**BASE_PAYLOAD, "hasLabs": "yes", "fastingGlucose": None, "cholesterolRatio": None, "hsCrp": None}),
    ("fasting_yes_female", {**BASE_PAYLOAD, "gender": "female", "intermittentFasting": "yes"}),
    ("fasting_no_male", {**BASE_PAYLOAD, "gender": "male", "intermittentFasting": "no"}),
    ("heavy_smoker_heavy_alc", {**BASE_PAYLOAD, "smokingStatus": "heavy", "alcoholIntake": "heavy"}),
    ("isolated_severe_stress", {**BASE_PAYLOAD, "socialConnection": "isolated", "stressLevel": "severe"}),
    ("poor_sleep_erratic", {**BASE_PAYLOAD, "sleepDuration": "severe_deficit", "sleepConsistency": "erratic", "sleepQuality": "poor"}),
    ("high_sugar_low_water", {**BASE_PAYLOAD, "sugarIntake": "high", "dailyWater": "low", "ultraProcessedFood": "frequent"}),
    ("zero_exercise_high_sedentary", {**BASE_PAYLOAD, "cardioMinutes": "sedentary", "strengthDays": "none", "dailySteps": "sedentary", "sedentaryHours": "high"}),
    ("peak_longevity_female_25", {**BASE_PAYLOAD, "chronologicalAge": 25, "gender": "female", "restingHeartRate": 48}),
    ("peak_longevity_male_65", {**BASE_PAYLOAD, "chronologicalAge": 65, "gender": "male", "restingHeartRate": 52}),
    ("extra_unknown_keys_resilience", {**BASE_PAYLOAD, "customMetaField": "stress_test_value", "extraNumeric": 9999}),
]


@pytest.mark.parametrize(
    "case_id,payload",
    BOUNDARY_PAYLOADS,
    ids=[c[0] for c in BOUNDARY_PAYLOADS],
)
def test_payload_boundary_and_stress(load_host, case_id, payload):
    """Verify boundary and stress payloads compute cleanly within 500ms."""
    t0 = time.perf_counter()
    res = SESSION.post(f"{load_host}/api/bioage/calculate", json=payload, timeout=10)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert res.status_code == 200
    assert res.json().get("success") is True
    assert elapsed_ms <= 500


# ------------------------------------------------------------------
# 06. Locust Benchmark SLA Gate Verification (20 Test Cases)
# ------------------------------------------------------------------
LOCUST_SLA_CHECKS = [
    ("normal_passed", "reports/load/normal-summary.json", "passed"),
    ("normal_non_zero_requests", "reports/load/normal-summary.json", "total_requests"),
    ("normal_avg_latency_sla", "reports/load/normal-summary.json", "avg_response_ms"),
    ("normal_p95_latency_sla", "reports/load/normal-summary.json", "p95_response_ms"),
    ("normal_error_rate_sla", "reports/load/normal-summary.json", "error_rate_pct"),
    ("heavy_passed", "reports/load/heavy-summary.json", "passed"),
    ("heavy_non_zero_requests", "reports/load/heavy-summary.json", "total_requests"),
    ("heavy_avg_latency_sla", "reports/load/heavy-summary.json", "avg_response_ms"),
    ("heavy_p95_latency_sla", "reports/load/heavy-summary.json", "p95_response_ms"),
    ("heavy_error_rate_sla", "reports/load/heavy-summary.json", "error_rate_pct"),
]


@pytest.mark.parametrize(
    "gate_id,summary_path,metric_key",
    LOCUST_SLA_CHECKS,
    ids=[c[0] for c in LOCUST_SLA_CHECKS],
)
def test_locust_sla_gate(gate_id, summary_path, metric_key):
    """Verify Locust benchmark SLA summary metric passed threshold gate."""
    assert os.path.exists(summary_path), f"Missing Locust summary: {summary_path}"
    with open(summary_path, encoding="utf-8") as f:
        data = json.load(f)

    if metric_key == "passed":
        assert data["passed"] is True
    elif metric_key == "total_requests":
        assert data["total_requests"] > 0
    elif metric_key == "avg_response_ms":
        assert data["avg_response_ms"] <= data["thresholds"]["max_avg_ms"]
    elif metric_key == "p95_response_ms":
        assert data["p95_response_ms"] <= data["thresholds"]["max_p95_ms"]
    elif metric_key == "error_rate_pct":
        assert data["error_rate_pct"] <= data["thresholds"]["max_error_rate_pct"]


LOCUST_ENDPOINTS = [
    "GET /api/health",
    "POST /api/bioage/calculate",
    "GET / (Frontend)",
    "GET /api/bioage/history/:userId",
    "POST /api/auth/login",
]

LOCUST_ENDPOINT_CASES = [
    (f"normal_ep_{idx+1}", "reports/load/normal_traffic_stats.csv", ep)
    for idx, ep in enumerate(LOCUST_ENDPOINTS)
] + [
    (f"heavy_ep_{idx+1}", "reports/load/heavy_traffic_stats.csv", ep)
    for idx, ep in enumerate(LOCUST_ENDPOINTS)
]


@pytest.mark.parametrize(
    "case_id,csv_path,endpoint_name",
    LOCUST_ENDPOINT_CASES,
    ids=[c[0] for c in LOCUST_ENDPOINT_CASES],
)
def test_locust_endpoint_metric(case_id, csv_path, endpoint_name):
    """Verify individual endpoint recorded zero failures during Locust load run."""
    assert os.path.exists(csv_path), f"Missing Locust CSV: {csv_path}"
    found = None
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("Name") == endpoint_name:
                found = row
                break
    assert found is not None, f"Endpoint {endpoint_name} missing in {csv_path}"
    assert int(float(found["Request Count"])) > 0
    assert int(float(found["Failure Count"])) == 0
