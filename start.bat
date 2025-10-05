@echo off
REM Web IDE Python Startup Script for Windows

echo 🚀 Starting Web IDE Python...

REM Check if Docker is running
echo Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo Testing Docker connection...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running or not accessible
    echo Please start Docker Desktop and wait for it to fully initialize
    echo Check the system tray for the Docker icon (should be green)
    echo.
    echo If Docker Desktop is running but still failing, try:
    echo 1. Restart Docker Desktop
    echo 2. Run as Administrator
    echo 3. Check Docker Desktop settings
    echo.
    echo See DOCKER_SETUP.md for detailed troubleshooting
    pause
    exit /b 1
)

echo ✅ Docker is running and accessible

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.11+ and try again.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Create sandboxes directory
if not exist "backend\sandboxes" mkdir backend\sandboxes

echo 📦 Setting up backend...

REM Setup backend
cd backend
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python dependencies...
pip install -r requirements.txt

echo Starting FastAPI server...
start "Backend" cmd /k "uvicorn main:app --reload --host 0.0.0.0 --port 8000"

cd ..

echo 📦 Setting up frontend...

REM Setup frontend
cd frontend
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
)

echo Starting Vite development server...
start "Frontend" cmd /k "npm run dev"

cd ..

echo ✅ Web IDE Python is starting up!
echo.
echo 🌐 Frontend: http://localhost:5173
echo 🔧 Backend:  http://localhost:8000
echo.
echo Press any key to exit...
pause >nul
