"""
BioAge Pro — Selenium Pytest Configuration & Excel Report Generator
- Provides session-scoped Headless Chrome WebDriver and auth helpers
- Automatically exports all executed test cases to an Excel workbook (.xlsx)
"""

import datetime
import os
import time
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

APP_URL = os.environ.get("APP_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
API_URL = os.environ.get("API_BASE_URL", APP_URL).rstrip("/")
TIMEOUT = int(os.environ.get("SELENIUM_TIMEOUT", "20"))
EXCEL_OUTPUT_PATH = os.environ.get(
    "SELENIUM_EXCEL_REPORT",
    "reports/selenium/BioAge_Pro_Selenium_Test_Results.xlsx",
)

# Collector for Excel report generation
_TEST_RESULTS = []
_SESSION_START = None

MODULE_LABELS = {
    "test_01_launch_and_layout.py": "01. Launch, Branding & Responsive Layout",
    "test_02_authentication_ui.py": "02. Authentication & Form Validation",
    "test_03_dashboard_and_navigation.py": "03. Dashboard & Core Navigation",
    "test_04_assessment_and_biomarkers.py": "04. Biomarker Assessment & Engine",
    "test_05_simulator_and_ai_assistant.py": "05. Longevity Simulator, Plan & AI",
    "test_06_profile_and_otp_grid.py": "06. Account Profile & 6-Digit OTP Grid",
}


def pytest_sessionstart(session):
    global _SESSION_START
    _SESSION_START = datetime.datetime.now(datetime.timezone.utc)
    _TEST_RESULTS.clear()


@pytest.fixture(scope="session")
def app_url():
    return APP_URL


@pytest.fixture(scope="session")
def api_url():
    return API_URL


@pytest.fixture(scope="session")
def driver():
    options = Options()
    if os.environ.get("SELENIUM_HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1440,900")
    browser = webdriver.Chrome(options=options)
    browser.implicitly_wait(3)
    yield browser
    browser.quit()


def login_demo_user(driver, email="alex@workplace.com", password="password123"):
    """Helper to sign into a demo account cleanly via the UI."""
    driver.get(APP_URL)
    wait = WebDriverWait(driver, TIMEOUT)

    # If already signed in as the requested user, return immediately
    try:
        disp = driver.find_element(By.ID, "user-display-name").text.strip().lower()
        if disp and disp != "guest":
            dropdown_email = driver.execute_script(
                "return document.getElementById('dropdown-user-email')?.textContent?.trim()?.toLowerCase() || '';"
            )
            if dropdown_email == email.lower():
                return
            # Otherwise clear session and reload login screen
            driver.execute_script("localStorage.clear(); sessionStorage.clear();")
            driver.get(APP_URL)
    except Exception:
        pass

    email_input = wait.until(EC.visibility_of_element_located((By.ID, "login-email")))
    pass_input = wait.until(EC.visibility_of_element_located((By.ID, "login-password")))

    # Wait past the 600ms autofill-purge timer in app.js
    time.sleep(0.75)

    driver.execute_script("arguments[0].removeAttribute('readonly');", email_input)
    driver.execute_script("arguments[0].removeAttribute('readonly');", pass_input)

    email_input.click()
    email_input.clear()
    email_input.send_keys(email)
    pass_input.click()
    pass_input.clear()
    pass_input.send_keys(password)

    submit_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-submit-login")))
    submit_btn.click()

    wait.until(
        lambda d: d.find_element(By.ID, "user-display-name").text.strip().lower()
        not in ("", "guest")
    )


def logout_user(driver):
    """Clear browser session storage and reload the auth view."""
    driver.execute_script("localStorage.clear(); sessionStorage.clear();")
    driver.get(APP_URL)
    WebDriverWait(driver, TIMEOUT).until(
        EC.visibility_of_element_located((By.ID, "login-form"))
    )


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()

    if rep.when == "call" or (rep.when == "setup" and rep.failed):
        # Capture failure screenshot
        if rep.failed:
            browser = item.funcargs.get("driver")
            if browser:
                os.makedirs("screenshots", exist_ok=True)
                safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in item.name)[:100]
                try:
                    browser.save_screenshot(f"screenshots/{safe_name}.png")
                except Exception:
                    pass

        file_name = os.path.basename(str(item.fspath))
        module_label = MODULE_LABELS.get(file_name, file_name)

        # Parse function name and parameters cleanly
        raw_name = item.name
        if "[" in raw_name and raw_name.endswith("]"):
            func_name = raw_name[: raw_name.index("[")]
            param_str = raw_name[raw_name.index("[") + 1 : -1]
        else:
            func_name = raw_name
            param_str = "-"

        doc = (item.obj.__doc__ or "").strip().splitlines()
        description = doc[0].strip() if doc else func_name.replace("test_", "").replace("_", " ").capitalize()

        status = "PASS" if rep.passed else ("SKIPPED" if rep.skipped else "FAIL")
        err_msg = ""
        if rep.failed and rep.longrepr:
            err_msg = str(rep.longrepr).splitlines()[-1][:300]

        _TEST_RESULTS.append(
            {
                "tc_id": f"TC-{len(_TEST_RESULTS) + 1:03d}",
                "module": module_label,
                "test_name": func_name,
                "parameters": param_str,
                "description": description,
                "status": status,
                "duration_ms": round(rep.duration * 1000, 1),
                "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "details": err_msg if err_msg else "Assertion verified successfully",
            }
        )


def _export_results_to_excel(results, output_path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    wb = Workbook()

    # Palette
    teal_dark = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
    teal_soft = PatternFill(start_color="CCFBF1", end_color="CCFBF1", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    pass_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    fail_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    skip_fill = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid")

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=15, bold=True, color="0F766E")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="475569")
    bold_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    regular_font = Font(name="Calibri", size=10, color="1E293B")
    pass_font = Font(name="Calibri", size=10, bold=True, color="166534")
    fail_font = Font(name="Calibri", size=10, bold=True, color="991B1B")
    skip_font = Font(name="Calibri", size=10, bold=True, color="854D0E")

    thin_side = Side(style="thin", color="CBD5E1")
    border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    # ------------------------------------------------------------------
    # Sheet 1: Executive Summary
    # ------------------------------------------------------------------
    ws_sum = wb.active
    ws_sum.title = "Executive Summary"
    ws_sum.views.sheetView[0].showGridLines = True

    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    skipped = sum(1 for r in results if r["status"] == "SKIPPED")
    pass_rate = round((passed / total * 100.0), 2) if total else 0.0
    total_sec = round(sum(r["duration_ms"] for r in results) / 1000.0, 2)

    ws_sum["A1"] = "BioAge Pro — Selenium Automated Functional Test Report"
    ws_sum["A1"].font = title_font
    ws_sum.merge_cells("A1:F1")

    ws_sum["A2"] = f"Target: {APP_URL}  |  Browser: Headless Chrome  |  Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    ws_sum["A2"].font = subtitle_font
    ws_sum.merge_cells("A2:F2")

    kpi_rows = [
        ("Total Test Cases Executed", total),
        ("Passed", passed),
        ("Failed", failed),
        ("Skipped", skipped),
        ("Overall Pass Rate (%)", f"{pass_rate:.2f}%"),
        ("Total Execution Time (s)", total_sec),
    ]

    ws_sum["A4"] = "Execution KPI"
    ws_sum["B4"] = "Value"
    for col in ("A4", "B4"):
        ws_sum[col].fill = teal_dark
        ws_sum[col].font = header_font
        ws_sum[col].border = border
        ws_sum[col].alignment = Alignment(horizontal="left", vertical="center")

    for idx, (label, val) in enumerate(kpi_rows, start=5):
        c1 = ws_sum.cell(row=idx, column=1, value=label)
        c2 = ws_sum.cell(row=idx, column=2, value=val)
        c1.font = bold_font
        c2.font = pass_font if label == "Passed" else (fail_font if label == "Failed" and failed > 0 else bold_font)
        c1.border = border
        c2.border = border
        if label == "Passed":
            c2.fill = pass_fill
        elif label == "Failed" and failed > 0:
            c2.fill = fail_fill
        elif idx % 2 == 1:
            c1.fill = zebra_fill
            c2.fill = zebra_fill
        c2.alignment = Alignment(horizontal="right", vertical="center")

    # Module Breakdown Table
    start_row = 13
    ws_sum.cell(row=start_row - 1, column=1, value="Module-Wise Test Breakdown").font = Font(
        name="Calibri", size=12, bold=True, color="0F766E"
    )
    mod_headers = ["Module", "Total Cases", "Passed", "Failed", "Skipped", "Pass Rate (%)"]
    for col_idx, h in enumerate(mod_headers, start=1):
        cell = ws_sum.cell(row=start_row, column=col_idx, value=h)
        cell.fill = teal_dark
        cell.font = header_font
        cell.border = border
        cell.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")

    modules = []
    for r in results:
        if r["module"] not in modules:
            modules.append(r["module"])

    for m_idx, mod in enumerate(modules, start=start_row + 1):
        m_items = [r for r in results if r["module"] == mod]
        m_total = len(m_items)
        m_pass = sum(1 for r in m_items if r["status"] == "PASS")
        m_fail = sum(1 for r in m_items if r["status"] == "FAIL")
        m_skip = sum(1 for r in m_items if r["status"] == "SKIPPED")
        m_rate = round((m_pass / m_total * 100.0), 2) if m_total else 0.0

        row_vals = [mod, m_total, m_pass, m_fail, m_skip, f"{m_rate:.2f}%"]
        for col_idx, val in enumerate(row_vals, start=1):
            c = ws_sum.cell(row=m_idx, column=col_idx, value=val)
            c.font = regular_font
            c.border = border
            c.alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")
            if m_idx % 2 == 1:
                c.fill = zebra_fill
            if col_idx == 6:
                c.fill = pass_fill if m_fail == 0 else fail_fill
                c.font = pass_font if m_fail == 0 else fail_font

    for col_idx, width in enumerate([44, 16, 12, 12, 12, 16], start=1):
        ws_sum.column_dimensions[get_column_letter(col_idx)].width = width

    # ------------------------------------------------------------------
    # Sheet 2: Detailed Test Cases (200+)
    # ------------------------------------------------------------------
    ws = wb.create_sheet(title="Test Case Results")
    ws.freeze_panes = "A2"

    headers = [
        "TC ID",
        "Module",
        "Test Case Name",
        "Parameters / Input",
        "Description / Expected Result",
        "Status",
        "Duration (ms)",
        "Timestamp",
        "Execution Details",
    ]
    for col_idx, h in enumerate(headers, start=1):
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

    col_widths = [11, 36, 38, 30, 44, 11, 14, 22, 38]
    for col_idx, width in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.auto_filter.ref = f"A1:I{max(len(results) + 1, 2)}"

    wb.save(output_path)
    print(f"\n[Excel Report] Exported {total} Selenium test cases -> {output_path}")


def pytest_sessionfinish(session, exitstatus):
    if _TEST_RESULTS:
        try:
            _export_results_to_excel(_TEST_RESULTS, EXCEL_OUTPUT_PATH)
        except Exception as exc:
            print(f"[Excel Report] Failed to export workbook: {exc}")
