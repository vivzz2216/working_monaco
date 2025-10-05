import React, { useState, useEffect } from 'react';
import { listFiles, readFile } from '../api';

const FileExplorer = ({ projectId, onFileSelect, selectedFile, refreshTrigger }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  useEffect(() => {
    if (projectId) {
      loadFiles();
    }
  }, [projectId, refreshTrigger]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      console.log('Loading files for project:', projectId);
      const response = await listFiles(projectId);
      console.log('Files response:', response);
      setFiles(response.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (fileName, isDirectory) => {
    if (isDirectory) {
      return '📁';
    }
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return '🐍';
      case 'txt':
        return '📄';
      case 'md':
        return '📝';
      case 'json':
        return '📋';
      case 'yml':
      case 'yaml':
        return '⚙️';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'js':
      case 'jsx':
        return '📜';
      case 'ts':
      case 'tsx':
        return '📘';
      default:
        return '📄';
    }
  };

  const renderFileTree = (fileList, level = 0) => {
    return fileList.map((file) => (
      <div key={file.path}>
        <div
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-ide-border ${
            selectedFile === file.path ? 'bg-ide-accent bg-opacity-20' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (file.type === 'directory') {
              toggleFolder(file.path);
            } else {
              onFileSelect(file.path);
            }
          }}
        >
          <span className="mr-2">
            {file.type === 'directory' 
              ? (expandedFolders.has(file.path) ? '📂' : '📁')
              : getFileIcon(file.name, false)
            }
          </span>
          <span className="text-ide-text text-sm truncate">{file.name}</span>
        </div>
        {file.type === 'directory' && 
         expandedFolders.has(file.path) && 
         file.children && 
         renderFileTree(file.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-ide-sidebar flex items-center justify-center">
        <div className="text-ide-text">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-ide-sidebar border-r border-ide-border">
      <div className="h-8 bg-ide-sidebar border-b border-ide-border flex items-center px-4">
        <span className="text-ide-text text-sm font-medium">Explorer</span>
      </div>
      <div className="overflow-y-auto h-full">
        {files.length === 0 ? (
          <div className="p-4 text-ide-text text-sm text-center">
            No files found
          </div>
        ) : (
          renderFileTree(files)
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
