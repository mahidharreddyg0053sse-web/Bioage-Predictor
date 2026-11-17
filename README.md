# PhishGuard — AI-Based Phishing URL & Threat Intelligence Correlation System

PhishGuard is an enterprise-grade cybersecurity web application that detects phishing and malicious URLs using a **Calibrated Random Forest Machine Learning classifier** and correlates ML predictions with external Threat Intelligence feeds (**VirusTotal**, **URLhaus**, and **AbuseIPDB**) while explicitly deduplicating overlapping threat indicators (IoCs).

---

## Architecture & Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Recharts, Axios
- **Backend:** Python, FastAPI, Pydantic v2, Uvicorn, HTTPX, ReportLab
- **Machine Learning:** Scikit-learn (`RandomForestClassifier` with 5-fold Platt sigmoid probability calibration via `CalibratedClassifierCV`), Pandas, NumPy, Joblib — 28 lexical & structural URL features
- **Database:** Supabase PostgreSQL (`database/schema.sql` with Row Level Security policies) with automatic local SQLite fallback when Supabase credentials are not yet configured
- **Threat Intelligence APIs:** VirusTotal v3, URLhaus (abuse.ch), AbuseIPDB v2

---

## Project Structure

```text
phishguard/
├── frontend/
│   ├── src/
│   │   ├── charts/           # Recharts sparklines, donut, risk trend charts
│   │   ├── components/       # Logo, badges, scan detail modal
│   │   ├── layouts/          # MainLayout fixed sidebar & top status header
│   │   ├── pages/            # All 8 application pages
│   │   ├── services/         # Axios API client
│   │   └── utils/            # Formatters & client-side URL validation
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── correlation/      # Deduplicating Threat Correlation Engine
│   │   ├── database/         # Dual-mode Supabase / SQLite repository & ML seeder
│   │   ├── intelligence/     # VirusTotal, URLhaus, AbuseIPDB clients
│   │   ├── ml/               # Feature extractor, dataset builder, trainer & predictor
│   │   ├── models/           # Pydantic schemas
│   │   ├── routes/           # FastAPI endpoints
│   │   ├── services/         # PDF & CSV report generator
│   │   ├── config.py
│   │   ├── security.py       # URL validator, SSRF guard, safe DNS, rate limiter
│   │   └── main.py
│   ├── tests/                # End-to-end API & security test suite
│   └── requirements.txt
├── database/
│   └── schema.sql            # Complete Supabase PostgreSQL schema & RLS policies
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Configure Environment Variables

Copy `.env.example` to `.env` in the project root and add any optional API keys (keep all secrets strictly in backend `.env` — never expose keys in frontend code):

```bash
cp .env.example .env
```

- `VIRUSTOTAL_API_KEY` — VirusTotal v3 API key
- `URLHAUS_API_KEY` — URLhaus Auth-Key
- `ABUSEIPDB_API_KEY` — AbuseIPDB v2 API key
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Optional Supabase PostgreSQL credentials

> **Note:** If external TI API keys are omitted, PhishGuard clearly reports each provider as `Not Configured` / `Unavailable` and **never treats an unavailable API as a clean result**. If Supabase credentials are omitted, PhishGuard uses a local SQLite database with the identical 6-table schema so all features work immediately.

### 2. Setup Supabase Database (Optional)

Open your Supabase SQL Editor and run [`database/schema.sql`](database/schema.sql) to create all 6 tables (`profiles`, `scan_history`, `threat_indicators`, `threat_correlations`, `generated_reports`, `api_integrations`) and Row Level Security (RLS) policies.

### 3. Train the ML Model & Run the Backend

```bash
cd backend
pip install -r requirements.txt

# Train / retrain the Calibrated Random Forest classifier
python app/ml/train_model.py

# Start FastAPI server on http://127.0.0.1:8000
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/scan` | Full URL scan (validation, feature extraction, ML prediction, TI lookups, correlation, DB save) |
| `POST` | `/api/scan/features` | Extract 28 lexical/structural features and human-readable risk signals |
| `GET` | `/api/scan/history` | Paginated, searchable, filterable scan history |
| `GET` | `/api/scan/{id}` | Detailed scan result with feature signals & correlation |
| `GET` | `/api/threat-intelligence/virustotal` | Live VirusTotal URL/domain/IP lookup |
| `GET` | `/api/threat-intelligence/urlhaus` | Live URLhaus URL/host lookup |
| `GET` | `/api/threat-intelligence/abuseipdb` | Live AbuseIPDB IP reputation lookup |
| `POST` | `/api/threat-correlation` | Correlate ML + external TI with IoC deduplication & explainable risk scoring |
| `GET` | `/api/analytics` | Live dashboard & analytics aggregations from stored scans |
| `GET` | `/api/reports` | List generated reports |
| `POST` | `/api/reports/generate` | Generate downloadable PDF scan or threat intelligence report |
| `GET` | `/api/reports/export/csv` | Export all scan records as CSV |

---

## Security Controls

- **Strict URL Validation & SSRF Protection:** Rejects `javascript:`, `file://`, `data:`, loopback (`127.0.0.1`, `localhost`), RFC1918 private IPs, and cloud metadata endpoints (`169.254.169.254`). Suspicious URLs are **never fetched or opened** by the backend.
- **Deduplicated Threat Correlation:** Multiple reports referring to the same canonical `(indicator_type, indicator_value)` are flagged as duplicate indicators and excluded from independent evidence weight.
- **Honest Provider Availability:** Unconfigured, timed-out, or rate-limited external APIs are surfaced explicitly and never treated as clean verdicts.
- **Rate Limiting & Timeouts:** Sliding-window API rate limiting and bounded HTTP client timeouts on all external calls.
