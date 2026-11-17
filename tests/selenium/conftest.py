"""Pytest fixtures for Headless Chrome Selenium testing with automatic failure screenshots."""

from __future__ import annotations

import base64
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import pytest
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SCREENSHOTS_DIR = PROJECT_ROOT / "screenshots"
REPORTS_DIR = PROJECT_ROOT / "reports" / "selenium"

DEFAULT_APP_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
DEFAULT_API_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
DEFAULT_TIMEOUT = int(os.getenv("SELENIUM_TIMEOUT", "15"))


def _wait_for_http_ready(url: str, timeout_seconds: int = 45) -> None:
    """Poll an HTTP endpoint until it returns a 2xx/3xx response."""
    deadline = time.time() + timeout_seconds
    last_error: str = "no response"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:  # nosec B310
                if 200 <= resp.status < 400:
                    return
                last_error = f"HTTP {resp.status}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = str(exc)
        time.sleep(1.0)
    raise RuntimeError(f"Service at {url} did not become ready within {timeout_seconds}s ({last_error}).")


def _build_chrome_driver() -> webdriver.Chrome:
    """Create a configured Chrome WebDriver instance (headless by default)."""
    options = Options()
    headless = os.getenv("SELENIUM_HEADLESS", "true").strip().lower() not in ("0", "false", "no")
    if headless:
        options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-notifications")
    options.add_argument("--remote-allow-origins=*")
    options.set_capability("goog:loggingPrefs", {"browser": "SEVERE"})

    chrome_binary = os.getenv("CHROME_BINARY", "").strip()
    if chrome_binary:
        options.binary_location = chrome_binary

    chromedriver_path = os.getenv("CHROMEDRIVER_PATH", "").strip()
    if chromedriver_path:
        service = Service(executable_path=chromedriver_path)
        driver = webdriver.Chrome(service=service, options=options)
    else:
        driver = webdriver.Chrome(options=options)

    driver.set_page_load_timeout(30)
    driver.implicitly_wait(2)
    return driver


@pytest.fixture(scope="session")
def app_url() -> str:
    return DEFAULT_APP_URL


@pytest.fixture(scope="session")
def api_url() -> str:
    return DEFAULT_API_URL


@pytest.fixture(scope="session")
def driver(app_url: str, api_url: str):
    """Session-scoped Headless Chrome WebDriver shared across tests for fast CI execution."""
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    _wait_for_http_ready(f"{api_url}/api/health", timeout_seconds=45)
    _wait_for_http_ready(app_url, timeout_seconds=45)

    chrome_driver = _build_chrome_driver()
    yield chrome_driver
    try:
        chrome_driver.quit()
    except WebDriverException:
        pass


@pytest.fixture
def wait(driver: webdriver.Chrome) -> WebDriverWait:
    return WebDriverWait(driver, DEFAULT_TIMEOUT)


@pytest.fixture(autouse=True)
def ensure_signed_in_dashboard(driver: webdriver.Chrome, wait: WebDriverWait, app_url: str):
    """Reset the browser to a clean signed-in Dashboard state before every Selenium test."""
    driver.get(app_url)
    # Wait for either the main layout header or the Session Ended screen
    wait.until(
        lambda d: d.find_elements(By.TAG_NAME, "h1")
        or d.find_elements(By.XPATH, "//h2[normalize-space()='Session Ended']")
    )

    # If a previous test left the app logged out, sign back in
    sign_in_buttons = driver.find_elements(
        By.XPATH, "//button[contains(normalize-space(), 'Sign Back In')]"
    )
    if sign_in_buttons:
        sign_in_buttons[0].click()

    # Wait until the Dashboard has finished loading live backend data
    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(), 'System Online')]")
        )
    )
    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//h2[contains(normalize-space(), 'Scan URL for Threat Analysis')]")
        )
    )


@pytest.fixture
def navigate_to(driver: webdriver.Chrome, wait: WebDriverWait) -> Callable[[str, str], None]:
    """Helper fixture to navigate via the desktop sidebar and assert page header."""

    def _go(nav_label: str, expected_heading_substring: str) -> None:
        nav_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, f"//aside//nav//button[.//span[normalize-space()='{nav_label}']]")
            )
        )
        nav_btn.click()
        wait.until(
            EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), expected_heading_substring)
        )

    return _go


def _sanitize_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name).strip("_")[:120]


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Capture a full-viewport PNG screenshot whenever any Selenium test fails."""
    outcome = yield
    report = outcome.get_result()

    if report.when in ("setup", "call") and report.failed:
        chrome_driver = item.funcargs.get("driver")
        if chrome_driver is None:
            return

        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_name = _sanitize_filename(item.nodeid)
        screenshot_path = SCREENSHOTS_DIR / f"FAIL_{safe_name}_{stamp}.png"

        try:
            chrome_driver.save_screenshot(str(screenshot_path))
            # Attach screenshot directly inside pytest-html report when enabled
            pytest_html = item.config.pluginmanager.getplugin("html")
            if pytest_html is not None:
                png_b64 = base64.b64encode(screenshot_path.read_bytes()).decode("ascii")
                extras = getattr(report, "extras", [])
                extras.append(pytest_html.extras.image(png_b64, mime_type="image/png"))
                report.extras = extras
        except (WebDriverException, OSError, TimeoutException):
            pass
