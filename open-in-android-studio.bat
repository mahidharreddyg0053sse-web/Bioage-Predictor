@echo off
echo ============================================================
echo   BioAge Pro - Opening Native Android App in Android Studio
echo ============================================================
echo.

set "STUDIO_PATH=C:\Program Files\Android\Android Studio\bin\studio64.exe"

if not exist "%STUDIO_PATH%" (
    echo [ERROR] Android Studio not found at %STUDIO_PATH%
    echo Please make sure Android Studio is installed.
    pause
    exit /b 1
)

echo Launching Android Studio with project: %~dp0android-app ...
start "" "%STUDIO_PATH%" "%~dp0android-app"

echo.
echo ============================================================
echo [INSTRUCTIONS TO GET YOUR APK IN ANDROID STUDIO]:
echo ============================================================
echo   1. Wait a moment for Android Studio to sync Gradle.
echo   2. Click on the top menu: "Build" -> "Build Bundle(s) / APK(s)" -> "Build APK(s)"
echo   3. When done, a popup will say "APK(s) generated successfully".
echo      Click "locate" to get your app-debug.apk file!
echo   4. Or plug in your phone and click the green Play button (Run) to install it directly.
echo ============================================================
echo.
pause

