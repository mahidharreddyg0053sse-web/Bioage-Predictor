"""
BioAge Pro — Load & Performance Pytest Configuration & Excel Report Generator
Exports all 220+ load/performance test cases AND Locust benchmark CSV/JSON metrics
into a styled multi-sheet Excel workbook: reports/load/BioAge_Pro_Load_Test_Results.xlsx
"""

import csv
import datetime
import json
import os
import pytest

LOAD_HOST = os.environ.get("LOAD_TARGET_HOST", "http://127.0.0.1:3000").rstrip("/")
EXCEL_OUTPUT_PATH = os.environ.get(
    "LOAD_EXCEL_REPORT",
    "reports/load/BioAge_Pro_Load_Test_Results.xlsx",
)

_LOAD_RESULTS = []

CATEGORY_LABELS = {
    "test_endpoint_latency_sla": "01. Endpoint Latency SLA Verification",
    "test_bioage_engine_throughput_and_latency": "02. BioAge Calculation Engine Load",
    "test_auth_endpoint_burst_load": "03. Auth & Session Endpoint Load",
    "test_concurrent_multi_user_burst": "04. Concurrent Multi-User Bursts",
    "test_payload_boundary_and_stress": "05. Payload Stress & Boundary Perf",
    "test_locust_sla_gate": "06. Locust Benchmark SLA Gates",
    "test_locust_endpoint_metric": "06. Locust Benchmark SLA Gates",
}


def pytest_sessionstart(session):
    _LOAD_RESULTS.clear()


@pytest.fixture(scope="session")
def load_host():
    return LOAD_HOST


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()

    if rep.when == "call" or (rep.when == "setup" and rep.failed):
        raw_name = item.name
        if "[" in raw_name and raw_name.endswith("]"):
            func_name = raw_name[: raw_name.index("[")]
            param_str = raw_name[raw_name.index("[") + 1 : -1]
        else:
            func_name = raw_name
            param_str = "-"

        module_label = CATEGORY_LABELS.get(func_name, "Load & Performance Tests")
        doc = (item.obj.__doc__ or "").strip().splitlines()
        description = doc[0].strip() if doc else func_name.replace("test_", "").replace("_", " ").capitalize()

        status = "PASS" if rep.passed else ("SKIPPED" if rep.skipped else "FAIL")
        err_msg = ""
        if rep.failed and rep.longrepr:
            err_msg = str(rep.longrepr).splitlines()[-1][:300]

        _LOAD_RESULTS.append(
            {
                "tc_id": f"LT-{len(_LOAD_RESULTS) + 1:03d}",
                "module": module_label,
                "test_name": func_name,
                "parameters": param_str,
                "description": description,
                "status": status,
                "duration_ms": round(rep.duration * 1000, 1),
                "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "details": err_msg if err_msg else "Latency & SLA threshold verified",
            }
        )


def _read_json_safe(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return None


def _read_locust_csv(path, profile_label):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                [
                    profile_label,
                    r.get("Type") or "-",
                    r.get("Name") or "-",
                    int(float(r.get("Request Count", 0) or 0)),
                    int(float(r.get("Failure Count", 0) or 0)),
                    round(float(r.get("Average Response Time", 0) or 0), 2),
                    round(float(r.get("Min Response Time", 0) or 0), 2),
                    round(float(r.get("Max Response Time", 0) or 0), 2),
                    round(float(r.get("95%", 0) or 0), 2),
                    round(float(r.get("Requests/s", 0) or 0), 2),
                ]
            )
    return rows


def _export_load_excel(results, output_path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    wb = Workbook()

    teal_dark = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
    blue_dark = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    pass_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    fail_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    skip_fill = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid")

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=15, bold=True, color="0F766E")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="475569")
    section_font = Font(name="Calibri", size=12, bold=True, color="0F766E")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    regular_font = Font(name="Calibri", size=10, color="1E293B")
    pass_font = Font(name="Calibri", size=10, bold=True, color="166534")
    fail_font = Font(name="Calibri", size=10, bold=True, color="991B1B")
    skip_font = Font(name="Calibri", size=10, bold=True, color="854D0E")

    thin = Side(style="thin", color="CBD5E1")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # ------------------------------------------------------------------
    # Sheet 1: Executive Summary
    # ------------------------------------------------------------------
    ws_sum = wb.active
    ws_sum.title = "Executive Summary"

    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    skipped = sum(1 for r in results if r["status"] == "SKIPPED")
    pass_rate = round((passed / total * 100.0), 2) if total else 0.0
    total_sec = round(sum(r["duration_ms"] for r in results) / 1000.0, 2)

    ws_sum["A1"] = "BioAge Pro — Load & Performance Test Report (Locust + 220 Cases)"
    ws_sum["A1"].font = title_font
    ws_sum.merge_cells("A1:G1")

    ws_sum["A2"] = (
        f"Target: {LOAD_HOST}  |  Tool: Locust + Pytest Load Suite  |  "
        f"Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )
    ws_sum["A2"].font = subtitle_font
    ws_sum.merge_cells("A2:G2")

    # KPI block
    ws_sum["A4"] = "Execution KPI"
    ws_sum["B4"] = "Value"
    for ref in ("A4", "B4"):
        ws_sum[ref].fill = teal_dark
        ws_sum[ref].font = header_font
        ws_sum[ref].border = border

    kpis = [
        ("Total Load Test Cases Executed", total),
        ("Passed", passed),
        ("Failed", failed),
        ("Skipped", skipped),
        ("Overall Pass Rate (%)", f"{pass_rate:.2f}%"),
        ("Total Pytest Load Duration (s)", total_sec),
    ]
    for idx, (lbl, val) in enumerate(kpis, start=5):
        c1 = ws_sum.cell(row=idx, column=1, value=lbl)
        c2 = ws_sum.cell(row=idx, column=2, value=val)
        c1.font = bold_font
        c2.font = pass_font if lbl == "Passed" else (fail_font if lbl == "Failed" and failed > 0 else bold_font)
        c1.border = border
        c2.border = border
        if lbl == "Passed":
            c2.fill = pass_fill
        elif lbl == "Failed" and failed > 0:
            c2.fill = fail_fill
        elif idx % 2 == 1:
            c1.fill = zebra_fill
            c2.fill = zebra_fill
        c2.alignment = Alignment(horizontal="right", vertical="center")

    # Locust Benchmark Summary Table
    normal_sum = _read_json_safe("reports/load/normal-summary.json")
    heavy_sum = _read_json_safe("reports/load/heavy-summary.json")

    loc_row = 13
    ws_sum.cell(row=loc_row - 1, column=1, value="Locust Traffic Benchmark Summary").font = section_font
    loc_headers = [
        "Traffic Profile",
        "Concurrent Users",
        "Total Requests",
        "Error Rate (%)",
        "Avg Latency (ms)",
        "P95 Latency (ms)",
        "Throughput (req/s)",
    ]
    for col_idx, h in enumerate(loc_headers, start=1):
        c = ws_sum.cell(row=loc_row, column=col_idx, value=h)
        c.fill = blue_dark
        c.font = header_font
        c.border = border
        c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")

    cur_r = loc_row + 1
    for prof_name, data in [("Normal Traffic", normal_sum), ("Heavy Traffic", heavy_sum)]:
        if data:
            vals = [
                prof_name,
                data.get("users", 0),
                data.get("total_requests", 0),
                f"{data.get('error_rate_pct', 0):.2f}%",
                data.get("avg_response_ms", 0),
                data.get("p95_response_ms", 0),
                data.get("requests_per_second", 0),
            ]
            for col_idx, val in enumerate(vals, start=1):
                c = ws_sum.cell(row=cur_r, column=col_idx, value=val)
                c.font = bold_font if col_idx == 1 else regular_font
                c.border = border
                c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")
                if cur_r % 2 == 1:
                    c.fill = zebra_fill
            cur_r += 1

    # Module Breakdown Table
    mod_row = cur_r + 2
    ws_sum.cell(row=mod_row - 1, column=1, value="Module-Wise Load Test Breakdown").font = section_font
    mod_headers = ["Module", "Total Cases", "Passed", "Failed", "Skipped", "Pass Rate (%)"]
    for col_idx, h in enumerate(mod_headers, start=1):
        c = ws_sum.cell(row=mod_row, column=col_idx, value=h)
        c.fill = teal_dark
        c.font = header_font
        c.border = border
        c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")

    modules = []
    for r in results:
        if r["module"] not in modules:
            modules.append(r["module"])

    for idx, mod in enumerate(modules, start=mod_row + 1):
        m_items = [r for r in results if r["module"] == mod]
        m_tot = len(m_items)
        m_pass = sum(1 for r in m_items if r["status"] == "PASS")
        m_fail = sum(1 for r in m_items if r["status"] == "FAIL")
        m_skip = sum(1 for r in m_items if r["status"] == "SKIPPED")
        m_rate = round((m_pass / m_tot * 100.0), 2) if m_tot else 0.0

        for col_idx, val in enumerate([mod, m_tot, m_pass, m_fail, m_skip, f"{m_rate:.2f}%"], start=1):
            c = ws_sum.cell(row=idx, column=col_idx, value=val)
            c.font = regular_font
            c.border = border
            c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")
            if idx % 2 == 1:
                c.fill = zebra_fill
            if col_idx == 6:
                c.fill = pass_fill if m_fail == 0 else fail_fill
                c.font = pass_font if m_fail == 0 else fail_font

    for col_idx, w in enumerate([42, 18, 16, 16, 18, 18, 20], start=1):
        ws_sum.column_dimensions[get_column_letter(col_idx)].width = w

    # ------------------------------------------------------------------
    # Sheet 2: Locust Endpoint Metrics
    # ------------------------------------------------------------------
    ws_loc = wb.create_sheet(title="Locust Endpoint Metrics")
    ws_loc.freeze_panes = "A2"
    ep_headers = [
        "Profile",
        "Method",
        "Endpoint",
        "Requests",
        "Failures",
        "Avg (ms)",
        "Min (ms)",
        "Max (ms)",
        "P95 (ms)",
        "RPS",
    ]
    for col_idx, h in enumerate(ep_headers, start=1):
        c = ws_loc.cell(row=1, column=col_idx, value=h)
        c.fill = blue_dark
        c.font = header_font
        c.border = border
        c.alignment = Alignment(horizontal="center", vertical="center")
    ws_loc.row_dimensions[1].height = 24

    ep_rows = _read_locust_csv("reports/load/normal_traffic_stats.csv", "Normal Traffic") + _read_locust_csv(
        "reports/load/heavy_traffic_stats.csv", "Heavy Traffic"
    )
    for r_idx, row_vals in enumerate(ep_rows, start=2):
        is_agg = row_vals[2] == "Aggregated"
        for col_idx, val in enumerate(row_vals, start=1):
            c = ws_loc.cell(row=r_idx, column=col_idx, value=val)
            c.border = border
            c.font = bold_font if is_agg else regular_font
            c.alignment = Alignment(horizontal="left" if col_idx in (1, 3) else "center", vertical="center")
            if is_agg:
                c.fill = pass_fill
            elif r_idx % 2 == 1:
                c.fill = zebra_fill

    for col_idx, w in enumerate([16, 10, 34, 12, 10, 12, 12, 12, 12, 12], start=1):
        ws_loc.column_dimensions[get_column_letter(col_idx)].width = w

    # ------------------------------------------------------------------
    # Sheet 3: Detailed Load Test Cases (220+)
    # ------------------------------------------------------------------
    ws = wb.create_sheet(title="Load Test Cases")
    ws.freeze_panes = "A2"
    tc_headers = [
        "TC ID",
        "Module",
        "Test Case Name",
        "Parameters / Profile",
        "Description / SLA Checked",
        "Status",
        "Duration (ms)",
        "Timestamp",
        "Execution Details",
    ]
    for col_idx, h in enumerate(tc_headers, start=1):
        c = ws.cell(row=1, column=col_idx, value=h)
        c.fill = teal_dark
        c.font = header_font
        c.border = border
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 26

    for r_idx, item in enumerate(results, start=2):
        vals = [
            item["tc_id"],
            item["module"],
            item["test_name"],
            item["parameters"],
            item["description"],
            item["status"],
            item["duration_ms"],
            item["timestamp"],
            item["details"],
        ]
        for col_idx, val in enumerate(vals, start=1):
            c = ws.cell(row=r_idx, column=col_idx, value=val)
            c.border = border
            c.font = regular_font
            c.alignment = Alignment(
                horizontal="center" if col_idx in (1, 6, 7, 8) else "left",
                vertical="center",
                wrap_text=True,
            )
            if col_idx == 6:
                if val == "PASS":
                    c.fill = pass_fill
                    c.font = pass_font
                elif val == "FAIL":
                    c.fill = fail_fill
                    c.font = fail_font
                else:
                    c.fill = skip_fill
                    c.font = skip_font
            elif r_idx % 2 == 1:
                c.fill = zebra_fill

    for col_idx, w in enumerate([11, 36, 40, 32, 44, 11, 14, 22, 36], start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = w

    ws.auto_filter.ref = f"A1:I{max(len(results) + 1, 2)}"

    wb.save(output_path)
    print(f"\n[Excel Report] Exported {total} Load & Performance test cases -> {output_path}")


def pytest_sessionfinish(session, exitstatus):
    if _LOAD_RESULTS:
        try:
            _export_load_excel(_LOAD_RESULTS, EXCEL_OUTPUT_PATH)
        except Exception as exc:
            print(f"[Excel Report] Failed to export load workbook: {exc}")
