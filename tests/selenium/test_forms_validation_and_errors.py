"""Selenium tests for Form Validation, Error Handling, URL Scanning, and Scan History."""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC

pytestmark = [pytest.mark.selenium]


def _clear_and_type(element, value: str) -> None:
    element.click()
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.BACKSPACE)
    if value:
        element.send_keys(value)


@pytest.mark.smoke
@pytest.mark.parametrize(
    ("invalid_url", "expected_error_fragment"),
    [
        ("", "Please enter a URL to scan"),
        ("https://example.com/bad url", "must not contain spaces"),
        ("javascript:alert(1)", "Unsupported URL scheme"),
        ("file:///etc/passwd", "Unsupported URL scheme"),
        ("http://127.0.0.1/admin", "blocked for security"),
        ("http://169.254.169.254/latest/meta-data", "blocked for security"),
        ("not-a-valid-hostname", "Enter a valid domain name"),
    ],
)
def test_dashboard_quick_scan_form_validation(driver, wait, invalid_url, expected_error_fragment):
    """Verify client-side URL & SSRF form validation on the Dashboard quick scanner."""
    url_input = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[placeholder*="Enter URL"]'))
    )
    _clear_and_type(url_input, invalid_url)

    submit_btn = driver.find_element(
        By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Scan Now')]"
    )
    submit_btn.click()

    error_el = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, f"//p[contains(@class, 'text-red-600') and contains(., '{expected_error_fragment}')]")
        )
    )
    assert expected_error_fragment in error_el.text


def test_url_scanner_error_banner_handling(driver, wait, navigate_to):
    """Verify URL Scanner displays and dismisses ErrorBanner on blocked/invalid URLs."""
    navigate_to("URL Scanner", "URL Threat Scanner")

    url_input = wait.until(
        EC.visibility_of_element_located(
            (By.CSS_SELECTOR, 'input[placeholder*="https://example.com/verify/account"]')
        )
    )
    _clear_and_type(url_input, "http://localhost:8000/internal")

    scan_btn = driver.find_element(
        By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Scan URL')]"
    )
    scan_btn.click()

    err_banner = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(), 'blocked for security')]")
        )
    )
    assert err_banner.is_displayed()


@pytest.mark.slow
def test_url_scanner_safe_and_phishing_end_to_end(driver, wait, navigate_to):
    """Verify full UI scan workflow for both Safe and Phishing URLs with ML + 28 features."""
    navigate_to("URL Scanner", "URL Threat Scanner")

    # Disable external DNS lookup for deterministic CI speed
    dns_checkbox = wait.until(
        EC.presence_of_element_located(
            (By.XPATH, "//label[contains(., 'Resolve DNS')]//input[@type='checkbox']")
        )
    )
    if dns_checkbox.is_selected():
        dns_checkbox.click()

    url_input = wait.until(
        EC.visibility_of_element_located(
            (By.CSS_SELECTOR, 'input[placeholder*="https://example.com/verify/account"]')
        )
    )
    scan_btn = driver.find_element(
        By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Scan URL')]"
    )

    # 1. Scan legitimate URL
    _clear_and_type(url_input, "https://github.com/openai/openai-python")
    scan_btn.click()

    wait.until(
        EC.visibility_of_element_located((By.XPATH, "//h3[normalize-space()='Threat Verdict']"))
    )
    wait.until(
        lambda d: "github.com/openai/openai-python" in d.find_element(By.TAG_NAME, "body").text
    )
    page_text = driver.find_element(By.TAG_NAME, "body").text
    assert "Combined Risk Score" in page_text
    assert "Safe" in page_text
    assert "Extracted URL Feature Signals" in page_text

    # 2. Scan suspicious/phishing URL
    _clear_and_type(url_input, "http://paypal-verify-account.top/signin")
    scan_btn.click()

    wait.until(
        lambda d: "paypal-verify-account.top/signin" in d.find_element(By.TAG_NAME, "body").text
    )
    phish_text = driver.find_element(By.TAG_NAME, "body").text
    assert "Threat Verdict" in phish_text
    assert any(label in phish_text for label in ("Phishing", "Malicious", "Suspicious"))


def test_threat_intelligence_empty_lookup_validation(driver, wait, navigate_to):
    """Verify empty form submission on Threat Intelligence displays validation error."""
    navigate_to("Threat Intelligence", "Threat Intelligence")

    check_btn = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Check Reputation')]")
        )
    )
    check_btn.click()

    err = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(), 'Please enter a domain, URL, or IP address')]")
        )
    )
    assert err.is_displayed()


def test_settings_profile_html5_email_validation(driver, wait, navigate_to):
    """Verify HTML5 form constraint validation rejects malformed email in Settings."""
    navigate_to("Settings", "Settings & System Status")

    email_input = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//label[normalize-space()='Email']/following-sibling::input")
        )
    )
    _clear_and_type(email_input, "invalid-email-without-at-sign")

    is_valid = driver.execute_script("return arguments[0].checkValidity();", email_input)
    assert is_valid is False, "Expected HTML5 email input validation to reject malformed email"


def test_scan_history_search_and_detail_modal(driver, wait, navigate_to):
    """Verify Scan History search filter works and Scan Investigation Details modal opens/closes."""
    navigate_to("Scan History", "Scan History")

    wait.until(EC.visibility_of_element_located((By.TAG_NAME, "table")))

    details_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "(//button[contains(normalize-space(), 'Details')])[1]"))
    )
    details_btn.click()

    modal_heading = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//h3[normalize-space()='Scan Investigation Details']")
        )
    )
    assert modal_heading.is_displayed()

    close_btn = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Close modal"]'))
    )
    close_btn.click()

    wait.until(
        EC.invisibility_of_element_located(
            (By.XPATH, "//h3[normalize-space()='Scan Investigation Details']")
        )
    )
