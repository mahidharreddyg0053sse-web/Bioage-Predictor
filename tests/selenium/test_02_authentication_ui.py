"""
Module 02: Authentication UI, Tabs, OTP Panels & Validation (44 Test Cases)
"""

import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, login_demo_user, logout_user


@pytest.fixture(scope="module", autouse=True)
def reset_to_auth(driver):
    logout_user(driver)


@pytest.mark.parametrize(
    "element_id",
    [
        "tab-login",
        "tab-register",
        "login-form",
        "login-email",
        "login-password",
        "login-remember",
        "forgot-password-link",
        "btn-submit-login",
        "register-form",
        "reg-name",
        "reg-email",
        "reg-birthdate",
        "reg-gender",
        "reg-password",
        "reg-confirm-password",
        "btn-submit-register",
    ],
)
def test_auth_form_control_exists(driver, element_id):
    """Verify authentication form control is rendered in DOM."""
    el = driver.find_element(By.ID, element_id)
    assert el is not None


@pytest.mark.parametrize("box_num", [1, 2, 3, 4, 5, 6])
def test_register_otp_digit_box_exists(driver, box_num):
    """Verify registration 6-digit OTP box exists with maxlength=1."""
    box = driver.find_element(By.ID, f"reg-otp-{box_num}")
    assert box.get_attribute("maxlength") == "1"


@pytest.mark.parametrize("box_num", [1, 2, 3, 4, 5, 6])
def test_inline_forgot_password_otp_box_exists(driver, box_num):
    """Verify inline forgot-password 6-digit OTP box exists with maxlength=1."""
    box = driver.find_element(By.ID, f"inline-otp-{box_num}")
    assert box.get_attribute("maxlength") == "1"


def test_switch_to_register_tab_displays_register_form(driver):
    """Verify clicking Create Account tab reveals registration form."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "tab-register"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "register-form")))
    assert driver.find_element(By.ID, "register-form").is_displayed()
    assert not driver.find_element(By.ID, "login-form").is_displayed()


def test_switch_back_to_login_tab_displays_login_form(driver):
    """Verify clicking Sign In tab restores login form."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "tab-login"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "login-form")))
    assert driver.find_element(By.ID, "login-form").is_displayed()


def test_open_and_close_inline_forgot_password_panel(driver):
    """Verify Forgot Password link opens inline recovery panel and Cancel closes it."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "forgot-password-link"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "forgot-password-panel")))
    assert driver.find_element(By.ID, "inline-fp-email-input").is_displayed()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-cancel-fp"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "login-form")))
    assert driver.find_element(By.ID, "login-form").is_displayed()


def test_login_password_visibility_toggle(driver):
    """Verify eye button toggles login password input between password and text."""
    wait = WebDriverWait(driver, TIMEOUT)
    pwd = driver.find_element(By.ID, "login-password")
    toggle = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, ".btn-toggle-pass[data-target='login-password']"))
    )
    assert pwd.get_attribute("type") == "password"
    toggle.click()
    assert pwd.get_attribute("type") == "text"
    toggle.click()
    assert pwd.get_attribute("type") == "password"


def test_remember_session_checkbox_toggle(driver):
    """Verify Remember My Session checkbox can be toggled cleanly."""
    cb = driver.find_element(By.ID, "login-remember")
    initial = cb.is_selected()
    driver.execute_script("arguments[0].click();", cb)
    assert cb.is_selected() != initial
    driver.execute_script("arguments[0].click();", cb)
    assert cb.is_selected() == initial


@pytest.mark.parametrize(
    "email,password",
    [
        ("nonexistent1@example.com", "wrongpass123"),
        ("nonexistent2@bioage.io", "invalid999"),
        ("alex@workplace.com", "wrongpassword"),
        ("elena@longevity.bio", "incorrect123"),
        ("robert@financecorp.com", "badpass000"),
        ("test.invalid@domain.org", "123456"),
    ],
)
def test_invalid_login_shows_error_message(driver, email, password):
    """Verify invalid credentials trigger visible login error banner."""
    wait = WebDriverWait(driver, TIMEOUT)
    email_input = wait.until(EC.visibility_of_element_located((By.ID, "login-email")))
    pass_input = wait.until(EC.visibility_of_element_located((By.ID, "login-password")))
    time.sleep(0.2)
    driver.execute_script("arguments[0].removeAttribute('readonly');", email_input)
    driver.execute_script("arguments[0].removeAttribute('readonly');", pass_input)

    email_input.click()
    email_input.clear()
    email_input.send_keys(email)
    pass_input.click()
    pass_input.clear()
    pass_input.send_keys(password)

    driver.execute_script("const e = document.getElementById('login-error'); if (e) { e.style.display = 'none'; e.textContent = ''; }")
    driver.find_element(By.ID, "btn-submit-login").click()
    err = wait.until(EC.visibility_of_element_located((By.ID, "login-error")))
    assert len(err.text.strip()) > 0


def test_register_password_mismatch_blocked(driver):
    """Verify registration rejects mismatched password and confirm password."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "tab-register"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "register-form")))

    for fid in ["reg-name", "reg-email", "reg-password", "reg-confirm-password"]:
        el = driver.find_element(By.ID, fid)
        driver.execute_script("arguments[0].removeAttribute('readonly');", el)
        el.clear()

    driver.find_element(By.ID, "reg-name").send_keys("Mismatch User")
    driver.find_element(By.ID, "reg-email").send_keys("mismatch_test@example.com")
    driver.find_element(By.ID, "reg-password").send_keys("Password123!")
    driver.find_element(By.ID, "reg-confirm-password").send_keys("Different456!")
    driver.find_element(By.ID, "btn-submit-register").click()

    err = wait.until(EC.visibility_of_element_located((By.ID, "register-error")))
    assert len(err.text.strip()) > 0
    wait.until(EC.element_to_be_clickable((By.ID, "tab-login"))).click()


@pytest.mark.parametrize(
    "email,password,expected_first",
    [
        ("alex@workplace.com", "password123", "Alex"),
        ("elena@longevity.bio", "ElenaNewPassword2026!", "Dr."),
        ("robert@financecorp.com", "password123", "Robert"),
    ],
)
def test_demo_account_login_and_session_render(driver, email, password, expected_first):
    """Verify demo user can sign in and authenticated header displays their name."""
    login_demo_user(driver, email=email, password=password)
    disp = driver.find_element(By.ID, "user-display-name").text.strip()
    assert expected_first.lower() in disp.lower()
    logout_user(driver)


def test_login_persists_demo_user_alex_for_suite(driver):
    """Sign in as Alex Mercer and verify dashboard view becomes visible."""
    login_demo_user(driver, email="alex@workplace.com", password="password123")
    assert driver.find_element(By.ID, "dashboard-view").is_displayed()
