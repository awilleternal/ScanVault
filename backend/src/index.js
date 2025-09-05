import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

// Import routes
import uploadRoutes from './routes/upload.js';
import scanRoutes from './routes/scan.js';

// Import services
import { ScanOrchestrator } from './services/scanOrchestrator.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configure comprehensive logger with file rotation
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [APP-${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ 
      filename: 'logs/app-error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/app-combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ],
});

// Ensure logs directory exists
import fs from 'fs';
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
  logger.info('📁 Created logs directory');
}

// Initialize Express app
const app = express();
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Store active WebSocket connections
const wsClients = new Map();

// Configure middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Increase timeout for large file uploads
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000); // 2 minutes
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api', uploadRoutes);
app.use('/api/scan', scanRoutes);

// WebSocket connection handling with detailed logging
wss.on('connection', (ws, req) => {
  const connectionStart = Date.now();
  // Extract scanId from URL path like /ws/scanId
  const urlParts = req.url.split('/');
  const scanId = urlParts[urlParts.length - 1];
  const clientIp = req.socket.remoteAddress;

  logger.info('🔌 WebSocket client connected', {
    scanId,
    clientIp,
    userAgent: req.headers['user-agent'],
    url: req.url,
    connectionTime: new Date().toISOString()
  });

  wsClients.set(scanId, ws);

  ws.on('close', (code, reason) => {
    const sessionDuration = Date.now() - connectionStart;
    logger.info('🔌 WebSocket client disconnected', {
      scanId,
      sessionDurationMs: sessionDuration,
      closeCode: code,
      closeReason: reason?.toString()
    });
    wsClients.delete(scanId);
  });

  ws.on('error', (error) => {
    const sessionDuration = Date.now() - connectionStart;
    logger.error('❌ WebSocket error', {
      scanId,
      error: error.message,
      sessionDurationMs: sessionDuration,
      readyState: ws.readyState
    });
  });

  ws.on('message', (data) => {
    logger.debug('📥 WebSocket message received from client', {
      scanId,
      messageSize: data.length,
      message: data.toString().substring(0, 100) // First 100 chars
    });
  });

  // Send connection confirmation
  const confirmationMessage = {
    type: 'connected',
    scanId: scanId,
    timestamp: new Date().toISOString(),
    serverInfo: {
      version: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version
    }
  };
  
  ws.send(JSON.stringify(confirmationMessage));
  
  logger.debug('📤 Connection confirmation sent', {
    scanId,
    messageSize: JSON.stringify(confirmationMessage).length
  });
});

// Make WebSocket clients available to scan orchestrator
app.locals.wsClients = wsClients;

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(isDevelopment && { stack: err.stack }),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Resource not found',
    },
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server available at ws://localhost:${PORT}/ws`);
});
