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

# Platform-specific imports for PTY
if platform.system() != "Windows":
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

# Base directory for sandboxes (Replit compatible)
import tempfile
SANDBOX_BASE = Path(tempfile.gettempdir()) / "web_ide_sandboxes"
SANDBOX_BASE.mkdir(exist_ok=True)

# Store active processes (instead of containers)
active_processes = {}

@app.get("/")
async def root():
    return {
        "message": "Web IDE Python Backend is running (Replit mode)",
        "mode": "local_subprocess"
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
    """Start Python environment locally (no Docker needed)"""
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    if not workspace_dir.exists():
        raise HTTPException(status_code=404, detail="Workspace not found. Upload a project first.")
    
    try:
        # Setup Python virtual environment locally
        await setup_python_environment_local(workspace_dir)
        
        # Generate a pseudo container ID for compatibility
        pseudo_container_id = f"local-{project_id}"
        active_processes[project_id] = pseudo_container_id
        
        return {
            "status": "started",
            "container_id": pseudo_container_id,
            "project_id": project_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start environment: {str(e)}")

async def setup_python_environment_local(workspace_dir: Path):
    """Setup Python virtual environment locally and install dependencies"""
    try:
        venv_dir = workspace_dir / "venv"
        
        # Create virtual environment if it doesn't exist
        if not venv_dir.exists():
            result = subprocess.run(
                ["python3", "-m", "venv", str(venv_dir)],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                print(f"Failed to create venv: {result.stderr}")
                return
        
        # Check if requirements.txt exists and install dependencies
        requirements_file = workspace_dir / "requirements.txt"
        if requirements_file.exists():
            # Get pip path based on platform
            if platform.system() == "Windows":
                pip_path = venv_dir / "Scripts" / "pip"
            else:
                pip_path = venv_dir / "bin" / "pip"
            
            result = subprocess.run(
                [str(pip_path), "install", "-r", str(requirements_file)],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                print(f"Failed to install requirements: {result.stderr}")
        
        print("Python environment setup completed")
        
    except Exception as e:
        print(f"Error setting up Python environment: {str(e)}")

@app.websocket("/ws/term/{container_id}")
async def websocket_terminal(websocket: WebSocket, container_id: str):
    """WebSocket endpoint for terminal communication (local shell)"""
    try:
        print(f"WebSocket connection attempt for: {container_id}")
        await websocket.accept()
        print(f"WebSocket accepted for: {container_id}")
    except Exception as e:
        print(f"Error accepting WebSocket: {e}")
        return
    
    try:
        # Extract project_id from container_id
        project_id = container_id.replace("local-", "")
        project_dir = SANDBOX_BASE / project_id
        workspace_dir = project_dir / "workspace"
        
        if not workspace_dir.exists():
            await websocket.send_text(f"Error: Workspace not found\r\n")
            await websocket.close()
            return
        
        print(f"Creating shell process for workspace: {workspace_dir}")
        
        # Create interactive shell with PTY for better terminal behavior
        if platform.system() != "Windows":
            import pty
            import os as os_module
            import fcntl
            
            # Create a pseudo-terminal
            master_fd, slave_fd = pty.openpty()
            
            # Start shell process with PTY
            process = subprocess.Popen(
                ['/bin/bash', '-i'],
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=str(workspace_dir),
                env={
                    **os.environ,
                    'TERM': 'xterm-256color',
                    'PS1': '\\w $ ',
                    'PYTHONUNBUFFERED': '1'
                },
                preexec_fn=os_module.setsid
            )
            
            # Close slave fd in parent process
            os_module.close(slave_fd)
            
            # Set master fd to non-blocking
            fcntl.fcntl(master_fd, fcntl.F_SETFL, os_module.O_NONBLOCK)
            
            # Set initial terminal size
            import struct
            import termios
            # Default size: 24 rows x 80 cols
            winsize = struct.pack('HHHH', 24, 80, 0, 0)
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
        else:
            # Windows fallback (no PTY support)
            process = subprocess.Popen(
                ['cmd.exe'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=0,
                cwd=str(workspace_dir),
                env={
                    **os.environ,
                    'TERM': 'xterm-256color',
                    'PYTHONUNBUFFERED': '1'
                }
            )
            master_fd = None
        
        # Handle bidirectional communication
        async def read_from_process():
            try:
                while True:
                    if process.poll() is not None:
                        print("Process terminated")
                        break
                    
                    # Read from PTY master or process stdout
                    try:
                        if master_fd is not None:
                            # Reading from PTY (non-blocking)
                            try:
                                data = os.read(master_fd, 1024).decode('utf-8', errors='replace')
                                if data:
                                    try:
                                        await websocket.send_text(data)
                                    except WebSocketDisconnect:
                                        print("WebSocket disconnected during read")
                                        break
                                    except Exception as e:
                                        print(f"Error sending to WebSocket: {e}")
                                        break
                            except BlockingIOError:
                                # No data available, wait a bit
                                await asyncio.sleep(0.01)
                        else:
                            # Windows: read from process stdout
                            data = process.stdout.read(1)
                            if data:
                                try:
                                    await websocket.send_text(data)
                                except WebSocketDisconnect:
                                    print("WebSocket disconnected during read")
                                    break
                                except Exception as e:
                                    print(f"Error sending to WebSocket: {e}")
                                    break
                            else:
                                await asyncio.sleep(0.01)
                    except Exception as e:
                        print(f"Error reading from process: {e}")
                        break
            except WebSocketDisconnect:
                print("WebSocket disconnected during read")
            except Exception as e:
                print(f"Error reading from process: {e}")
        
        async def write_to_process():
            try:
                while True:
                    data = await websocket.receive_text()
                    
                    # Handle resize messages
                    try:
                        resize_data = json.loads(data)
                        if resize_data.get('type') == 'resize':
                            cols = resize_data.get('cols', 80)
                            rows = resize_data.get('rows', 24)
                            print(f"Resize request: {cols}x{rows}")
                            
                            # Implement terminal resize with TIOCSWINSZ
                            if master_fd is not None and platform.system() != "Windows":
                                import struct
                                import termios
                                import fcntl
                                winsize = struct.pack('HHHH', rows, cols, 0, 0)
                                fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                            continue
                    except (json.JSONDecodeError, KeyError):
                        pass
                    
                    # Write data to PTY master or process stdin
                    try:
                        if master_fd is not None:
                            # Writing to PTY
                            os.write(master_fd, data.encode('utf-8'))
                        else:
                            # Windows: write to process stdin
                            process.stdin.write(data)
                            process.stdin.flush()
                    except Exception as e:
                        print(f"Error writing to process: {e}")
                        break
            except WebSocketDisconnect:
                print("WebSocket disconnected during write")
            except Exception as e:
                print(f"Error writing to process: {e}")
        
        # Run both tasks concurrently
        try:
            await asyncio.gather(
                read_from_process(),
                write_to_process(),
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
            if 'master_fd' in locals() and master_fd is not None:
                os.close(master_fd)
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
    """Cleanup project files"""
    try:
        # Remove from active processes if it exists
        if project_id in active_processes:
            del active_processes[project_id]
        
        # Clean up project directory
        project_dir = SANDBOX_BASE / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)
        
        return {"status": "deleted", "project_id": project_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

@app.get("/api/projects/{project_id}/status")
async def get_project_status(project_id: str):
    """Get project status"""
    project_dir = SANDBOX_BASE / project_id
    workspace_dir = project_dir / "workspace"
    
    status = {
        "project_id": project_id,
        "workspace_exists": workspace_dir.exists(),
        "container_running": project_id in active_processes,
        "container_id": active_processes.get(project_id)
    }
    
    return status

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
