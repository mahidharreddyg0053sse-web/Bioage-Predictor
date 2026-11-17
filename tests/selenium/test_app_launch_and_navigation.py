"""Selenium tests covering PhishGuard application launch and multi-page navigation."""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

pytestmark = [pytest.mark.selenium]


@pytest.mark.smoke
def test_application_launch_and_dashboard_telemetry(driver, wait):
    """Verify the application launches cleanly, connects to FastAPI, and renders KPIs."""
    assert "PhishGuard" in driver.title or "PhishGuard" in driver.page_source

    # Confirm live backend status indicator
    status_pill = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(), 'System Online')]")
        )
    )
    assert "System Online" in status_pill.text

    # Confirm Welcome heading & all 4 KPI telemetry cards
    h1 = wait.until(EC.visibility_of_element_located((By.TAG_NAME, "h1")))
    assert "Welcome back," in h1.text

    expected_kpi_titles = [
        "Total URLs Scanned",
        "Phishing Detected",
        "Safe URLs",
        "Critical Threats",
    ]
    body_text = driver.find_element(By.TAG_NAME, "body").text
    for title in expected_kpi_titles:
        assert title in body_text, f"Expected KPI card '{title}' on dashboard"

    # Confirm Threat Overview, TI Sources, and Recent Scanning Activity sections exist
    assert "Threat Overview" in body_text
    assert "Threat Intelligence Sources" in body_text
    assert "Recent Scanning Activity" in body_text


@pytest.mark.smoke
@pytest.mark.parametrize(
    ("nav_label", "expected_heading", "expected_content"),
    [
        ("URL Scanner", "URL Threat Scanner", "Analyze Suspicious URL"),
        ("Threat Intelligence", "Threat Intelligence", "Threat Indicators (IoC) Database"),
        ("Threat Correlation", "Threat Correlation Engine", "Correlate ML Detection"),
        ("Scan History", "Scan History", "Scanned URLs Archive"),
        ("Analytics", "Security Analytics", "Analytics"),
        ("Reports", "Security Reports", "Generated Reports Archive"),
        ("Settings", "Settings & System Status", "User Profile Settings"),
        ("Dashboard", "Welcome back,", "Scan URL for Threat Analysis"),
    ],
)
def test_sidebar_navigation_between_all_pages(
    driver, wait, navigate_to, nav_label, expected_heading, expected_content
):
    """Verify seamless navigation across all 8 pages in the sidebar."""
    navigate_to(nav_label, expected_heading)

    wait.until(
        lambda d: expected_content in d.find_element(By.TAG_NAME, "body").text
    )
    assert expected_content in driver.find_element(By.TAG_NAME, "body").text


def test_dashboard_contextual_navigation_buttons(driver, wait):
    """Verify cross-page shortcut buttons on Dashboard navigate to expected pages."""
    # 1. 'Manage' button -> Threat Intelligence
    manage_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Manage']"))
    )
    manage_btn.click()
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Threat Intelligence"))

    # Return to Dashboard via brand logo button
    logo_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//aside//button[.//*[contains(text(),'PhishGuard')]]"))
    )
    logo_btn.click()
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Welcome back,"))

    # 2. 'View All' -> Scan History
    view_all_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(normalize-space(), 'View All')]"))
    )
    view_all_btn.click()
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Scan History"))

    # Return to Dashboard
    dash_btn = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//aside//nav//button[.//span[normalize-space()='Dashboard']]")
        )
    )
    dash_btn.click()
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Welcome back,"))

    # 3. 'Learn More' -> Threat Correlation
    learn_more_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(normalize-space(), 'Learn More')]"))
    )
    learn_more_btn.click()
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Threat Correlation Engine"))
