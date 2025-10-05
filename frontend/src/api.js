import axios from 'axios';

const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createProject = async () => {
  try {
    console.log('API: Creating project...');
    const response = await api.post('/api/projects', {}, {
      timeout: 10000 // 10 second timeout
    });
    console.log('API: Project creation response:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error creating project:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
};

export const uploadProject = async (projectId, file) => {
  try {
    console.log('Uploading file:', file.name, 'to project:', projectId);
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/api/projects/${projectId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('Upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading project:', error);
    throw error;
  }
};

export const startContainer = async (projectId) => {
  try {
    const response = await api.post(`/api/projects/${projectId}/start`);
    return response.data;
  } catch (error) {
    console.error('Error starting container:', error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const response = await api.delete(`/api/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
};

export const getProjectStatus = async (projectId) => {
  try {
    const response = await api.get(`/api/projects/${projectId}/status`);
    return response.data;
  } catch (error) {
    console.error('Error getting project status:', error);
    throw error;
  }
};

export const listFiles = async (projectId) => {
  try {
    console.log('Listing files for project:', projectId);
    const response = await api.get(`/api/projects/${projectId}/files`);
    console.log('Files response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

export const readFile = async (projectId, filePath) => {
  try {
    const response = await api.get(`/api/projects/${projectId}/files/${filePath}`);
    return response.data;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
};

export const writeFile = async (projectId, filePath, content) => {
  try {
    const response = await api.put(`/api/projects/${projectId}/files/${filePath}`, { content });
    return response.data;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
};

export const getWebSocketUrl = (containerId) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
  return `${wsProtocol}//${wsHost}/ws/term/${containerId}`;
};
