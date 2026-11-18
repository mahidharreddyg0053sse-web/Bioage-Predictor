"""
BioAge Pro — Locust Load & Performance Testing Suite
Profiles:
  - BioAgeNormalUser : Typical user traffic (health checks, homepage, biological age calculations, history)
  - BioAgeHeavyUser  : High-throughput stress traffic
"""

from locust import HttpUser, task, between


SAMPLE_BIOMARKER_PAYLOAD = {
    "chronologicalAge": 34,
    "gender": "male",
    "height": 178,
    "weight": 76,
    "restingHeartRate": 62,
    "bloodPressureSystolic": 118,
    "bloodPressureDiastolic": 76,
    "mediterraneanScore": "high",
    "ultraProcessedFood": "rare",
    "sugarIntake": "minimal",
    "dailyWater": "optimal",
    "intermittentFasting": "yes",
    "sleepDuration": "optimal",
    "sleepConsistency": "consistent",
    "sleepQuality": "refreshed",
    "cardioMinutes": "high",
    "strengthDays": "optimal",
    "dailySteps": "high",
    "sedentaryHours": "low",
    "smokingStatus": "never",
    "alcoholIntake": "none",
    "stressLevel": "low",
    "socialConnection": "strong",
    "hasLabs": "yes",
    "fastingGlucose": 86,
    "cholesterolRatio": 3.0,
    "hsCrp": "low",
}


class BioAgeNormalUser(HttpUser):
    wait_time = between(0.2, 0.8)

    @task(4)
    def health_check(self):
        with self.client.get("/api/health", name="GET /api/health", catch_response=True) as res:
            if res.status_code != 200 or res.json().get("status") != "ONLINE":
                res.failure(f"Unexpected health response: {res.status_code}")

    @task(3)
    def calculate_bioage(self):
        with self.client.post(
            "/api/bioage/calculate",
            json=SAMPLE_BIOMARKER_PAYLOAD,
            name="POST /api/bioage/calculate",
            catch_response=True,
        ) as res:
            if res.status_code != 200 or not res.json().get("success"):
                res.failure(f"BioAge calculation failed: {res.status_code}")

    @task(2)
    def load_homepage(self):
        with self.client.get("/", name="GET / (Frontend)", catch_response=True) as res:
            if res.status_code != 200 or "BioAge Pro" not in res.text:
                res.failure(f"Homepage load failed: {res.status_code}")

    @task(2)
    def get_history(self):
        with self.client.get(
            "/api/bioage/history/usr_elena",
            name="GET /api/bioage/history/:userId",
            catch_response=True,
        ) as res:
            if res.status_code != 200 or not res.json().get("success"):
                res.failure(f"History fetch failed: {res.status_code}")

    @task(1)
    def login_demo_user(self):
        with self.client.post(
            "/api/auth/login",
            json={"email": "alex@workplace.com", "password": "password123"},
            name="POST /api/auth/login",
            catch_response=True,
        ) as res:
            if res.status_code != 200 or not res.json().get("success"):
                res.failure(f"Login failed: {res.status_code}")


class BioAgeHeavyUser(BioAgeNormalUser):
    wait_time = between(0.05, 0.25)
