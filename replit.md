# Web IDE Python - Replit Edition

## Overview
A full-stack web IDE system that lets users create temporary online Python workspaces with a real terminal, Monaco Editor, and local virtual environments. This is the Replit-adapted version that runs without Docker.

**Current State**: Fully functional and running in Replit environment
**Last Updated**: October 5, 2025

## Architecture

### Backend (FastAPI + Local Subprocess)
- FastAPI server running on port 8000
- WebSocket terminal bridge for interactive shell
- File upload and project management
- Local subprocess execution (no Docker required)
- Virtual environment creation for each project

### Frontend (React + Vite)
- React 18 with Vite for fast development
- Running on port 5000 (Replit-compatible)
- Monaco Editor for code editing
- xterm.js for terminal interface
- Tailwind CSS for styling

## Key Changes for Replit

### Docker Removal
The original project used Docker for container isolation. For Replit, we:
1. Removed all Docker dependencies
2. Use local subprocess execution instead
3. Create Python virtual environments directly in temp directories
4. Run shell processes in isolated workspace directories

### Port Configuration
- **Frontend**: Port 5000 (Replit webview)
- **Backend**: Port 8000 (internal API)
- Vite configured with host `0.0.0.0` for Replit proxy compatibility

### Workflows
Two workflows configured:
1. **Frontend**: `cd frontend && npm run dev` (webview on port 5000)
2. **Backend**: `cd backend && python3 main.py` (console on port 8000)

## Project Structure

```
web-ide-python/
├── backend/
│   ├── main.py              # FastAPI application (Docker-free)
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── api.js          # API client functions
│   │   └── components/
│   │       ├── MonacoEditor.jsx
│   │       ├── Terminal.jsx
│   │       └── FileExplorer.jsx
│   ├── package.json
│   └── vite.config.js      # Configured for Replit
└── README.md
```

## How It Works

1. User uploads a ZIP file containing Python project
2. Backend extracts files to a temporary workspace directory
3. Backend creates a Python virtual environment in the workspace
4. If requirements.txt exists, installs dependencies automatically
5. WebSocket terminal provides interactive shell access to workspace
6. Monaco Editor allows file editing with syntax highlighting
7. Changes are saved back to the workspace directory

## Security Considerations

⚠️ **Important Security Notice**:
This Replit version runs workspaces as local subprocesses without the Docker container isolation of the original design. This means:

- **No process isolation**: All projects run under the same user account as the backend
- **Filesystem access**: Users can potentially access files outside their workspace directory
- **Shared environment**: No resource limits or network isolation between projects

**For development/demo purposes only**. Do not expose this publicly without additional sandboxing (e.g., Docker, gVisor, Firejail).

**Current safeguards**:
- Each project runs in its own temporary directory
- Virtual environments prevent global package conflicts
- Projects are stored in temp directories and can be cleaned up
- Terminal uses PTY for proper interactive behavior

## Dependencies

### Python
- fastapi
- uvicorn
- python-multipart
- websockets

### Node.js
- react
- vite
- @monaco-editor/react
- xterm & xterm addons
- axios
- tailwindcss

## User Preferences

None specified yet.

## Recent Changes

**2025-10-05**: Initial Replit setup
- Removed Docker dependencies
- Implemented local subprocess execution
- Configured Vite for port 5000 with Replit proxy support
- Set up frontend and backend workflows
- Updated .gitignore for Replit-specific files
