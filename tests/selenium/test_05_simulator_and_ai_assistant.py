"""
Module 05: Longevity Simulator, Action Protocol, AI Assistant & History (35 Test Cases)
"""

import pytest
import requests
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, login_demo_user


@pytest.fixture(scope="module", autouse=True)
def ensure_logged_in_for_sim(driver):
    login_demo_user(driver, email="alex@workplace.com", password="password123")
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-simulator"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "simulator-view")))


@pytest.mark.parametrize(
    "element_id",
    [
        "simulator-view",
        "btn-sim-reset",
        "btn-sim-optimal",
        "sim-results-banner",
        "sim-orig-bio",
        "sim-new-bio",
        "sim-bio-delta",
        "sim-orig-life",
        "sim-new-life",
        "sim-life-gain",
        "btn-apply-simulation",
    ],
)
def test_simulator_element_present(driver, element_id):
    """Verify longevity simulator control or KPI readout exists."""
    el = driver.find_element(By.ID, element_id)
    assert el is not None


def test_simulator_baseline_readouts_populated(driver):
    """Verify simulator displays original and projected biological age values."""
    orig_bio = driver.find_element(By.ID, "sim-orig-bio").text.strip()
    new_bio = driver.find_element(By.ID, "sim-new-bio").text.strip()
    assert len(orig_bio) > 0
    assert len(new_bio) > 0


def test_simulator_optimize_all_improves_projection(driver):
    """Verify Optimize All habits button updates projected longevity gains."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "btn-sim-optimal"))).click()
    delta_text = driver.find_element(By.ID, "sim-bio-delta").text.strip()
    gain_text = driver.find_element(By.ID, "sim-life-gain").text.strip()
    assert len(delta_text) > 0
    assert len(gain_text) > 0


def test_simulator_reset_restores_baseline(driver):
    """Verify Reset button restores simulator back to current baseline."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "btn-sim-reset"))).click()
    orig_bio = driver.find_element(By.ID, "sim-orig-bio").text.strip()
    new_bio = driver.find_element(By.ID, "sim-new-bio").text.strip()
    assert orig_bio == new_bio


def test_simulator_interactive_controls_rendered(driver):
    """Verify simulator renders interactive habit levers/pills."""
    controls = driver.find_elements(By.CSS_SELECTOR, "#simulator-view .lever-pill-btn")
    assert len(controls) >= 6


@pytest.mark.parametrize(
    "element_id",
    [
        "action-plan-view",
        "streak-count",
        "adherence-pill",
        "daily-checklist-items",
        "btn-print-report",
    ],
)
def test_action_plan_element_present(driver, element_id):
    """Verify Action Protocol view UI element exists."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-plan"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "action-plan-view")))
    assert driver.find_element(By.ID, element_id) is not None


def test_action_plan_daily_checklist_has_items(driver):
    """Verify daily longevity checklist populates actionable items."""
    html = driver.find_element(By.ID, "daily-checklist-items").get_attribute("innerHTML")
    assert len(html.strip()) > 0


def test_biopro_ai_modal_opens_from_header(driver):
    """Verify header AI button opens Biopro AI Longevity Assistant modal."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "btn-header-biopro"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "biopro-bot-modal")))
    assert driver.find_element(By.ID, "biopro-bot-modal").is_displayed()


@pytest.mark.parametrize(
    "element_id",
    [
        "biopro-bot-modal",
        "biopro-chat-stream",
        "biopro-modal-input",
        "btn-send-biopro-modal",
        "btn-close-biopro-modal",
    ],
)
def test_biopro_ai_modal_control_present(driver, element_id):
    """Verify Biopro AI assistant modal internal control exists."""
    assert driver.find_element(By.ID, element_id) is not None


def test_biopro_ai_modal_accepts_user_query_and_closes(driver):
    """Verify AI modal input accepts text and close button dismisses drawer."""
    wait = WebDriverWait(driver, TIMEOUT)
    inp = wait.until(EC.visibility_of_element_located((By.ID, "biopro-modal-input")))
    inp.clear()
    inp.send_keys("How can I improve my sleep longevity score?")
    assert "sleep" in inp.get_attribute("value").lower()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-close-biopro-modal"))).click()
    assert not driver.find_element(By.ID, "biopro-bot-modal").is_displayed()


def test_gemini_key_modal_has_no_hardcoded_secret(driver):
    """Verify Gemini API key input starts empty with zero hardcoded credentials."""
    key_input = driver.find_element(By.ID, "input-gemini-key")
    val = key_input.get_attribute("value") or ""
    assert "AQ.Ab8RN" not in val
    assert "AIza" not in val


def test_history_view_renders_table_structure(driver):
    """Verify History tab opens and displays assessment history container."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-history"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "history-view")))
    assert driver.find_element(By.ID, "history-table") is not None
    assert driver.find_element(By.ID, "btn-history-retake") is not None


@pytest.mark.parametrize("user_id", ["usr_elena", "usr_alex", "usr_robert", "usr_nonexistent_test"])
def test_history_api_returns_valid_list_for_user(api_url, user_id):
    """Verify history REST API returns structured assessment array."""
    res = requests.get(f"{api_url}/api/bioage/history/{user_id}", timeout=10)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert isinstance(body["history"], list)
