@echo off
title PhishGuard Backend API (FastAPI)
cd /d "%~dp0backend"
echo Starting PhishGuard FastAPI Backend on http://127.0.0.1:8000 ...
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
