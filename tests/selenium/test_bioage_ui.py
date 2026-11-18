"""
BioAge Pro — Headless Chrome Selenium Functional UI Tests
"""

import os
import time
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

APP_URL = os.environ.get("APP_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
TIMEOUT = int(os.environ.get("SELENIUM_TIMEOUT", "20"))


@pytest.fixture(scope="module")
def driver():
    options = Options()
    if os.environ.get("SELENIUM_HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,900")
    browser = webdriver.Chrome(options=options)
    browser.implicitly_wait(5)
    yield browser
    browser.quit()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when == "call" and rep.failed:
        browser = item.funcargs.get("driver")
        if browser:
            os.makedirs("screenshots", exist_ok=True)
            browser.save_screenshot(f"screenshots/{item.name}.png")


def test_app_loads_and_renders_brand(driver):
    driver.get(APP_URL)
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.presence_of_element_located((By.ID, "login-form")))
    assert "BioAge Pro" in driver.title


def test_auth_tab_switching(driver):
    driver.get(APP_URL)
    wait = WebDriverWait(driver, TIMEOUT)

    reg_tab = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".auth-tab[data-tab='register']")))
    reg_tab.click()
    wait.until(EC.visibility_of_element_located((By.ID, "register-form")))
    assert driver.find_element(By.ID, "register-form").is_displayed()

    login_tab = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".auth-tab[data-tab='login']")))
    login_tab.click()
    wait.until(EC.visibility_of_element_located((By.ID, "login-form")))
    assert driver.find_element(By.ID, "login-form").is_displayed()


def test_demo_user_login_and_dashboard_navigation(driver):
    driver.get(APP_URL)
    wait = WebDriverWait(driver, TIMEOUT)

    email_input = wait.until(EC.visibility_of_element_located((By.ID, "login-email")))
    pass_input = wait.until(EC.visibility_of_element_located((By.ID, "login-password")))

    # Wait past the initial 600ms autofill-purge timer in app.js
    time.sleep(0.8)

    driver.execute_script("arguments[0].removeAttribute('readonly');", email_input)
    driver.execute_script("arguments[0].removeAttribute('readonly');", pass_input)

    email_input.click()
    email_input.clear()
    email_input.send_keys("alex@workplace.com")
    pass_input.click()
    pass_input.clear()
    pass_input.send_keys("password123")

    submit_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-submit-login")))
    submit_btn.click()

    # Wait for dashboard / authenticated header to reflect logged-in user
    wait.until(
        lambda d: d.find_element(By.ID, "user-display-name").text.strip().lower() not in ("", "guest")
    )

    # Verify navigation across core app views
    for nav_id in ["nav-assessment", "nav-simulator", "nav-plan", "nav-history", "nav-dashboard"]:
        btn = wait.until(EC.element_to_be_clickable((By.ID, nav_id)))
        btn.click()
        assert "active" in btn.get_attribute("class")


def test_profile_modal_and_otp_boxes_present(driver):
    wait = WebDriverWait(driver, TIMEOUT)

    # Open user menu and profile modal
    profile_menu_btn = wait.until(EC.element_to_be_clickable((By.ID, "user-profile-btn")))
    profile_menu_btn.click()

    open_profile_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-open-profile")))
    open_profile_btn.click()

    wait.until(EC.visibility_of_element_located((By.ID, "user-profile-modal")))

    # Verify all 6 dedicated OTP digit boxes exist in DOM
    otp_boxes = driver.find_elements(By.CSS_SELECTOR, ".profile-otp-digit")
    assert len(otp_boxes) == 6
