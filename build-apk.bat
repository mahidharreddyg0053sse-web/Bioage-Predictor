@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   BioAge Pro - Building Android Native APK via Command Line
echo ============================================================
echo.

cd /d "%~dp0android-app"

REM 1. Set Java to Android Studio's bundled Java 21 (JBR)
if exist "C:\PROGRA~1\Android\ANDROI~1\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\PROGRA~1\Android\ANDROI~1\jbr"
) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)

REM 2. Prepend JBR to PATH so Gradle uses Java 21 instead of system Java 25
if defined JAVA_HOME (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

REM 3. Find Gradle binary
set "GRADLE_CMD="

REM Check PATH
where gradle >nul 2>nul
if %ERRORLEVEL% EQU 0 set "GRADLE_CMD=gradle"

REM Check local Gradle in .gradle dists
if not defined GRADLE_CMD (
    for /d %%D in ("%USERPROFILE%\.gradle\wrapper\dists\gradle-8.9-bin\*") do (
        if exist "%%D\gradle-8.9\bin\gradle.bat" (
            set "GRADLE_CMD=%%D\gradle-8.9\bin\gradle.bat"
        )
    )
)

if not defined GRADLE_CMD (
    for /d %%V in ("%USERPROFILE%\.gradle\wrapper\dists\gradle-*") do (
        for /d %%D in ("%%V\*") do (
            for /d %%G in ("%%D\gradle-*") do (
                if exist "%%G\bin\gradle.bat" (
                    set "GRADLE_CMD=%%G\bin\gradle.bat"
                )
            )
        )
    )
)

if not defined GRADLE_CMD (
    echo [ERROR] No Gradle installation found on your system.
    pause
    exit /b 1
)

echo [Using Java  : %JAVA_HOME%]
echo [Using Gradle: !GRADLE_CMD!]
echo.

echo Stopping any old Gradle daemons...
call "!GRADLE_CMD!" --stop >nul 2>nul

echo.
echo ============================================================
echo Compiling Android APK with Java 21... Please wait...
echo ============================================================
echo.

call "!GRADLE_CMD!" assembleDebug --console=plain

if exist "%~dp0android-app\app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ============================================================
    echo [SUCCESS] APK successfully built!
    echo Location: %~dp0android-app\app\build\outputs\apk\debug\app-debug.apk
    echo ============================================================
    explorer /select,"%~dp0android-app\app\build\outputs\apk\debug\app-debug.apk"
    pause
    exit /b 0
) else (
    echo.
    echo [ERROR] Build completed but APK was not found. Check errors above.
    pause
    exit /b 1
)
