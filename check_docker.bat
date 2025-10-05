@echo off
echo ========================================
echo Docker Connection Check for Web IDE Python
echo ========================================
echo.

echo 1. Checking Docker installation...
docker --version
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not in PATH
    echo.
    echo Please install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo ✅ Docker is installed

echo.
echo 2. Testing Docker connection...
docker info
if %errorlevel% neq 0 (
    echo ❌ Docker is not running or not accessible
    echo.
    echo Please ensure:
    echo - Docker Desktop is running
    echo - Docker Desktop icon is green in system tray
    echo - Docker Desktop has finished initializing
    echo.
    echo If Docker Desktop is running but still failing, try:
    echo 1. Restart Docker Desktop
    echo 2. Run this script as Administrator
    echo 3. Check Docker Desktop settings
    echo 4. Restart your computer
    echo.
    pause
    exit /b 1
)
echo ✅ Docker is running and accessible

echo.
echo 3. Testing Docker with Python container...
docker run --rm python:3.11-slim python --version
if %errorlevel% neq 0 (
    echo ❌ Failed to run Python container
    echo This might indicate resource or permission issues
    echo.
    pause
    exit /b 1
)
echo ✅ Docker can run Python containers

echo.
echo ========================================
echo 🎉 All Docker checks passed!
echo You can now run the Web IDE Python system.
echo ========================================
echo.
pause
