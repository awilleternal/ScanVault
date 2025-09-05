import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // Increased to 2 minutes for large file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens or other headers
api.interceptors.request.use(
  (config) =>
    // Add auth token if available
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    config,
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const message =
        error.response.data?.error?.message || 'An error occurred';
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

/**
 * Upload a file to the server
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Upload response with file ID
 */
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onProgress) {
        onProgress(percentCompleted);
      }
    },
  });

  return response;
};

/**
 * Upload a folder with multiple files
 * @param {FileList} files - The files from a folder
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Upload response with folder ID
 */
export const uploadFolder = async (files, onProgress) => {
  const formData = new FormData();

  // Add all files to form data preserving their structure
  Array.from(files).forEach((file) => {
    // Just append the file directly - multer will handle the originalname
    formData.append('files', file);
  });

  const response = await api.post('/upload-folder', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onProgress) {
        onProgress(percentCompleted);
      }
    },
  });

  return response;
};

/**
 * Scan a folder directly from its path without uploading
 * @param {string} folderPath - The absolute path to the folder
 * @returns {Promise<Object>} Scan response with folder ID
 */
export const scanFolderPath = async (folderPath) => {
  const response = await api.post('/scan-folder-path', { folderPath });
  return response;
};

/**
 * Clone a repository from URL
 * @param {string} repositoryUrl - The repository URL
 * @returns {Promise<Object>} Clone response with repository ID
 */
export const cloneRepository = async (repositoryUrl) => {
  const response = await api.post('/clone', { repositoryUrl });
  return response;
};

/**
 * Start a security scan
 * @param {string} targetId - The upload or clone ID
 * @param {string[]} selectedTools - Array of selected security tools
 * @returns {Promise<Object>} Scan response with scan ID and WebSocket URL
 */
export const startScan = async (targetId, selectedTools) => {
  console.log('🔥 [API] Making scan request with:', { targetId, selectedTools });
  const response = await api.post('/scan', {
    targetId,
    selectedTools,
  });
  console.log('🔥 [API] Scan response received:', response);
  return response;
};

/**
 * Get scan results
 * @param {string} scanId - The scan ID
 * @returns {Promise<Object>} Scan results
 */
export const getScanResults = async (scanId) => {
  const response = await api.get(`/scan/${scanId}/results`);
  return response;
};

/**
 * Download scan report
 * @param {string} scanId - The scan ID
 * @param {string} format - Report format (json or pdf)
 * @returns {Promise<Blob>} Report file blob
 */
export const downloadReport = async (scanId, format) => {
  try {
    // Use axios directly without the interceptor for blob responses
    const response = await axios.get(`/api/scan/${scanId}/report/${format}`, {
      responseType: 'blob',
    });

    // Create download link - response.data is the actual Blob
    const blob = response.data;

    // Verify we have a valid blob
    if (!(blob instanceof Blob)) {
      throw new Error('Response is not a valid blob');
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `security-scan-${scanId}-${new Date().toISOString().split('T')[0]}.${format}`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return blob;
  } catch (error) {
    console.error('Download failed:', error);
    // Re-throw with more context for frontend error handling
    throw new Error(
      `Failed to download ${format.toUpperCase()} report: ${error.response?.data?.error?.message || error.message}`
    );
  }
};

/**
 * Create WebSocket connection for scan progress
 * @param {string} scanId - The scan ID
 * @param {Object} handlers - Event handlers
 * @returns {WebSocket} WebSocket instance
 */
export const createWebSocketConnection = (scanId, handlers) => {
  const wsUrl = `ws://localhost:5000/ws/${scanId}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    if (handlers.onOpen) handlers.onOpen();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (handlers.onMessage) handlers.onMessage(data);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (handlers.onError) handlers.onError(error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    if (handlers.onClose) handlers.onClose();
  };

  return ws;
};

export default api;
