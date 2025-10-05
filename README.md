# Web IDE Python

A full-stack web IDE system (like Replit or VS Code Web) that lets users create temporary online Python workspaces with a real terminal, Monaco Editor, and ephemeral virtual environments. Each user project runs inside a Docker container, isolated and temporary.

## 🚀 Features

- **Monaco Editor**: Full-featured code editor with Python syntax highlighting
- **Real Terminal**: Interactive terminal using xterm.js with WebSocket connection
- **Docker Isolation**: Each project runs in its own Docker container
- **Virtual Environment**: Automatic Python virtual environment creation
- **Dependency Management**: Automatic pip install from requirements.txt
- **File Management**: Upload, edit, and save Python projects
- **Security**: Non-root containers with resource limits

## 🏗️ Architecture

### Backend (FastAPI + Docker)
- FastAPI server with Docker SDK integration
- WebSocket terminal bridge
- File upload and project management
- Container lifecycle management

### Frontend (React + Vite)
- React 18 with Vite for fast development
- Monaco Editor for code editing
- xterm.js for terminal interface
- Tailwind CSS for styling

## 📁 Project Structure

```
web-ide-python/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile          # Base container image
│   └── sandboxes/          # Temporary project workspaces
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── api.js          # API client functions
│   │   └── components/
│   │       ├── MonacoEditor.jsx
│   │       ├── Terminal.jsx
│   │       └── FileExplorer.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🛠️ Setup and Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop (Windows) or Docker Engine
- Git

### ⚠️ Important: Docker Setup

**Before starting, ensure Docker is properly installed and running:**

1. **Install Docker Desktop** (Windows): https://www.docker.com/products/docker-desktop/
2. **Start Docker Desktop** and wait for it to fully initialize
3. **Verify Docker is working**: Run `check_docker.bat` or `docker --version`
4. **See DOCKER_SETUP.md** for detailed troubleshooting

**Common Docker Issues:**
- "Not supported URL scheme http+docker" → Docker Desktop not running
- "Permission denied" → Run as Administrator or check user permissions
- "WSL 2 installation incomplete" → Update WSL 2 and restart

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the FastAPI server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 🎯 Usage

### Creating a Project

1. Open `http://localhost:5173` in your browser
2. Click "Create Virtual Editor"
3. Upload a ZIP file containing your Python project
4. Click "Start Container" to launch the Docker environment
5. Start coding in the Monaco Editor
6. Use the terminal for running Python commands

### Project Structure

Your uploaded ZIP file should contain:
- Python files (`.py`)
- `requirements.txt` (optional, for dependencies)
- Any other project files

### Terminal Commands

Once the container is running, you can use the terminal to:
- Activate the virtual environment: `source venv/bin/activate`
- Install packages: `pip install package_name`
- Run Python scripts: `python script.py`
- Use standard Unix commands

## 🔒 Security Features

- **Non-root containers**: All containers run as non-root user
- **Resource limits**: 2GB RAM limit per container
- **No new privileges**: Security option prevents privilege escalation
- **Isolated workspaces**: Each project runs in its own container
- **Temporary storage**: Projects are automatically cleaned up

## 🐳 Docker Configuration

The system uses a base Python 3.11-slim image with:
- Build tools (build-essential)
- Git for version control
- Pre-configured non-root user
- Working directory at `/home/dev/workspace`

## 📡 API Endpoints

### REST API

- `POST /api/projects` - Create a new project
- `POST /api/projects/{id}/upload` - Upload ZIP file
- `POST /api/projects/{id}/start` - Start Docker container
- `GET /api/projects/{id}/files` - List project files
- `GET /api/projects/{id}/files/{path}` - Read file content
- `PUT /api/projects/{id}/files/{path}` - Write file content
- `DELETE /api/projects/{id}` - Delete project and cleanup

### WebSocket

- `WS /ws/term/{container_id}` - Terminal communication

## 🚀 Development

### Backend Development

```bash
cd backend
uvicorn main:app --reload
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🧪 Testing

### Backend Testing

```bash
cd backend
python -m pytest
```

### Frontend Testing

```bash
cd frontend
npm test
```

## 🐛 Troubleshooting

### Common Issues

1. **Docker not running**: 
   - Start Docker Desktop and wait for full initialization
   - Run `check_docker.bat` to diagnose issues
   - See DOCKER_SETUP.md for detailed solutions

2. **"Not supported URL scheme http+docker"**:
   - Docker Desktop is not running or not accessible
   - Restart Docker Desktop
   - Run as Administrator if needed

3. **Port conflicts**: Change ports in `vite.config.js` and `main.py`

4. **Permission errors**: 
   - Ensure Docker has proper permissions
   - Run Docker Desktop as Administrator
   - Check user account is in docker-users group

5. **Container startup failures**: 
   - Check Docker logs and resource availability
   - Ensure sufficient RAM (4GB+) allocated to Docker
   - Check if virtualization is enabled in BIOS

### Logs

- Backend logs: Check terminal output
- Frontend logs: Check browser console
- Container logs: Use `docker logs <container_id>`

## 🔮 Future Enhancements

- [ ] Language Server Protocol (LSP) integration
- [ ] Live preview for web applications
- [ ] Persistent storage for user projects
- [ ] Kubernetes deployment for scaling
- [ ] Multi-language support
- [ ] Collaborative editing
- [ ] Git integration
- [ ] Package management UI

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Note**: This is a development tool. For production use, consider additional security measures and proper deployment strategies.
