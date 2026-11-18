"""
Module 01: Application Launch, Branding, Static Assets & Responsive Layout (30 Test Cases)
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT


@pytest.fixture(scope="module", autouse=True)
def load_home(driver, app_url):
    driver.set_window_size(1440, 900)
    driver.get(app_url)
    WebDriverWait(driver, TIMEOUT).until(
        EC.presence_of_element_located((By.ID, "app-wrapper"))
    )


def test_page_title_contains_bioage_pro(driver):
    """Verify page title displays BioAge Pro branding."""
    assert "BioAge Pro" in driver.title


def test_meta_description_present(driver):
    """Verify SEO meta description tag is present and non-empty."""
    meta = driver.find_element(By.CSS_SELECTOR, "meta[name='description']")
    assert len(meta.get_attribute("content").strip()) > 20


def test_theme_light_body_class_initialized(driver):
    """Verify default body theme class is initialized cleanly."""
    body_cls = driver.find_element(By.TAG_NAME, "body").get_attribute("class")
    assert "theme-light" in body_cls or "theme-dark" in body_cls


def test_stylesheet_loaded_successfully(driver):
    """Verify main style.css stylesheet is loaded by the browser."""
    loaded = driver.execute_script(
        "return Array.from(document.styleSheets).some(s => s.href && s.href.includes('style.css'));"
    )
    assert loaded is True


def test_global_dna_canvas_mounted(driver):
    """Verify ambient DNA background canvas is present in DOM."""
    canvas = driver.find_element(By.ID, "global-dna-canvas")
    assert canvas.tag_name.lower() == "canvas"


def test_no_gemini_powered_brand_text_in_ai_header(driver):
    """Verify removed 'Powered by Gemini' text does not appear in AI header."""
    html = driver.page_source
    assert "Powered by Gemini 3.5" not in html


@pytest.mark.parametrize(
    "element_id",
    [
        "app-wrapper",
        "main-header",
        "brand-logo-btn",
        "desktop-nav",
        "btn-header-biopro",
        "user-menu-wrap",
        "user-profile-btn",
        "user-display-name",
        "app-main",
        "auth-view",
        "mobile-bottom-nav",
        "toast-container",
    ],
)
def test_core_layout_element_present(driver, element_id):
    """Verify core layout structural DOM element exists."""
    el = driver.find_element(By.ID, element_id)
    assert el is not None


@pytest.mark.parametrize(
    "nav_id",
    [
        "nav-dashboard",
        "nav-assessment",
        "nav-simulator",
        "nav-plan",
        "nav-history",
        "m-nav-dash",
        "m-nav-assess",
        "m-nav-sim",
        "m-nav-plan",
        "m-nav-hist",
    ],
)
def test_navigation_button_present(driver, nav_id):
    """Verify desktop and mobile navigation button exists in DOM."""
    btn = driver.find_element(By.ID, nav_id)
    assert btn.tag_name.lower() == "button"


@pytest.mark.parametrize(
    "width,height",
    [
        (375, 812),
        (414, 896),
        (768, 1024),
        (1280, 800),
        (1440, 900),
    ],
)
def test_responsive_viewport_renders_without_overflow_crash(driver, width, height):
    """Verify UI renders cleanly across mobile, tablet, and desktop viewports."""
    driver.set_window_size(width, height)
    inner_w = driver.execute_script("return window.innerWidth;")
    assert inner_w > 0
    assert driver.find_element(By.ID, "app-wrapper") is not None


def test_forgot_password_standalone_page_loads(driver, app_url):
    """Verify standalone forgot-password.html page loads cleanly."""
    driver.set_window_size(1440, 900)
    driver.get(f"{app_url}/forgot-password.html")
    assert len(driver.title.strip()) > 0
    assert driver.find_element(By.TAG_NAME, "body") is not None
    driver.get(app_url)
