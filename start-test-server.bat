@echo off
echo 🚀 Starting DSP Extension Test Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.x
    echo 💡 Download from: https://python.org/downloads
    pause
    exit /b 1
)

REM Check if test-page.html exists
if not exist "test-page.html" (
    echo ❌ test-page.html not found
    echo 💡 Make sure you're running this from the project root directory
    pause
    exit /b 1
)

echo 📡 Starting server on http://localhost:8000
echo 🧪 Test page: http://localhost:8000/test-page.html
echo.
echo 🔧 Extension Setup:
echo 1. Load your extension in the browser
echo 2. Open the test URL above
echo 3. Extension should automatically activate
echo.
echo ⏹️  Press Ctrl+C to stop the server
echo.

REM Start Python server
python local-test-server.py