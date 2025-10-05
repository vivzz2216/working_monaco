import React, { useState, useRef } from 'react';
import MonacoEditor from './components/MonacoEditor';
import TerminalComponent from './components/Terminal';
import FileExplorer from './components/FileExplorer';
import { 
  createProject, 
  uploadProject, 
  startContainer, 
  deleteProject, 
  getProjectStatus,
  readFile,
  writeFile
} from './api';

function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [projectStatus, setProjectStatus] = useState('idle'); // idle, uploading, starting, ready, error
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [containerId, setContainerId] = useState(null);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const fileInputRef = useRef(null);

  const handleCreateProject = async () => {
    try {
      console.log('Creating project...');
      setError(null);
      setProjectStatus('creating');
      console.log('Calling createProject API...');
      const project = await createProject();
      console.log('Project created:', project);
      setCurrentProject(project);
      setProjectStatus('ready');
      console.log('Project setup complete');
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project: ' + error.message);
      setProjectStatus('error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentProject) return;

    try {
      setError(null);
      setProjectStatus('uploading');
      console.log('Uploading file:', file.name, 'to project:', currentProject.project_id);
      const result = await uploadProject(currentProject.project_id, file);
      console.log('Upload result:', result);
      setProjectStatus('ready');
      // Trigger file explorer refresh
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload project: ' + error.message);
      setProjectStatus('error');
    }
  };

  const handleStartContainer = async () => {
    if (!currentProject) return;

    try {
      setError(null);
      setProjectStatus('starting');
      console.log('Starting container for project:', currentProject.project_id);
      const result = await startContainer(currentProject.project_id);
      console.log('Container started:', result);
      setContainerId(result.container_id);
      setProjectStatus('ready');
      console.log('Container ready, terminal should be available');
    } catch (error) {
      console.error('Failed to start container:', error);
      setError('Failed to start container: ' + error.message);
      setProjectStatus('error');
    }
  };

  const handleFileSelect = async (filePath) => {
    if (!currentProject || !filePath) return;

    try {
      console.log('Reading file:', filePath);
      setSelectedFile(filePath);
      const response = await readFile(currentProject.project_id, filePath);
      console.log('File content received:', response);
      setFileContent(response.content);
    } catch (error) {
      console.error('Error reading file:', error);
      setError('Failed to read file: ' + error.message);
      setFileContent(''); // Clear content on error
    }
  };

  const handleFileSave = async (content) => {
    if (!currentProject || !selectedFile) return;

    try {
      await writeFile(currentProject.project_id, selectedFile, content);
      setFileContent(content);
    } catch (error) {
      console.error('Error saving file:', error);
      setError('Failed to save file: ' + error.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;

    try {
      await deleteProject(currentProject.project_id);
      setCurrentProject(null);
      setProjectStatus('idle');
      setSelectedFile(null);
      setFileContent('');
      setContainerId(null);
      setError(null);
    } catch (error) {
      setError('Failed to delete project: ' + error.message);
    }
  };

  const getStatusMessage = () => {
    switch (projectStatus) {
      case 'creating':
        return 'Creating project...';
      case 'uploading':
        return 'Uploading and extracting files...';
      case 'starting':
        return 'Starting container and setting up environment...';
      case 'ready':
        return 'Ready to code!';
      case 'error':
        return 'Error occurred';
      default:
        return 'Create a new project to get started';
    }
  };

  const getStatusColor = () => {
    switch (projectStatus) {
      case 'creating':
      case 'uploading':
      case 'starting':
        return 'text-yellow-400';
      case 'ready':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-ide-text';
    }
  };

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-ide-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-ide-text mb-8">
            Web IDE Python
          </h1>
          <p className="text-ide-text mb-8 max-w-md">
            Create a temporary online Python workspace with a real terminal, 
            Monaco Editor, and ephemeral virtual environments.
          </p>
          <button
            onClick={handleCreateProject}
            className="bg-ide-accent hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Virtual Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-ide-bg flex flex-col">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileUpload}
        className="hidden"
      />
      {/* Header */}
      <div className="h-12 bg-ide-sidebar border-b border-ide-border flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-ide-text font-medium">Web IDE Python</h1>
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusMessage()}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {projectStatus === 'ready' && (
            <button
              onClick={() => {
                console.log('Upload button clicked, fileInputRef:', fileInputRef.current);
                fileInputRef.current?.click();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
            >
              Upload ZIP
            </button>
          )}
          {projectStatus === 'ready' && !containerId && (
            <button
              onClick={handleStartContainer}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
            >
              Start Container
            </button>
          )}
          <button
            onClick={handleDeleteProject}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 border-b border-red-700 px-4 py-2">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-64 flex-shrink-0">
          <FileExplorer
            projectId={currentProject.project_id}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Editor and Terminal */}
        <div className="flex-1 flex flex-col">
          {/* Editor */}
          <div className="flex-1 min-h-0">
            {selectedFile ? (
              <div className="h-full flex flex-col">
                <div className="h-8 bg-ide-sidebar border-b border-ide-border flex items-center px-4">
                  <span className="text-ide-text text-sm">
                    {selectedFile}
                  </span>
                </div>
                <div className="flex-1">
                  <MonacoEditor
                    value={fileContent}
                    onChange={handleFileSave}
                    language="python"
                    theme="vs-dark"
                    height="100%"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-ide-text text-lg mb-4">
                    Select a file from the explorer to start editing
                  </p>
                  <p className="text-ide-text text-sm opacity-70">
                    Python files will have syntax highlighting and IntelliSense
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Terminal */}
          {containerId && (
            <div className="h-80 border-t border-ide-border">
              <TerminalComponent
                containerId={containerId}
                isConnected={projectStatus === 'ready'}
              />
            </div>
          )}
          
          {/* Terminal Status Indicator */}
          {containerId && (
            <div className="bg-ide-sidebar border-t border-ide-border px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${projectStatus === 'ready' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-ide-text text-xs">
                  {projectStatus === 'ready' ? 'Terminal Ready' : 'Starting Terminal...'}
                </span>
                {containerId && (
                  <span className="text-ide-text text-xs ml-auto">
                    Container: {containerId.substring(0, 12)}...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
