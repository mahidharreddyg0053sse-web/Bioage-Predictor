@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   BioAge Pro - Launching Web App on Android via USB
echo ============================================================
echo.

set "ADB_BIN="

REM 1. Check if adb is in PATH
where adb >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set "ADB_BIN=adb"
)

REM 2. Check local project platform-tools folder
if not defined ADB_BIN (
    if exist "%~dp0platform-tools\adb.exe" (
        set "ADB_BIN=%~dp0platform-tools\adb.exe"
    )
)

REM 3. Check WinGet package directory
if not defined ADB_BIN (
    for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.PlatformTools*") do (
        if exist "%%D\platform-tools\adb.exe" (
            set "ADB_BIN=%%D\platform-tools\adb.exe"
        )
    )
)

REM 4. Check default Android SDK locations
if not defined ADB_BIN (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "ADB_BIN=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    )
)

REM If still not found, show install instructions
if not defined ADB_BIN (
    echo [ERROR] 'adb' was not found on your computer.
    echo.
    echo Please install via PowerShell:
    echo   winget install Google.PlatformTools --accept-source-agreements --accept-package-agreements
    echo.
    pause
    exit /b 1
)

echo [Found ADB: !ADB_BIN!]
echo.

echo [1/3] Checking connected Android devices...
"!ADB_BIN!" devices
echo.

echo [2/3] Setting up USB port forwarding (phone:3000 -^> PC:3000)...
"!ADB_BIN!" reverse tcp:3000 tcp:3000
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Could not communicate with your phone.
    echo.
    echo Please check:
    echo   1. Your phone is connected with a USB cable.
    echo   2. 'USB Debugging' is turned ON in Settings ^> Developer Options.
    echo   3. Look at your phone screen: if prompted, tap "Allow".
    echo.
    pause
    exit /b 1
)

echo [3/3] Launching BioAge Pro in your mobile browser...
"!ADB_BIN!" shell am start -a android.intent.action.VIEW -d "http://localhost:3000"

echo.
echo ============================================================
echo [SUCCESS] BioAge Pro is now open on your Android phone!
echo (Keep your backend server running: npm start)
echo ============================================================
echo.
pause
