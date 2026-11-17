"""Selenium tests for Login/Logout session flows and Profile / IoC Registration workflows."""

from __future__ import annotations

import uuid

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC

pytestmark = [pytest.mark.selenium]


def _clear_and_type(element, value: str) -> None:
    element.click()
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.BACKSPACE)
    element.send_keys(value)


def _assert_session_ended_and_sign_back_in(driver, wait) -> None:
    heading = wait.until(
        EC.visibility_of_element_located((By.XPATH, "//h2[normalize-space()='Session Ended']"))
    )
    assert heading.is_displayed()
    assert "cleanly logged out" in driver.find_element(By.TAG_NAME, "body").text

    sign_in_btn = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(normalize-space(), 'Sign Back In')]")
        )
    )
    sign_in_btn.click()

    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Welcome back,"))
    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(), 'System Online')]")
        )
    )


@pytest.mark.smoke
def test_logout_and_login_via_sidebar(driver, wait):
    """Verify analyst logout via sidebar button and login/re-entry into console."""
    logout_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//aside//button[@title='Logout']"))
    )
    logout_btn.click()
    _assert_session_ended_and_sign_back_in(driver, wait)


def test_logout_and_login_via_user_menu_dropdown(driver, wait):
    """Verify logout via top-right user profile dropdown and subsequent sign-in."""
    avatar_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[@aria-label='User menu']"))
    )
    avatar_btn.click()

    dropdown_logout = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//header//button[contains(normalize-space(), 'Logout')]")
        )
    )
    dropdown_logout.click()
    _assert_session_ended_and_sign_back_in(driver, wait)


def test_logout_and_login_via_settings_page(driver, wait, navigate_to):
    """Verify logout via Settings page 'Logout Session' button and re-login."""
    navigate_to("Settings", "Settings & System Status")

    logout_btn = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(normalize-space(), 'Logout Session')]")
        )
    )
    logout_btn.click()
    _assert_session_ended_and_sign_back_in(driver, wait)


def test_analyst_profile_registration_and_persistence(driver, wait, navigate_to, app_url):
    """
    Verify Analyst Profile registration/update on Settings page persists to backend DB
    and updates the Dashboard greeting. Restores original analyst profile afterward.
    """
    navigate_to("Settings", "Settings & System Status")

    full_name_input = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//label[normalize-space()='Full Name']/following-sibling::input")
        )
    )
    email_input = driver.find_element(
        By.XPATH, "//label[normalize-space()='Email']/following-sibling::input"
    )
    role_input = driver.find_element(
        By.XPATH, "//label[normalize-space()='Role']/following-sibling::input"
    )
    org_input = driver.find_element(
        By.XPATH, "//label[normalize-space()='Organization']/following-sibling::input"
    )

    original = {
        "full_name": full_name_input.get_attribute("value") or "Security Analyst",
        "email": email_input.get_attribute("value") or "analyst@phishguard.local",
        "role": role_input.get_attribute("value") or "Lead SOC Analyst",
        "organization": org_input.get_attribute("value") or "PhishGuard Security Operations",
    }

    try:
        _clear_and_type(full_name_input, "QA Automation Analyst")
        _clear_and_type(email_input, "qa.analyst@phishguard.local")
        _clear_and_type(role_input, "Senior DevSecOps Engineer")
        _clear_and_type(org_input, "PhishGuard CI Lab")

        save_btn = driver.find_element(
            By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Save Profile')]"
        )
        save_btn.click()

        wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[contains(normalize-space(), 'Profile updated successfully')]")
            )
        )

        # Reload browser to confirm database persistence
        driver.get(app_url)
        wait.until(
            EC.text_to_be_present_in_element((By.TAG_NAME, "h1"), "Welcome back, QA Automation Analyst!")
        )
    finally:
        # Restore original analyst profile cleanly
        navigate_to("Settings", "Settings & System Status")
        fn = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//label[normalize-space()='Full Name']/following-sibling::input")
            )
        )
        _clear_and_type(fn, original["full_name"])
        _clear_and_type(
            driver.find_element(By.XPATH, "//label[normalize-space()='Email']/following-sibling::input"),
            original["email"],
        )
        _clear_and_type(
            driver.find_element(By.XPATH, "//label[normalize-space()='Role']/following-sibling::input"),
            original["role"],
        )
        _clear_and_type(
            driver.find_element(
                By.XPATH, "//label[normalize-space()='Organization']/following-sibling::input"
            ),
            original["organization"],
        )
        driver.find_element(
            By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Save Profile')]"
        ).click()
        wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[contains(normalize-space(), 'Profile updated successfully')]")
            )
        )


def test_threat_indicator_registration_workflow(driver, wait, navigate_to):
    """Verify registering a new Threat Indicator (IoC) in the Threat Intelligence DB."""
    navigate_to("Threat Intelligence", "Threat Intelligence")

    add_ioc_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(normalize-space(), 'Add IoC')]"))
    )
    add_ioc_btn.click()

    unique_domain = f"selenium-ci-{uuid.uuid4().hex[:8]}.example.com"
    val_input = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[placeholder="Indicator value"]'))
    )
    val_input.send_keys(unique_domain)

    save_btn = driver.find_element(
        By.XPATH, "//button[@type='submit' and contains(normalize-space(), 'Save IoC')]"
    )
    save_btn.click()

    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, f"//*[contains(normalize-space(), '{unique_domain}')]")
        )
    )
    assert "saved to Threat Intelligence DB" in driver.find_element(By.TAG_NAME, "body").text
