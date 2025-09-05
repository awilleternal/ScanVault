import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { FileHandlerService } from '../services/fileHandler.js';
import { folderRegistry } from '../services/folderRegistry.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    try {
      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      console.error('Failed to create upload directory:', err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    // Store the relative path for folder uploads
    if (file.fieldname === 'files') {
      // For folder uploads, preserve some structure in filename
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._/-]/g, '_');
      cb(null, `${uniqueId}_${safeName}`);
    } else {
      cb(null, `${uniqueId}${ext}`);
    }
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'), false);
    }
  },
});

// Separate multer configuration for folder uploads (accepts all file types, no limits)
const folderUpload = multer({
  storage,
  limits: {
    fileSize: Infinity, // No file size limit
    files: Infinity, // No file count limit
    fieldSize: Infinity, // No field size limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for folder uploads
    cb(null, true);
  },
});

// Initialize file handler service
const fileHandler = new FileHandlerService();

/**
 * POST /api/upload
 * Upload a ZIP file for scanning
 * NOTE: ZIP files are ALWAYS extracted to temp directory (copied)
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No file uploaded',
        },
      });
    }

    console.log('File uploaded:', req.file);

    // Ensure directories are initialized
    await fileHandler.initDirectories();

    // Extract the ZIP file
    const extractResult = await fileHandler.extractZip(req.file.path);

    res.json({
      id: extractResult.id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadPath: req.file.path,
      extractedPath: extractResult.path,
      timestamp: new Date().toISOString(),
      type: 'zip',
      scanReady: true,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/clone
 * Clone a repository from URL
 * NOTE: Repositories are ALWAYS cloned to temp directory (copied)
 */
router.post('/clone', async (req, res, next) => {
  try {
    const { repositoryUrl } = req.body;

    if (!repositoryUrl) {
      return res.status(400).json({
        error: {
          message: 'Repository URL is required',
        },
      });
    }

    // Validate URL format
    try {
      new URL(repositoryUrl);
    } catch {
      return res.status(400).json({
        error: {
          message: 'Invalid repository URL format',
        },
      });
    }

    // Clone the repository
    console.log(`🔥 [CLONE] Starting repository clone for: ${repositoryUrl}`);
    const cloneResult = await fileHandler.cloneRepository(repositoryUrl);
    
    console.log(`🔥 [CLONE] Clone successful! Details:`);
    console.log(`🔥 [CLONE] - ID: ${cloneResult.id}`);
    console.log(`🔥 [CLONE] - Path: ${cloneResult.path}`);
    console.log(`🔥 [CLONE] - Name: ${cloneResult.name}`);
    console.log(`🔥 [CLONE] - File Count: ${cloneResult.fileCount}`);

    const response = {
      id: cloneResult.id,
      repositoryUrl,
      repositoryName: cloneResult.name,
      extractedPath: cloneResult.path,
      timestamp: new Date().toISOString(),
      type: 'repository',
      scanReady: true,
    };

    console.log(`🔥 [CLONE] Returning response to frontend:`, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload-folder
 * Upload multiple files from a folder structure
 * NOTE: This uploads and COPIES files to temp directory for scanning
 * For direct folder scanning without copying, use /api/scan-folder-path
 */
router.post(
  '/upload-folder',
  folderUpload.array('files'),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: {
            message: 'No files uploaded',
          },
        });
      }

      console.log(
        `Folder upload (with copying): ${req.files.length} files received`
      );
      console.log('First file details:', {
        originalname: req.files[0]?.originalname,
        filename: req.files[0]?.filename,
        mimetype: req.files[0]?.mimetype,
        size: req.files[0]?.size,
      });

      // Ensure directories are initialized
      await fileHandler.initDirectories();

      // Process the uploaded folder files (COPIES them to temp directory)
      const folderResult = await fileHandler.processFolderUpload(req.files);

      const response = {
        id: folderResult.id,
        fileCount: req.files.length,
        totalSize: req.files.reduce((sum, file) => sum + file.size, 0),
        extractedPath: folderResult.path,
        timestamp: new Date().toISOString(),
        type: 'folder-upload', // Changed to distinguish from direct scanning
        scanReady: true,
        copied: true, // Indicates files were copied to temp
      };

      console.log('Folder upload (copied) response:', response);
      res.json(response);
    } catch (error) {
      console.error('Folder upload route error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/scan-folder-path
 * Scan a folder directly from its original location WITHOUT copying files
 * This is ONLY for direct folder scanning - ZIP files and repos always use temp directory
 */
router.post('/scan-folder-path', async (req, res, next) => {
  try {
    const { folderPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({
        error: {
          message: 'Folder path is required',
        },
      });
    }

    console.log('Direct folder scan (NO COPYING) requested for:', folderPath);

    // Validate the folder path exists and is accessible
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          error: {
            message: 'Provided path is not a directory',
          },
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: {
          message: 'Folder path does not exist or is not accessible',
        },
      });
    }

    // Security check: Ensure path is absolute to prevent relative path attacks
    const absolutePath = path.resolve(folderPath);
    if (folderPath !== absolutePath) {
      console.log(`Normalized path: ${folderPath} -> ${absolutePath}`);
    }

    // Create a scan entry using the direct path
    const scanId = path.basename(absolutePath) + '-' + Date.now();

    // Register the direct folder path for scanning WITHOUT copying
    folderRegistry.register(scanId, absolutePath);

    // Validate folder for scanning
    await fileHandler.validateFolderForScanning(absolutePath);

    const response = {
      id: scanId,
      folderPath: absolutePath,
      directScan: true,
      scanReady: true,
      type: 'direct-folder-scan',
      timestamp: new Date().toISOString(),
      copied: false, // Explicitly indicate NO copying
    };

    console.log('Direct folder scan (NO COPYING) response:', response);
    res.json(response);
  } catch (error) {
    console.error('Direct folder scan error:', error);
    next(error);
  }
});

export default router;
