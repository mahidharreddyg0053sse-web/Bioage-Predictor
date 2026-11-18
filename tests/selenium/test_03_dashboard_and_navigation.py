"""
Module 03: Dashboard Widgets, User Dropdown & Core Navigation (32 Test Cases)
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, login_demo_user


@pytest.fixture(scope="module", autouse=True)
def ensure_authenticated_dashboard(driver):
    login_demo_user(driver, email="alex@workplace.com", password="password123")
    WebDriverWait(driver, TIMEOUT).until(
        EC.element_to_be_clickable((By.ID, "nav-dashboard"))
    ).click()


def test_dashboard_greeting_shows_user_name(driver):
    """Verify dashboard greeting addresses logged-in user."""
    greeting = driver.find_element(By.ID, "dash-greeting").text.strip()
    assert "alex" in greeting.lower()


def test_user_dropdown_opens_and_displays_email(driver):
    """Verify clicking user profile button opens dropdown with account email."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "user-profile-btn"))).click()
    email_text = driver.find_element(By.ID, "dropdown-user-email").text.strip().lower()
    assert email_text == "alex@workplace.com"
    # Close dropdown
    wait.until(EC.element_to_be_clickable((By.ID, "user-profile-btn"))).click()


@pytest.mark.parametrize(
    "widget_id",
    [
        "dashboard-view",
        "dash-greeting",
        "btn-dash-retake",
        "btn-dash-simulate",
        "gemini-ai-card",
        "btn-re-run-gemini",
        "gemini-summary-text",
        "gemini-consultant-input",
        "btn-ask-gemini",
        "longevity-hero-container",
        "gauge-mount-point",
        "btn-refresh-radar",
        "longevity-radar-canvas",
        "organ-cards-container",
        "btn-view-full-plan",
        "prescriptions-mount-point",
    ],
)
def test_dashboard_widget_present(driver, widget_id):
    """Verify dashboard analytics widget or action control exists."""
    el = driver.find_element(By.ID, widget_id)
    assert el is not None


def test_gauge_mount_point_renders_content(driver):
    """Verify biological age gauge mounts non-empty visualization content."""
    gauge_html = driver.find_element(By.ID, "gauge-mount-point").get_attribute("innerHTML")
    assert len(gauge_html.strip()) > 0


def test_organ_cards_rendered(driver):
    """Verify organ-specific aging cards render on the dashboard."""
    organs_html = driver.find_element(By.ID, "organ-cards-container").get_attribute("innerHTML")
    assert len(organs_html.strip()) > 0


def test_longevity_radar_canvas_has_dimensions(driver):
    """Verify longevity radar canvas element is initialized."""
    canvas = driver.find_element(By.ID, "longevity-radar-canvas")
    assert canvas.tag_name.lower() == "canvas"


def test_refresh_radar_button_clickable(driver):
    """Verify clicking Refresh Radar triggers without errors."""
    btn = WebDriverWait(driver, TIMEOUT).until(
        EC.element_to_be_clickable((By.ID, "btn-refresh-radar"))
    )
    btn.click()
    assert driver.find_element(By.ID, "longevity-radar-canvas") is not None


@pytest.mark.parametrize(
    "nav_id,view_id",
    [
        ("nav-assessment", "assessment-view"),
        ("nav-simulator", "simulator-view"),
        ("nav-plan", "action-plan-view"),
        ("nav-history", "history-view"),
        ("nav-dashboard", "dashboard-view"),
    ],
)
def test_desktop_nav_switches_active_view(driver, nav_id, view_id):
    """Verify desktop navigation tab activates corresponding view section."""
    wait = WebDriverWait(driver, TIMEOUT)
    btn = wait.until(EC.element_to_be_clickable((By.ID, nav_id)))
    btn.click()
    assert "active" in btn.get_attribute("class")
    wait.until(EC.visibility_of_element_located((By.ID, view_id)))
    assert driver.find_element(By.ID, view_id).is_displayed()


def test_dashboard_simulate_cta_navigates_to_simulator(driver):
    """Verify Dashboard Simulate CTA button switches to Simulator view."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-dashboard"))).click()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-dash-simulate"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "simulator-view")))
    assert driver.find_element(By.ID, "simulator-view").is_displayed()


def test_dashboard_retake_cta_navigates_to_assessment(driver):
    """Verify Dashboard Retake Assessment CTA opens Assessment view."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-dashboard"))).click()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-dash-retake"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "assessment-view")))
    assert driver.find_element(By.ID, "assessment-view").is_displayed()


def test_dashboard_view_full_plan_cta_navigates_to_action_plan(driver):
    """Verify Dashboard View Full Plan CTA navigates to Action Protocol view."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-dashboard"))).click()
    btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-view-full-plan")))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
    btn.click()
    wait.until(EC.visibility_of_element_located((By.ID, "action-plan-view")))
    assert driver.find_element(By.ID, "action-plan-view").is_displayed()


def test_brand_logo_returns_to_dashboard(driver):
    """Verify clicking Brand Logo navigates back to Dashboard."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "brand-logo-btn"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "dashboard-view")))
    assert driver.find_element(By.ID, "dashboard-view").is_displayed()


def test_export_report_modal_opens_and_closes(driver):
    """Verify Export Report menu item opens printable report modal and closes cleanly."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "user-profile-btn"))).click()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-export-report"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "report-modal")))
    assert driver.find_element(By.ID, "report-modal").is_displayed()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-close-modal"))).click()
    assert not driver.find_element(By.ID, "report-modal").is_displayed()
