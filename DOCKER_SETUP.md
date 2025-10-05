# Docker Setup Guide for Web IDE Python

## 🐳 Docker Installation and Setup

### Windows Setup

1. **Install Docker Desktop for Windows**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Run the installer and follow the setup wizard
   - Restart your computer if prompted

2. **Start Docker Desktop**
   - Launch Docker Desktop from the Start menu
   - Wait for Docker to fully start (you'll see a green icon in the system tray)
   - Docker Desktop must be running before starting the Web IDE

3. **Verify Docker Installation**
   ```cmd
   docker --version
   docker run hello-world
   ```

### Common Issues and Solutions

#### Issue: "Docker is not running"
**Solution:**
- Start Docker Desktop
- Wait for it to fully initialize (green icon in system tray)
- Try again

#### Issue: "Not supported URL scheme http+docker"
**Solution:**
- This usually means Docker Desktop isn't running
- Restart Docker Desktop
- Check if Docker Desktop is set to start with Windows

#### Issue: "Permission denied" or "Access denied"
**Solution:**
- Run Docker Desktop as Administrator
- Ensure your user account is in the "docker-users" group
- Restart your computer after adding to the group

#### Issue: "WSL 2 installation is incomplete"
**Solution:**
- Update WSL 2: `wsl --update`
- Set WSL 2 as default: `wsl --set-default-version 2`
- Restart Docker Desktop

### Docker Desktop Settings

1. **Resources**
   - Go to Settings > Resources
   - Allocate at least 4GB RAM
   - Allocate at least 2 CPU cores

2. **General**
   - Enable "Use WSL 2 based engine" (recommended)
   - Enable "Start Docker Desktop when you log in"

3. **Advanced**
   - Enable "Enable file sharing" for your project directory

### Testing Docker Connection

Run this command to test if Docker is working:
```cmd
docker run --rm python:3.11-slim python --version
```

You should see:
```
Python 3.11.x
```

### Troubleshooting Commands

```cmd
# Check Docker status
docker info

# Check running containers
docker ps

# Check Docker version
docker --version

# Test Docker with a simple container
docker run --rm hello-world

# Check Docker Desktop logs
# Go to Docker Desktop > Troubleshoot > View logs
```

### Alternative: Using Docker without Docker Desktop

If Docker Desktop causes issues, you can use Docker Engine directly:

1. Install Docker Engine for Windows
2. Configure it to run as a service
3. Update the backend to use the correct Docker socket

### Getting Help

If you're still having issues:

1. Check Docker Desktop logs
2. Restart Docker Desktop
3. Restart your computer
4. Reinstall Docker Desktop
5. Check Windows updates
6. Ensure virtualization is enabled in BIOS

### Quick Fix Script

Create a file called `check_docker.bat`:

```batch
@echo off
echo Checking Docker installation...
docker --version
if %errorlevel% neq 0 (
    echo Docker is not installed or not in PATH
    pause
    exit /b 1
)

echo Testing Docker connection...
docker run --rm hello-world
if %errorlevel% neq 0 (
    echo Docker is not running or not accessible
    echo Please start Docker Desktop
    pause
    exit /b 1
)

echo Docker is working correctly!
pause
```

Run this script to diagnose Docker issues.
