@echo off
:: PulseEQ Launcher
:: Starts PulseEQ in the background with the system tray icon

where pythonw >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "" pythonw main.py
) else (
    start "" python main.py
)
exit
