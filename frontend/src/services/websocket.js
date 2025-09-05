/**
 * WebSocket service for real-time scan progress updates
 */
export class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.handlers = {};
  }

  /**
   * Connect to WebSocket server
   * @param {string} scanId - Scan ID for the WebSocket connection
   * @param {Object} handlers - Event handlers
   */
  connect(scanId, handlers = {}) {
    this.handlers = handlers;
    
    try {
      const wsUrl = `ws://localhost:5000/ws/${scanId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        if (this.handlers.onOpen) {
          this.handlers.onOpen();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (this.handlers.onMessage) {
            this.handlers.onMessage(data);
          }
          
          // Handle different message types
          switch (data.type) {
            case 'progress':
              if (this.handlers.onProgress) {
                this.handlers.onProgress(data);
              }
              break;
            case 'vulnerability':
              // Handle real-time vulnerability discovery
              if (this.handlers.onVulnerability) {
                this.handlers.onVulnerability(data);
              }
              break;
            case 'complete':
              if (this.handlers.onComplete) {
                this.handlers.onComplete(data);
              }
              break;
            case 'error':
              if (this.handlers.onError) {
                this.handlers.onError(data);
              }
              break;
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.handlers.onError) {
          this.handlers.onError(error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        if (this.handlers.onClose) {
          this.handlers.onClose(event);
        }

        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect(scanId);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      if (this.handlers.onError) {
        this.handlers.onError(error);
      }
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   * @param {string} scanId - Scan ID
   */
  attemptReconnect(scanId) {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting WebSocket reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect(scanId, this.handlers);
      }
    }, delay);
  }

  /**
   * Send message to WebSocket server
   * @param {Object} message - Message to send
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not open, cannot send message');
    }
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
