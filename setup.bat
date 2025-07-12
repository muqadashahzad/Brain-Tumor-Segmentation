@echo off
echo.
echo ========================================
echo  Brain Tumor Segmentation Web App
echo         Setup Script
echo ========================================
echo.

REM Change to the application directory
cd /d "%~dp0"

echo Creating virtual environment...
python -m venv .venv

echo.
echo Activating virtual environment...
call .\.venv\Scripts\activate.bat

echo.
echo Installing dependencies...
pip install -r requirements.txt

echo.
echo ========================================
echo Setup completed successfully!
echo.
echo To start the application, run: start_app.bat
echo ========================================
echo.
pause
