"""
Module 06: Account Profile Modal, Password Security & 6-Digit OTP Box Grid (40 Test Cases)
"""

import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, login_demo_user


@pytest.fixture(scope="module", autouse=True)
def open_profile_modal(driver):
    login_demo_user(driver, email="alex@workplace.com", password="password123")
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-dashboard"))).click()
    wait.until(EC.element_to_be_clickable((By.ID, "user-profile-btn"))).click()
    wait.until(EC.element_to_be_clickable((By.ID, "btn-open-profile"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "user-profile-modal")))
    time.sleep(0.7)


@pytest.mark.parametrize(
    "field_id",
    [
        "profile-avatar-letters",
        "profile-card-name",
        "profile-card-email",
        "profile-name",
        "profile-email",
        "profile-birthdate",
    ],
)
def test_profile_identity_field_populated(driver, field_id):
    """Verify Account Profile modal populates user identity field."""
    el = driver.find_element(By.ID, field_id)
    val = (el.get_attribute("value") or el.text or "").strip()
    assert len(val) > 0


def test_profile_current_password_starts_empty_no_autofill(driver):
    """Verify Current Password input starts blank (autofill leak fixed)."""
    old_pwd = driver.find_element(By.ID, "profile-old-password")
    assert (old_pwd.get_attribute("value") or "") == ""


def test_profile_new_and_confirm_passwords_start_empty(driver):
    """Verify New Password and Confirm Password inputs start blank."""
    new_pwd = driver.find_element(By.ID, "profile-new-password")
    conf_pwd = driver.find_element(By.ID, "profile-confirm-password")
    assert (new_pwd.get_attribute("value") or "") == ""
    assert (conf_pwd.get_attribute("value") or "") == ""


@pytest.mark.parametrize(
    "target_id",
    ["profile-old-password", "profile-new-password", "profile-confirm-password"],
)
def test_profile_password_visibility_toggle(driver, target_id):
    """Verify password visibility eye toggle switches input type cleanly."""
    inp = driver.find_element(By.ID, target_id)
    toggle = driver.find_element(
        By.CSS_SELECTOR, f"#user-profile-modal .btn-toggle-pass[data-target='{target_id}']"
    )
    assert inp.get_attribute("type") == "password"
    driver.execute_script("arguments[0].click();", toggle)
    assert inp.get_attribute("type") == "text"
    driver.execute_script("arguments[0].click();", toggle)
    assert inp.get_attribute("type") == "password"


def test_open_profile_otp_recovery_panel(driver):
    """Verify clicking 'Forgot your current password?' switches to OTP recovery panel."""
    wait = WebDriverWait(driver, TIMEOUT)
    btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-profile-forgot-pwd")))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
    btn.click()
    wait.until(EC.visibility_of_element_located((By.ID, "profile-otp-panel")))
    assert driver.find_element(By.ID, "profile-otp-panel").is_displayed()


def test_profile_otp_target_email_matches_active_user(driver):
    """Verify OTP recovery banner displays active user's email address."""
    email = driver.find_element(By.ID, "profile-otp-target-email").text.strip().lower()
    assert email == "alex@workplace.com"


@pytest.mark.parametrize("box_idx", [1, 2, 3, 4, 5, 6])
def test_profile_otp_digit_box_attributes_and_alignment(driver, box_idx):
    """Verify each of the 6 profile OTP boxes has numeric single-digit alignment styling."""
    box = driver.find_element(By.ID, f"profile-otp-{box_idx}")
    assert box.is_displayed()
    assert box.get_attribute("maxlength") == "1"
    assert box.get_attribute("inputmode") == "numeric"
    assert "otp-digit-input" in box.get_attribute("class")
    text_align = driver.execute_script("return getComputedStyle(arguments[0]).textAlign;", box)
    assert text_align == "center"


@pytest.mark.parametrize(
    "otp_code",
    [
        "123456",
        "654321",
        "000000",
        "987654",
        "482910",
        "112233",
        "909090",
        "555555",
        "314159",
        "271828",
    ],
)
def test_profile_otp_6box_typing_auto_advances_and_syncs_hidden_input(driver, otp_code):
    """Verify typing 6 digits auto-advances across boxes 1..6 and syncs #profile-otp-code."""
    # Reset boxes first
    for i in range(1, 7):
        b = driver.find_element(By.ID, f"profile-otp-{i}")
        driver.execute_script("arguments[0].value = ''; arguments[0].classList.remove('has-value');", b)

    first_box = driver.find_element(By.ID, "profile-otp-1")
    first_box.click()
    for idx, digit in enumerate(otp_code, start=1):
        box = driver.find_element(By.ID, f"profile-otp-{idx}")
        box.send_keys(digit)
        assert box.get_attribute("value") == digit
        assert "has-value" in box.get_attribute("class")

    hidden_val = driver.find_element(By.ID, "profile-otp-code").get_attribute("value")
    assert hidden_val == otp_code


@pytest.mark.parametrize("bad_char", ["a", "Z", "!", "@", "#"])
def test_profile_otp_box_rejects_non_numeric_input(driver, bad_char):
    """Verify non-numeric characters are stripped and rejected in profile OTP boxes."""
    box = driver.find_element(By.ID, "profile-otp-1")
    driver.execute_script("arguments[0].value = '';", box)
    box.click()
    box.send_keys(bad_char)
    assert box.get_attribute("value") == ""


def test_profile_otp_backspace_moves_focus_backward(driver):
    """Verify Backspace on an empty box clears and moves focus to preceding OTP box."""
    for idx, d in enumerate("123456", start=1):
        b = driver.find_element(By.ID, f"profile-otp-{idx}")
        driver.execute_script("arguments[0].value = '';", b)
        b.send_keys(d)

    box6 = driver.find_element(By.ID, "profile-otp-6")
    box6.click()
    box6.send_keys(Keys.BACKSPACE)
    box6.send_keys(Keys.BACKSPACE)
    assert driver.find_element(By.ID, "profile-otp-5").get_attribute("value") == ""


def test_profile_otp_arrow_keys_navigate_between_boxes(driver):
    """Verify ArrowLeft and ArrowRight keys move cursor focus across OTP boxes."""
    box3 = driver.find_element(By.ID, "profile-otp-3")
    box3.click()
    box3.send_keys(Keys.ARROW_RIGHT)
    active_right = driver.execute_script("return document.activeElement.id;")
    assert active_right == "profile-otp-4"
    driver.find_element(By.ID, "profile-otp-4").send_keys(Keys.ARROW_LEFT)
    active_left = driver.execute_script("return document.activeElement.id;")
    assert active_left == "profile-otp-3"


def test_profile_otp_back_button_returns_to_main_profile(driver):
    """Verify Back button returns from OTP recovery panel to main profile view."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "btn-profile-otp-back"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "profile-main-panel")))
    assert driver.find_element(By.ID, "profile-main-panel").is_displayed()


def test_closing_profile_modal_resets_all_6_otp_boxes(driver):
    """Verify closing Account Profile modal wipes all 6 OTP boxes and hidden value."""
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "btn-close-profile-modal"))).click()
    assert not driver.find_element(By.ID, "user-profile-modal").is_displayed()
    for i in range(1, 7):
        assert (driver.find_element(By.ID, f"profile-otp-{i}").get_attribute("value") or "") == ""
    assert (driver.find_element(By.ID, "profile-otp-code").get_attribute("value") or "") == ""
