@echo off
echo.
echo ========================================
echo  Brain Tumor Segmentation Web App
echo ========================================
echo.
echo Starting the application...
echo.

REM Change to the application directory
cd /d "%~dp0"

REM Activate virtual environment and start the app
.\.venv\Scripts\python.exe app.py

echo.
echo Application stopped.
pause
