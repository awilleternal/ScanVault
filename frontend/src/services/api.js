import axios from 'axios';

// Performance logging utility
const apiLogger = {
  log: (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...data
    };
    console.log(`[API-${level.toUpperCase()}] ${timestamp} ${message}`, logData);
  },
  info: (message, data) => apiLogger.log('info', message, data),
  warn: (message, data) => apiLogger.log('warn', message, data),
  error: (message, data) => apiLogger.log('error', message, data),
  debug: (message, data) => apiLogger.log('debug', message, data)
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // Increased to 2 minutes for large file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

apiLogger.info('🚀 API service initialized', {
  baseURL: '/api',
  timeout: 120000
});

// Request interceptor for auth tokens or other headers
api.interceptors.request.use(
  (config) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    config.metadata = { startTime: Date.now(), requestId };
    
    apiLogger.debug('📤 API Request starting', {
      requestId,
      method: config.method?.toUpperCase(),
      url: config.url,
      timeout: config.timeout,
      hasData: !!config.data,
      dataSize: config.data ? JSON.stringify(config.data).length : 0
    });
    
    // Add auth token if available
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    apiLogger.error('❌ Request interceptor error', { error: error.message });
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    const { requestId, startTime } = response.config.metadata || {};
    const duration = startTime ? Date.now() - startTime : null;
    
    apiLogger.info('📥 API Response received', {
      requestId,
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      statusText: response.statusText,
      duration,
      responseSize: JSON.stringify(response.data).length
    });
    
    return response.data;
  },
  (error) => {
    const { requestId, startTime } = error.config?.metadata || {};
    const duration = startTime ? Date.now() - startTime : null;
    
    let errorDetails = {
      requestId,
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      duration
    };

    if (error.response) {
      // Server responded with error status
      errorDetails = {
        ...errorDetails,
        status: error.response.status,
        statusText: error.response.statusText,
        responseData: error.response.data
      };
      
      apiLogger.error('❌ API Response error (server)', errorDetails);
      
      const message =
        error.response.data?.error?.message || 'An error occurred';
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      errorDetails = {
        ...errorDetails,
        requestTimeout: error.code === 'ECONNABORTED',
        networkError: true
      };
      
      apiLogger.error('❌ API Request error (network)', errorDetails);
      throw new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      errorDetails = {
        ...errorDetails,
        errorMessage: error.message
      };
      
      apiLogger.error('❌ API Request error (other)', errorDetails);
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
  const functionStart = Date.now();
  const requestData = { targetId, selectedTools };
  
  apiLogger.info('🚀 Starting scan request', {
    targetId,
    selectedTools,
    toolCount: selectedTools.length,
    requestDataSize: JSON.stringify(requestData).length
  });
  
  try {
    const response = await api.post('/scan', requestData);
    const functionDuration = Date.now() - functionStart;
    
    apiLogger.info('✅ Scan request successful', {
      targetId,
      scanId: response.scanId,
      functionDuration,
      response
    });
    
    return response;
  } catch (error) {
    const functionDuration = Date.now() - functionStart;
    
    apiLogger.error('❌ Scan request failed', {
      targetId,
      selectedTools,
      functionDuration,
      error: error.message
    });
    
    throw error;
  }
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
  const connectionStart = Date.now();
  
  apiLogger.info('🔌 Creating WebSocket connection', {
    scanId,
    wsUrl,
    hasHandlers: {
      onOpen: !!handlers.onOpen,
      onMessage: !!handlers.onMessage,
      onError: !!handlers.onError,
      onClose: !!handlers.onClose
    }
  });
  
  const ws = new WebSocket(wsUrl);
  let messageCount = 0;
  let bytesReceived = 0;

  ws.onopen = () => {
    const connectionTime = Date.now() - connectionStart;
    apiLogger.info('✅ WebSocket connected', {
      scanId,
      connectionTimeMs: connectionTime
    });
    if (handlers.onOpen) handlers.onOpen();
  };

  ws.onmessage = (event) => {
    messageCount++;
    bytesReceived += event.data.length;
    
    try {
      const data = JSON.parse(event.data);
      apiLogger.debug('📥 WebSocket message received', {
        scanId,
        messageCount,
        bytesReceived,
        messageType: data.type,
        messageSize: event.data.length,
        timestamp: data.timestamp
      });
      
      if (handlers.onMessage) handlers.onMessage(data);
    } catch (error) {
      apiLogger.error('❌ Failed to parse WebSocket message', {
        scanId,
        error: error.message,
        rawMessage: event.data.substring(0, 100),
        messageSize: event.data.length
      });
    }
  };

  ws.onerror = (error) => {
    apiLogger.error('❌ WebSocket error', {
      scanId,
      error: error.message || 'Unknown WebSocket error',
      readyState: ws.readyState,
      messagesReceived: messageCount,
      totalBytesReceived: bytesReceived
    });
    if (handlers.onError) handlers.onError(error);
  };

  ws.onclose = (event) => {
    const sessionDuration = Date.now() - connectionStart;
    apiLogger.info('🔌 WebSocket disconnected', {
      scanId,
      sessionDurationMs: sessionDuration,
      closeCode: event.code,
      closeReason: event.reason,
      wasClean: event.wasClean,
      messagesReceived: messageCount,
      totalBytesReceived: bytesReceived
    });
    if (handlers.onClose) handlers.onClose();
  };

  return ws;
};

export default api;
