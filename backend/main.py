import os
import uuid
import zipfile
import asyncio
import json
import subprocess
import shutil
import platform
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Windows-specific imports
if platform.system() == "Windows":
    import msvcrt
    import ctypes
    from ctypes import wintypes
else:
    import pty
    import tty
    import select
    import termios
    import struct
    import fcntl

app = FastAPI(title="Web IDE Python Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Docker client using subprocess (more reliable on Windows)
def check_docker_available():
    """Check if Docker is available using subprocess"""
    try:
        result = subprocess.run(['docker', '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("Docker is available")
            return True
        else:
            print(f"Docker check failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"Docker check error: {e}")
        return False

def run_docker_command(cmd, **kwargs):
    """Run Docker command using subprocess"""
    try:
        result = subprocess.run(['docker'] + cmd, 
                              capture_output=True, text=True, timeout=60, **kwargs)
        return result
    except subprocess.TimeoutExpired:
        print(f"Docker command timed out: {' '.join(cmd)}")
        return None
    except Exception as e:
        print(f"Docker command error: {e}")
        return None

# Check Docker availability
docker_available = check_docker_available()

# Base directory for sandboxes (Windows compatible)
import tempfile
SANDBOX_BASE = Path(tempfile.gettempdir()) / "web_ide_sandboxes"
SANDBOX_BASE.mkdir(exist_ok=True)

# Store active containers
active_containers = {}

@app.get("/")
async def root():
    docker_status = "available" if docker_available else "unavailable"
    return {
        "message": "Web IDE Python Backend is running",
        "docker_status": docker_status
    }

@app.post("/api/projects")
async def create_project():
    """Create a new project with unique ID"""
    project_id = str(uuid.uuid4())
    project_dir = SANDBOX_BASE / project_id
    project_dir.mkdir(exist_ok=True)
    
    return {"project_id": project_id, "status": "created"}

@app.post("/api/projects/{project_id}/upload")
async def upload_project(project_id: str, file: UploadFile = File(...)):
    """Upload and extract ZIP file to project workspace"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
    
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    workspace_dir.mkdir(exist_ok=True)
    
    # Save uploaded file
    zip_path = project_dir / "uploaded.zip"
    with open(zip_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Extract ZIP file
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(workspace_dir)
    
    # Clean up ZIP file
    zip_path.unlink()
    
    return {"status": "uploaded", "workspace_path": str(workspace_dir)}

@app.post("/api/projects/{project_id}/start")
async def start_container(project_id: str):
    """Start Docker container with Python environment"""
    if not docker_available:
        raise HTTPException(status_code=503, detail="Docker is not available. Please ensure Docker is running.")
    
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    if not workspace_dir.exists():
        raise HTTPException(status_code=404, detail="Workspace not found. Upload a project first.")
    
    try:
        # Create container using subprocess
        container_name = f"web-ide-{project_id}"
        
        # Run container
        cmd = [
            "run", "-d",
            "--name", container_name,
            "--workdir", "/home/dev/workspace",
            "-v", f"{workspace_dir}:/home/dev/workspace:rw",
            "--user", "1000:1000",
            "--memory", "2g",
            "--security-opt", "no-new-privileges",
            "-e", "PYTHONUNBUFFERED=1",
            "-e", "PATH=/home/dev/workspace/venv/bin:$PATH",
            "python:3.11-slim",
            "/usr/local/bin/python3", "-c", "import time; time.sleep(999999)"
        ]
        
        result = run_docker_command(cmd)
        if not result or result.returncode != 0:
            raise Exception(f"Failed to create container: {result.stderr if result else 'Unknown error'}")
        
        container_id = result.stdout.strip()
        active_containers[project_id] = container_id
        
        # Setup Python environment
        await setup_python_environment_subprocess(container_id)
        
        return {
            "status": "started",
            "container_id": container_id,
            "project_id": project_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start container: {str(e)}")

async def setup_python_environment_subprocess(container_id):
    """Setup Python virtual environment and install dependencies using subprocess"""
    try:
        # Create virtual environment
        cmd = ["exec", container_id, "python3", "-m", "venv", "/home/dev/workspace/venv"]
        result = run_docker_command(cmd)
        
        if not result or result.returncode != 0:
            print(f"Failed to create venv: {result.stderr if result else 'Unknown error'}")
            return
        
        # Check if requirements.txt exists and install dependencies
        cmd = ["exec", container_id, "test", "-f", "/home/dev/workspace/requirements.txt"]
        result = run_docker_command(cmd)
        
        if result and result.returncode == 0:
            # Install requirements
            cmd = ["exec", container_id, "bash", "-c", 
                   "source /home/dev/workspace/venv/bin/activate && pip install -r /home/dev/workspace/requirements.txt"]
            result = run_docker_command(cmd)
            
            if not result or result.returncode != 0:
                print(f"Failed to install requirements: {result.stderr if result else 'Unknown error'}")
        
        print("Python environment setup completed")
        
    except Exception as e:
        print(f"Error setting up Python environment: {str(e)}")

@app.websocket("/ws/term/{container_id}")
async def websocket_terminal(websocket: WebSocket, container_id: str):
    """WebSocket endpoint for terminal communication"""
    try:
        print(f"WebSocket connection attempt for container: {container_id}")
        await websocket.accept()
        print(f"WebSocket accepted for container: {container_id}")
    except Exception as e:
        print(f"Error accepting WebSocket: {e}")
        return
    
    if not docker_available:
        try:
            await websocket.send_text("Error: Docker is not available")
            await websocket.close()
        except:
            pass
        return
    
    try:
        # Check if container exists and is running
        result = run_docker_command(["inspect", "--format", "{{.State.Running}}", container_id])
        if not result or result.returncode != 0:
            await websocket.send_text(f"Error: Container {container_id} not found or not running\r\n")
            await websocket.close()
            return
        
        if result.stdout.strip() != "true":
            await websocket.send_text(f"Error: Container {container_id} is not running\r\n")
            await websocket.close()
            return
        
        print(f"Creating shell process for container: {container_id}")
        
        # Create interactive shell process
        process = subprocess.Popen(
            ['docker', 'exec', '-i', container_id, '/bin/bash'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=0,
            env={'TERM': 'xterm-256color', 'COLUMNS': '80', 'LINES': '24', 'PS1': '$ ', 'HOME': '/root', 'USER': 'root', 'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}
        )
        
        # Handle bidirectional communication
        async def read_from_container():
            try:
                while True:
                    if process.poll() is not None:
                        print("Process terminated")
                        break
                    
                    # Read from container stdout
                    try:
                        data = process.stdout.read(1)
                        if data:
                            print(f"Read from container: {repr(data)}")
                            try:
                                await websocket.send_text(data)
                                print(f"Sent to WebSocket: {repr(data)}")
                            except WebSocketDisconnect:
                                print("WebSocket disconnected during read")
                                break
                            except Exception as e:
                                print(f"Error sending to WebSocket: {e}")
                                break
                        else:
                            await asyncio.sleep(0.01)
                    except Exception as e:
                        print(f"Error reading from container: {e}")
                        break
            except WebSocketDisconnect:
                print("WebSocket disconnected during read")
            except Exception as e:
                print(f"Error reading from container: {e}")
        
        async def write_to_container():
            try:
                while True:
                    data = await websocket.receive_text()
                    print(f"Received data from WebSocket: {repr(data)}")
                    
                    # Handle resize messages (for future use)
                    try:
                        resize_data = json.loads(data)
                        if resize_data.get('type') == 'resize':
                            # For now, just acknowledge resize
                            print(f"Resize request: {resize_data.get('cols')}x{resize_data.get('rows')}")
                            continue
                    except (json.JSONDecodeError, KeyError):
                        pass
                    
                    # Write data to container stdin
                    try:
                        print(f"Writing to container stdin: {repr(data)}")
                        process.stdin.write(data)
                        process.stdin.flush()
                        print(f"Successfully wrote to container stdin")
                    except Exception as e:
                        print(f"Error writing to container: {e}")
                        break
            except WebSocketDisconnect:
                print("WebSocket disconnected during write")
            except Exception as e:
                print(f"Error writing to container: {e}")
        
        # Run both tasks concurrently
        try:
            await asyncio.gather(
                read_from_container(),
                write_to_container(),
                return_exceptions=True
            )
        except Exception as e:
            print(f"WebSocket communication error: {e}")
        
    except Exception as e:
        print(f"WebSocket terminal error: {e}")
        try:
            await websocket.send_text(f"Error: {str(e)}\r\n")
        except:
            pass
        try:
            await websocket.close()
        except:
            pass
    finally:
        try:
            if 'process' in locals() and process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
        except:
            pass
        try:
            await websocket.close()
        except:
            pass

@app.get("/api/projects/{project_id}/files")
async def list_files(project_id: str):
    """List files in the project workspace"""
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    if not workspace_dir.exists():
        return {"files": []}
    
    def get_file_tree(path: Path, relative_path: Path = Path("")):
        files = []
        try:
            for item in path.iterdir():
                if item.is_file() and not item.name.startswith('.'):
                    files.append({
                        "name": item.name,
                        "path": str(relative_path / item.name),
                        "type": "file"
                    })
                elif item.is_dir() and not item.name.startswith('.'):
                    files.append({
                        "name": item.name,
                        "path": str(relative_path / item.name),
                        "type": "directory",
                        "children": get_file_tree(item, relative_path / item.name)
                    })
        except PermissionError:
            pass
        return files
    
    return {"files": get_file_tree(workspace_dir)}

@app.get("/api/projects/{project_id}/files/{file_path:path}")
async def read_file(project_id: str, file_path: str):
    """Read file content"""
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    if not workspace_dir.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    file_full_path = workspace_dir / file_path
    
    if not file_full_path.exists() or not file_full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        content = file_full_path.read_text(encoding='utf-8')
        return {"content": content, "path": file_path}
    except UnicodeDecodeError:
        # Try with different encoding for binary files
        try:
            content = file_full_path.read_text(encoding='latin-1')
            return {"content": content, "path": file_path}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read file (binary?): {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

@app.put("/api/projects/{project_id}/files/{file_path:path}")
async def write_file(project_id: str, file_path: str, content: str):
    """Write file content"""
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    if not workspace_dir.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    file_full_path = workspace_dir / file_path
    
    try:
        # Create parent directories if they don't exist
        file_full_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_full_path.write_text(content, encoding='utf-8')
        return {"status": "saved", "path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {str(e)}")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Stop container and cleanup project files"""
    try:
        # Stop and remove container if it exists
        if project_id in active_containers and docker_available:
            container_id = active_containers[project_id]
            try:
                # Stop container
                run_docker_command(["stop", container_id])
                # Remove container
                run_docker_command(["rm", container_id])
            except Exception:
                pass
            del active_containers[project_id]
        
        # Clean up project directory
        project_dir = SANDBOX_BASE / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)
        
        return {"status": "deleted", "project_id": project_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

@app.get("/api/projects/{project_id}/status")
async def get_project_status(project_id: str):
    """Get project and container status"""
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    status = {
        "project_id": project_id,
        "workspace_exists": workspace_dir.exists(),
        "container_running": False,
        "container_id": None
    }
    
    if project_id in active_containers and docker_available:
        container_id = active_containers[project_id]
        try:
            # Check container status using subprocess
            result = run_docker_command(["inspect", "--format", "{{.State.Running}}", container_id])
            if result and result.returncode == 0:
                status["container_running"] = result.stdout.strip() == "true"
                status["container_id"] = container_id
            else:
                del active_containers[project_id]
        except Exception:
            del active_containers[project_id]
    
    return status

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
