@echo off
setlocal enabledelayedexpansion
title PulseEQ One-Click Setup

echo ============================================================
echo               PulseEQ Quick Installer
echo ============================================================
echo.

:: 1. Check Python installation
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Opening https://www.python.org/downloads/ ...
    start https://www.python.org/downloads/
    echo Please install Python (make sure to check "Add Python to PATH" during install),
    echo then run this setup file again.
    echo.
    pause
    exit /b 1
)

echo [1/4] Python detected. Installing required dependencies...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r "%~dp0requirements.txt"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install Python dependencies. Check your internet connection.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

:: 2. Check and link Equalizer APO
echo [2/4] Checking Equalizer APO configuration...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0link_apo.ps1"
echo.

:: 3. Launch PulseEQ in the background
echo [3/4] Launching PulseEQ...
pushd "%~dp0.."
where pythonw >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "" pythonw main.py
) else (
    start "" python main.py
)
popd
timeout /t 2 >nul

:: 4. Open Browser
echo [4/4] Opening Web UI in browser...
start http://127.0.0.1:8765

echo.
echo ============================================================
echo                INSTALLATION COMPLETE!
echo ============================================================
echo.
echo PulseEQ is now running silently in your system tray (bottom-right).
echo.
echo IMPORTANT NEXT STEP:
echo 1. Look at your Windows notification area (near the clock).
echo 2. Right-click the PulseEQ equalizer icon.
echo 3. Click "Start with Windows" so it runs on PC boot.
echo.
echo ============================================================
echo.
pause
