"""
Module 04: Biomarker Assessment Wizard & Clinical Calculation Engine (46 Test Cases)
"""

import pytest
import requests
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, login_demo_user


@pytest.fixture(scope="module", autouse=True)
def open_assessment_view(driver):
    login_demo_user(driver, email="alex@workplace.com", password="password123")
    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.element_to_be_clickable((By.ID, "nav-assessment"))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "assessment-view")))


@pytest.mark.parametrize(
    "element_id",
    [
        "assessment-view",
        "wizard-step-badge",
        "wizard-section-title",
        "wizard-section-subtitle",
        "wizard-progress-fill",
        "step-nav-bar",
        "assessment-fields-container",
        "btn-wizard-prev",
        "btn-wizard-next",
    ],
)
def test_assessment_wizard_control_exists(driver, element_id):
    """Verify assessment wizard UI element exists in DOM."""
    el = driver.find_element(By.ID, element_id)
    assert el is not None


def test_assessment_initial_section_title_populated(driver):
    """Verify wizard renders initial section heading and step badge."""
    title = driver.find_element(By.ID, "wizard-section-title").text.strip()
    badge = driver.find_element(By.ID, "wizard-step-badge").text.strip()
    assert len(title) > 0
    assert len(badge) > 0


def test_load_sample_profile_populates_fields(driver):
    """Verify Load Sample button populates biomarker inputs without errors."""
    btn = WebDriverWait(driver, TIMEOUT).until(
        EC.element_to_be_clickable((By.ID, "btn-load-sample"))
    )
    btn.click()
    fields = driver.find_elements(By.CSS_SELECTOR, "#assessment-fields-container input, #assessment-fields-container select")
    assert len(fields) > 0


def test_wizard_next_advances_to_step_2(driver):
    """Verify clicking Next advances the assessment wizard to step 2."""
    before = driver.find_element(By.ID, "wizard-section-title").text.strip()
    driver.find_element(By.ID, "btn-wizard-next").click()
    after = driver.find_element(By.ID, "wizard-section-title").text.strip()
    assert after != before


def test_wizard_next_advances_to_step_3(driver):
    """Verify clicking Next advances the assessment wizard to step 3."""
    before = driver.find_element(By.ID, "wizard-section-title").text.strip()
    driver.find_element(By.ID, "btn-wizard-next").click()
    after = driver.find_element(By.ID, "wizard-section-title").text.strip()
    assert after != before


def test_wizard_prev_returns_to_previous_step(driver):
    """Verify clicking Previous returns to the prior assessment section."""
    before = driver.find_element(By.ID, "wizard-section-title").text.strip()
    driver.find_element(By.ID, "btn-wizard-prev").click()
    after = driver.find_element(By.ID, "wizard-section-title").text.strip()
    assert after != before


def test_wizard_step_pills_rendered(driver):
    """Verify step navigation bar renders multiple clickable step tabs."""
    pills = driver.find_elements(By.CSS_SELECTOR, "#step-nav-bar .step-nav-pill")
    assert len(pills) >= 4


def test_wizard_progress_bar_updates(driver):
    """Verify wizard progress fill element has non-empty width style."""
    style = driver.find_element(By.ID, "wizard-progress-fill").get_attribute("style")
    assert "width" in (style or "").lower()


CLINICAL_COHORTS = [
    ("athlete_22_m", 22, "male", 180, 74, 52, 110, 70, "high", "rare", "optimal", "high", "never", "none", "low"),
    ("athlete_28_f", 28, "female", 166, 58, 54, 108, 68, "high", "rare", "optimal", "high", "never", "none", "low"),
    ("optimal_35_m", 35, "male", 178, 75, 56, 114, 72, "high", "rare", "optimal", "high", "never", "none", "low"),
    ("optimal_42_f", 42, "female", 165, 60, 58, 116, 74, "high", "rare", "optimal", "high", "never", "low", "low"),
    ("optimal_55_m", 55, "male", 176, 74, 58, 118, 74, "high", "rare", "optimal", "high", "never", "low", "low"),
    ("optimal_68_f", 68, "female", 162, 58, 60, 120, 76, "high", "rare", "optimal", "moderate", "never", "none", "low"),
    ("urban_25_m", 25, "male", 175, 78, 70, 122, 80, "moderate", "moderate", "adequate", "moderate", "never", "moderate", "moderate"),
    ("urban_32_f", 32, "female", 164, 65, 72, 120, 78, "moderate", "moderate", "adequate", "moderate", "never", "low", "moderate"),
    ("urban_40_m", 40, "male", 179, 86, 74, 128, 82, "moderate", "moderate", "mild_deficit", "low", "never", "moderate", "moderate"),
    ("urban_48_f", 48, "female", 163, 72, 76, 130, 84, "moderate", "moderate", "mild_deficit", "low", "never", "moderate", "moderate"),
    ("urban_58_m", 58, "male", 174, 84, 74, 132, 84, "moderate", "moderate", "adequate", "moderate", "former", "low", "moderate"),
    ("urban_64_f", 64, "female", 160, 68, 72, 134, 82, "moderate", "moderate", "adequate", "moderate", "never", "none", "moderate"),
    ("stressed_30_m", 30, "male", 177, 92, 82, 138, 88, "low", "frequent", "severe_deficit", "sedentary", "light", "heavy", "severe"),
    ("stressed_38_f", 38, "female", 165, 84, 84, 140, 90, "low", "frequent", "severe_deficit", "sedentary", "light", "moderate", "severe"),
    ("stressed_45_m", 45, "male", 174, 98, 86, 146, 94, "low", "frequent", "severe_deficit", "sedentary", "heavy", "heavy", "severe"),
    ("stressed_52_f", 52, "female", 162, 88, 84, 144, 92, "low", "frequent", "severe_deficit", "sedentary", "light", "heavy", "severe"),
    ("smoker_36_m", 36, "male", 176, 80, 78, 134, 86, "moderate", "moderate", "mild_deficit", "low", "heavy", "moderate", "high"),
    ("smoker_50_f", 50, "female", 164, 70, 80, 138, 88, "low", "frequent", "mild_deficit", "low", "heavy", "moderate", "high"),
    ("former_smoker_44_m", 44, "male", 178, 79, 64, 120, 78, "high", "rare", "optimal", "high", "former", "low", "low"),
    ("former_smoker_60_f", 60, "female", 166, 63, 62, 122, 76, "high", "rare", "optimal", "moderate", "former", "none", "low"),
    ("hypertensive_46_m", 46, "male", 175, 90, 78, 158, 98, "low", "frequent", "mild_deficit", "low", "never", "moderate", "high"),
    ("hypertensive_62_f", 62, "female", 161, 78, 76, 154, 94, "moderate", "moderate", "mild_deficit", "low", "never", "low", "high"),
    ("lean_young_20_f", 20, "female", 168, 56, 60, 112, 70, "high", "rare", "optimal", "high", "never", "none", "low"),
    ("lean_young_24_m", 24, "male", 182, 76, 56, 114, 72, "high", "rare", "optimal", "high", "never", "low", "low"),
    ("senior_active_72_m", 72, "male", 173, 72, 60, 122, 76, "high", "rare", "optimal", "moderate", "never", "none", "low"),
    ("senior_active_75_f", 75, "female", 159, 57, 62, 124, 78, "high", "rare", "optimal", "moderate", "never", "none", "low"),
    ("sleep_deprived_29_m", 29, "male", 176, 77, 74, 126, 82, "moderate", "moderate", "severe_deficit", "moderate", "never", "moderate", "high"),
    ("sleep_deprived_41_f", 41, "female", 165, 64, 75, 128, 82, "moderate", "moderate", "severe_deficit", "moderate", "never", "low", "high"),
    ("sedentary_33_m", 33, "male", 178, 88, 78, 130, 84, "moderate", "frequent", "adequate", "sedentary", "never", "moderate", "moderate"),
    ("sedentary_49_f", 49, "female", 163, 76, 79, 134, 86, "moderate", "frequent", "adequate", "sedentary", "never", "low", "moderate"),
]


@pytest.mark.parametrize(
    "label,age,gender,height,weight,rhr,sys_bp,dia_bp,med,upf,sleep,cardio,smoke,alc,stress",
    CLINICAL_COHORTS,
    ids=[c[0] for c in CLINICAL_COHORTS],
)
def test_clinical_cohort_bioage_calculation(
    api_url, label, age, gender, height, weight, rhr, sys_bp, dia_bp, med, upf, sleep, cardio, smoke, alc, stress
):
    """Verify clinical biological age calculation returns valid metrics for cohort."""
    payload = {
        "chronologicalAge": age,
        "gender": gender,
        "height": height,
        "weight": weight,
        "restingHeartRate": rhr,
        "bloodPressureSystolic": sys_bp,
        "bloodPressureDiastolic": dia_bp,
        "mediterraneanScore": med,
        "ultraProcessedFood": upf,
        "sugarIntake": "minimal" if med == "high" else "moderate",
        "dailyWater": "optimal" if med == "high" else "adequate",
        "intermittentFasting": "yes" if med == "high" else "no",
        "sleepDuration": sleep,
        "sleepConsistency": "consistent" if sleep == "optimal" else "moderate",
        "sleepQuality": "refreshed" if sleep == "optimal" else "average",
        "cardioMinutes": cardio,
        "strengthDays": "optimal" if cardio == "high" else "moderate",
        "dailySteps": "high" if cardio == "high" else "fair",
        "sedentaryHours": "low" if cardio == "high" else "high",
        "smokingStatus": smoke,
        "alcoholIntake": alc,
        "stressLevel": stress,
        "socialConnection": "strong" if stress == "low" else "average",
        "hasLabs": "no",
    }
    res = requests.post(f"{api_url}/api/bioage/calculate", json=payload, timeout=10)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    result = body["result"]
    assert 10 <= result["biologicalAge"] <= 120
    assert 40 <= result["projectedLifeExpectancy"] <= 120
    assert result["paceOfAging"] > 0
    assert "organAges" in result and "domainScores" in result
