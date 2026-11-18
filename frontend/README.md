# 🧬 BioAge Pro — Biological Age Predictor & Longevity Intelligence Platform
### *Full-Stack Geroscience Web & Mobile Application with Google Gemini AI Integration*

---

## 🎓 College Viva & Project Overview

This project is built as a complete **Full-Stack Application** adhering to standard industry software engineering practices and college project guidelines:
- **Frontend Layer:** Responsive Client-Side Web & Mobile Application (HTML5, Modern Clinical White CSS3, JavaScript ES6+, Chart.js).
- **Backend Layer:** Node.js & Express RESTful API Server with persistent database services and server-side geroscience calculations.
- **AI Intelligence Layer:** Google Gemini 3.5 Flash Lite LLM ("Biopro" Clinical Longevity Bot) integrated via secure server-side API proxy.
- **Database Layer:** JSON-based persistent file store (`backend/database/data/database.json`) managing user authentication records, clinical telemetry, and assessment logs.

---

## 📁 Project Directory Structure

```
Bioage-Detector/
├── backend/                             # 🖥️ BACKEND SERVER (Node.js + Express)
│   ├── .env                             # Environment variables & Gemini API Key (Hidden from client)
│   ├── server.js                        # Express server entrypoint & REST router
│   ├── database/                        # Database management layer
│   │   ├── db.js                        # JSON database ORM/data access service
│   │   └── data/
│   │       └── database.json            # Persistent user profiles, assessments & chat logs
│   ├── routes/                          # REST API route handlers
│   │   ├── authRoutes.js                # /api/auth (Login, Register, User Telemetry)
│   │   ├── bioageRoutes.js              # /api/bioage (Calculation & Assessment History)
│   │   └── geminiRoutes.js              # /api/gemini (Biopro AI Chat & Clinical Diagnosis)
│   └── services/                        # Business logic & external AI connectors
│       ├── calculatorService.js         # Geroscience mathematical algorithm
│       └── geminiService.js             # Google Generative Language API integration
│
├── frontend/                            # 🌐 FRONTEND APPLICATION (Client-Side)
│   ├── index.html                       # Clinical white Single-Page Application (SPA)
│   ├── style.css                        # Professional medical design system
│   └── js/                              # Modular Client Controllers
│       ├── app.js                       # Main application lifecycle controller
│       ├── auth.js                      # Authentication & session manager (API bridge)
│       ├── calculator.js                # Assessment telemetry collector & form logic
│       ├── dashboard.js                 # Organ clock, charts & biological age dials
│       ├── gemini.js                    # Biopro AI modal client controller
│       ├── simulator.js                 # What-If Longevity scenario simulator
│       └── data.js                      # Clinical guidelines, demo profiles & protocols
│
├── package.json                         # Project dependencies, scripts & metadata
├── start.bat                            # 1-Click Dual Launch script for Windows
└── README.md                            # Complete Project & College Viva Documentation
```

---

## ⚡ How to Run the Project

### Option 1: One-Click Launch (Recommended)
Double-click `start.bat` in the project folder. It will:
1. Automatically start the Express backend server on `http://localhost:3000`.
2. Open your default web browser to the application dashboard.

### Option 2: Command Line Launch
```bash
# 1. Open Terminal in the project directory
cd C:\Users\varap\Downloads\project\Bioage-Detector

# 2. Start the full-stack server
npm start
```
Visit **`http://localhost:3000`** in your browser.

---

## 📡 REST API Documentation

| HTTP Method | Endpoint URL | Description | Request Body |
|---|---|---|---|
| **GET** | `/api/health` | System health check & server status | None |
| **POST** | `/api/auth/login` | Authenticate user credentials | `{ "email", "password" }` |
| **POST** | `/api/auth/register` | Register new user profile | `{ "name", "email", "password", "birthdate", "gender" }` |
| **GET** | `/api/auth/user/:id` | Fetch user profile & telemetry | None |
| **PUT** | `/api/auth/user/:id/data` | Update user health data | Telemetry form object |
| **POST** | `/api/bioage/calculate` | Server-side geroscience computation | Patient telemetry data |
| **POST** | `/api/bioage/history` | Save assessment record | Evaluation record object |
| **GET** | `/api/bioage/history/:userId` | Retrieve past evaluations | None |
| **POST** | `/api/gemini/biopro-chat` | Biopro AI Clinical Longevity consultation | `{ "question", "patientContext" }` |
| **POST** | `/api/gemini/diagnose` | AI deep longevity diagnosis & organ ages | Patient telemetry data |

---

## 🎯 Questions & Answers for College Viva

### Q1: What is the Frontend and what is the Backend in your project?
- **Answer:** 
  - **Frontend:** Built with semantic HTML5, clean medical CSS3 (CSS Grid, Flexbox, responsive typography), and ES6+ JavaScript. It renders the assessment wizard, interactive organ clock, Chart.js telemetry charts, What-If simulator, and the Biopro AI bot interface.
  - **Backend:** Built with Node.js and Express. It exposes RESTful API endpoints for authentication, mathematical biological age calculation, persistence to a JSON database, and acts as a secure server-side proxy for the Google Gemini 3.5 AI model.

### Q2: How do Frontend and Backend communicate?
- **Answer:** The frontend communicates asynchronously with the backend using the standard JavaScript `fetch` API over HTTP JSON payloads. For instance, when the user chats with Biopro, the frontend sends a `POST` request to `/api/gemini/biopro-chat`. The backend receives the request, calls Google Gemini securely, logs the chat to the database, and returns the response as JSON to the frontend.

### Q3: Where is your database and how is data stored?
- **Answer:** Data is stored in `backend/database/data/database.json`. We implemented an ORM/service layer (`backend/database/db.js`) that manages user accounts, password authentication, chronological and biological assessment records, and AI chat logs with full CRUD operations and persistence across server restarts.

### Q4: Why is the AI API key kept on the backend instead of the frontend?
- **Answer:** Security Best Practice! If an API key is stored in frontend JavaScript, any user can inspect the source code in their browser and steal the key. In our architecture, the Gemini API key is stored securely inside `backend/.env` on the server. The client never sees the API key; it only calls our protected backend endpoint.

### Q5: How is Biological Age calculated?
- **Answer:** We implemented a multi-system geroscience formula based on published clinical longevity research (Levine PhenoAge, NHANES, and AHA Life's Essential 8). It evaluates 5 clinical domains:
  1. **Cardiovascular:** Resting Heart Rate, Blood Pressure (Systolic/Diastolic).
  2. **Metabolic:** BMI, Mediterranean Diet adherence, Ultra-processed food intake, Sugar consumption, Fasting.
  3. **Cellular:** Sleep duration, Sleep consistency, Hydration, Inflammatory biomarkers.
  4. **Physical Fitness:** Weekly cardio minutes, Resistance training days, Daily steps, Sedentary time.
  5. **Mental Resilience:** Chronic stress level, Social connectivity, Substance habits (smoking, alcohol).
  Each domain calculates a biological age delta ($Delta$) relative to chronological age to determine pace of aging ($Pace = BioAge / ChronoAge$) and remaining projected life expectancy.

### Q6: What is the "Biopro" Bot?
- **Answer:** Biopro is an embedded clinical intelligence assistant powered by Google Gemini 3.5 Flash Lite. It analyzes the patient's individual biomarker and lifestyle data to provide doctor-level recommendations, explaining the biological mechanisms (autophagy, telomere protection, arterial elasticity) simply and concisely.

---

## 🔒 Security & Best Practices Implemented
- **CORS Protection:** Configured in Express to manage cross-origin access.
- **Environment Isolation:** Sensitive tokens and configurations isolated in `.env`.
- **Fault Tolerance:** Frontend includes graceful fallbacks if backend or AI services experience network latency.
- **Input Sanitization & Normalization:** User inputs, emails, and biometric measurements are validated and typed before evaluation.
