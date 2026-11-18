"""
BioAge Pro — OWASP Security & Vulnerability Pytest Configuration & Excel Exporter
Exports all 225+ security control test cases into:
  reports/security/BioAge_Pro_Security_Test_Results.xlsx
"""

import datetime
import os
import pytest

API_BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
EXCEL_OUTPUT_PATH = os.environ.get(
    "SECURITY_EXCEL_REPORT",
    "reports/security/BioAge_Pro_Security_Test_Results.xlsx",
)

_SEC_RESULTS = []

OWASP_CATEGORIES = {
    "test_http_security_header": "A05: Security Misconfiguration & HTTP Headers",
    "test_sensitive_path_blocked": "A01: Broken Access Control & File Exposure",
    "test_auth_missing_credentials": "A07: Authentication & Session Controls",
    "test_auth_unknown_email_rejected": "A07: Authentication & Session Controls",
    "test_auth_wrong_password_rejected": "A07: Authentication & Session Controls",
    "test_registration_validation_controls": "A07: Authentication & Session Controls",
    "test_login_injection_resilience": "A03: Injection Resilience (SQLi/NoSQLi)",
    "test_api_injection_resilience": "A03: Injection Resilience (SQLi/NoSQLi)",
    "test_xss_payload_not_reflected_unescaped": "A03: Cross-Site Scripting (XSS) Controls",
    "test_content_type_mime_protection": "A03: Cross-Site Scripting (XSS) Controls",
    "test_input_validation_and_dos_resilience": "A04: Insecure Design, Validation & DoS",
    "test_source_secret_and_crypto_hygiene": "A02: Cryptographic & Secret Hygiene",
}


def pytest_sessionstart(session):
    _SEC_RESULTS.clear()


@pytest.fixture(scope="session")
def api_base():
    return API_BASE


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

        category = OWASP_CATEGORIES.get(func_name, "OWASP Security Control Verification")
        doc = (item.obj.__doc__ or "").strip().splitlines()
        description = doc[0].strip() if doc else func_name.replace("test_", "").replace("_", " ").capitalize()

        status = "PASS" if rep.passed else ("SKIPPED" if rep.skipped else "FAIL")
        err_msg = ""
        if rep.failed and rep.longrepr:
            err_msg = str(rep.longrepr).splitlines()[-1][:300]

        _SEC_RESULTS.append(
            {
                "tc_id": f"SEC-{len(_SEC_RESULTS) + 1:03d}",
                "category": category,
                "test_name": func_name,
                "parameters": param_str,
                "description": description,
                "status": status,
                "duration_ms": round(rep.duration * 1000, 1),
                "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "details": err_msg if err_msg else "Security control enforced & verified",
            }
        )


def _export_security_excel(results, output_path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    wb = Workbook()

    navy_dark = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    teal_dark = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    pass_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    fail_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    skip_fill = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid")

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=15, bold=True, color="0F172A")
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

    ws_sum["A1"] = "BioAge Pro — Vulnerability & OWASP Security Testing Report"
    ws_sum["A1"].font = title_font
    ws_sum.merge_cells("A1:F1")

    ws_sum["A2"] = (
        f"Target: {API_BASE}  |  Suite: OWASP Top 10 Security Controls (225 Cases)  |  "
        f"Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )
    ws_sum["A2"].font = subtitle_font
    ws_sum.merge_cells("A2:F2")

    ws_sum["A4"] = "Security Execution KPI"
    ws_sum["B4"] = "Value"
    for ref in ("A4", "B4"):
        ws_sum[ref].fill = navy_dark
        ws_sum[ref].font = header_font
        ws_sum[ref].border = border

    kpis = [
        ("Total Security Test Cases Executed", total),
        ("Passed (Controls Enforced)", passed),
        ("Failed (Vulnerabilities / Issues)", failed),
        ("Skipped", skipped),
        ("Overall Security Pass Rate (%)", f"{pass_rate:.2f}%"),
        ("Total Execution Time (s)", total_sec),
    ]
    for idx, (lbl, val) in enumerate(kpis, start=5):
        c1 = ws_sum.cell(row=idx, column=1, value=lbl)
        c2 = ws_sum.cell(row=idx, column=2, value=val)
        c1.font = bold_font
        c2.font = pass_font if "Passed" in lbl else (fail_font if "Failed" in lbl and failed > 0 else bold_font)
        c1.border = border
        c2.border = border
        if "Passed" in lbl:
            c2.fill = pass_fill
        elif "Failed" in lbl and failed > 0:
            c2.fill = fail_fill
        elif idx % 2 == 1:
            c1.fill = zebra_fill
            c2.fill = zebra_fill
        c2.alignment = Alignment(horizontal="right", vertical="center")

    start_row = 13
    ws_sum.cell(row=start_row - 1, column=1, value="OWASP Category Breakdown").font = section_font
    cat_headers = ["OWASP Security Category", "Total Cases", "Passed", "Failed", "Skipped", "Pass Rate (%)"]
    for col_idx, h in enumerate(cat_headers, start=1):
        c = ws_sum.cell(row=start_row, column=col_idx, value=h)
        c.fill = teal_dark
        c.font = header_font
        c.border = border
        c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")

    cats = []
    for r in results:
        if r["category"] not in cats:
            cats.append(r["category"])

    for c_idx, cat in enumerate(cats, start=start_row + 1):
        items = [r for r in results if r["category"] == cat]
        ct = len(items)
        cp = sum(1 for r in items if r["status"] == "PASS")
        cf = sum(1 for r in items if r["status"] == "FAIL")
        cs = sum(1 for r in items if r["status"] == "SKIPPED")
        cr = round((cp / ct * 100.0), 2) if ct else 0.0

        for col_idx, val in enumerate([cat, ct, cp, cf, cs, f"{cr:.2f}%"], start=1):
            c = ws_sum.cell(row=c_idx, column=col_idx, value=val)
            c.font = regular_font
            c.border = border
            c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")
            if c_idx % 2 == 1:
                c.fill = zebra_fill
            if col_idx == 6:
                c.fill = pass_fill if cf == 0 else fail_fill
                c.font = pass_font if cf == 0 else fail_font

    for col_idx, w in enumerate([48, 16, 12, 12, 12, 16], start=1):
        ws_sum.column_dimensions[get_column_letter(col_idx)].width = w

    # ------------------------------------------------------------------
    # Sheet 2: Detailed Security Test Cases (225)
    # ------------------------------------------------------------------
    ws = wb.create_sheet(title="Security Test Cases")
    ws.freeze_panes = "A2"
    headers = [
        "TC ID",
        "OWASP Security Category",
        "Test Case Name",
        "Target / Probe Vector",
        "Expected Security Control",
        "Status",
        "Duration (ms)",
        "Timestamp",
        "Verification Details",
    ]
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=col_idx, value=h)
        c.fill = navy_dark
        c.font = header_font
        c.border = border
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 26

    for r_idx, item in enumerate(results, start=2):
        vals = [
            item["tc_id"],
            item["category"],
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

    for col_idx, w in enumerate([11, 44, 38, 34, 44, 11, 14, 22, 36], start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = w

    ws.auto_filter.ref = f"A1:I{max(len(results) + 1, 2)}"

    wb.save(output_path)
    print(f"\n[Excel Report] Exported {total} OWASP Security test cases -> {output_path}")


def pytest_sessionfinish(session, exitstatus):
    if _SEC_RESULTS:
        try:
            _export_security_excel(_SEC_RESULTS, EXCEL_OUTPUT_PATH)
        except Exception as exc:
            print(f"[Excel Report] Failed to export security workbook: {exc}")
