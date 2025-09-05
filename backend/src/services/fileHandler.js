import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import StreamZip from 'node-stream-zip';
import simpleGit from 'simple-git';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for handling file uploads, ZIP extraction, and repository cloning
 */
export class FileHandlerService {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || path.join(__dirname, '../../../temp');
    this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
    // Initialize directories asynchronously
    this.initDirectories().catch(error => {
      console.error('Failed to initialize FileHandlerService:', error);
    });
  }

  /**
   * Initialize required directories
   */
  async initDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log('Directories initialized:', { tempDir: this.tempDir, uploadDir: this.uploadDir });
    } catch (error) {
      console.error('Failed to create directories:', error);
      throw error;
    }
  }

  /**
   * Extract a ZIP file
   * @param {string} zipPath - Path to the ZIP file
   * @returns {Promise<Object>} Extraction result with ID and path
   */
  async extractZip(zipPath) {
    const extractId = uuidv4();
    const extractPath = path.join(this.tempDir, extractId);

    try {
      console.log(`Starting extraction - ID: ${extractId}, Path: ${extractPath}`);
      
      // Create extraction directory
      await fs.mkdir(extractPath, { recursive: true });

      // Extract ZIP file with security options disabled for testing
      console.log('Opening ZIP file:', zipPath);
      const zip = new StreamZip.async({ 
        file: zipPath,
        storeEntries: true,
        skipEntryNameValidation: true
      });
      
      // Validate ZIP file
      console.log('Checking ZIP entries...');
      const entriesCount = await zip.entriesCount;
      console.log(`ZIP contains ${entriesCount} entries`);
      
      if (entriesCount === 0) {
        throw new Error('ZIP file is empty');
      }

      // Extract all files with manual validation instead of library restrictions
      console.log('Getting ZIP entries...');
      const entries = await zip.entries();
      console.log(`Processing ${Object.keys(entries).length} entries...`);
      
      let processedCount = 0;
      for (const entryName in entries) {
        const entry = entries[entryName];
        
        // Basic path traversal protection only
        if (entryName.includes('..') || path.isAbsolute(entryName)) {
          console.warn(`Skipping potentially dangerous path: ${entryName}`);
          continue;
        }
        
        // Extract the entry
        if (!entry.isDirectory) {
          const outputPath = path.join(extractPath, entryName);
          const outputDir = path.dirname(outputPath);
          
          // Ensure output directory exists
          await fs.mkdir(outputDir, { recursive: true });
          
          // Extract file
          const data = await zip.entryData(entryName);
          await fs.writeFile(outputPath, data);
        } else {
          // Create directory
          const dirPath = path.join(extractPath, entryName);
          await fs.mkdir(dirPath, { recursive: true });
        }
        
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`Processed ${processedCount} files...`);
        }
      }
      
      console.log(`Extraction completed: ${processedCount} files processed`);
      await zip.close();

      // Optionally delete the original ZIP file after extraction
      if (process.env.DELETE_AFTER_EXTRACT === 'true') {
        await fs.unlink(zipPath);
      }

      const result = {
        id: extractId,
        path: extractPath,
        fileCount: entriesCount,
      };
      
      console.log('Extraction result:', result);
      return result;
    } catch (error) {
      console.error('ZIP extraction error:', error);
      // Clean up on error
      try {
        await fs.rm(extractPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      throw new Error(`Failed to extract ZIP file: ${error.message}`);
    }
  }

  /**
   * Clone a repository from URL
   * @param {string} repositoryUrl - The repository URL
   * @returns {Promise<Object>} Clone result with ID and path
   */
  async cloneRepository(repositoryUrl) {
    const cloneId = uuidv4();
    const clonePath = path.join(this.tempDir, cloneId);

    try {
      // Extract repository name from URL
      const repoName = this.extractRepoName(repositoryUrl);

      // Initialize git client
      const git = simpleGit();

      // Clone the repository with timeout and Windows compatibility
      await git.clone(repositoryUrl, clonePath, {
        '--depth': 1, // Shallow clone for faster operation
        '--single-branch': true,
        '--config': 'core.longpaths=true', // Handle long paths on Windows
      });

      // Count files in the cloned repository
      const files = await this.countFiles(clonePath);

      return {
        id: cloneId,
        path: clonePath,
        name: repoName,
        fileCount: files,
      };
    } catch (error) {
      // Clean up on error
      try {
        await fs.rm(clonePath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Extract repository name from URL
   * @param {string} url - Repository URL
   * @returns {string} Repository name
   */
  extractRepoName(url) {
    // Remove .git extension if present
    const cleanUrl = url.replace(/\.git$/, '');
    // Extract the last part of the URL path
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1] || 'repository';
  }

  /**
   * Count files in a directory recursively
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} File count
   */
  async countFiles(dirPath) {
    let count = 0;
    
    async function countRecursive(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip .git directory
          if (entry.name !== '.git') {
            await countRecursive(fullPath);
          }
        } else {
          count++;
        }
      }
    }

    await countRecursive(dirPath);
    return count;
  }

  /**
   * Clean up a temporary directory
   * @param {string} targetPath - Path to clean up
   */
  async cleanup(targetPath) {
    try {
      // Validate that the path is within our temp directory
      const resolvedPath = path.resolve(targetPath);
      const resolvedTempDir = path.resolve(this.tempDir);
      
      if (!resolvedPath.startsWith(resolvedTempDir)) {
        throw new Error('Attempted to clean up path outside of temp directory');
      }

      await fs.rm(resolvedPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup directory:', error);
    }
  }

  /**
   * Process uploaded folder files
   * @param {Array} files - Array of uploaded files from multer
   * @returns {Promise<Object>} Processing result with ID and path
   */
  async processFolderUpload(files) {
    const folderId = uuidv4();
    const folderPath = path.join(this.tempDir, folderId);

    try {
      console.log(`Processing folder upload - ID: ${folderId}, Files: ${files.length}`);
      
      // Create folder directory
      await fs.mkdir(folderPath, { recursive: true });

      // Process each uploaded file and recreate folder structure
      for (const file of files) {
        // Get relative path - handle both regular files and folder structure
        let relativePath;
        if (file.originalname.includes('/') || file.originalname.includes('\\')) {
          // Already has path structure
          relativePath = file.originalname;
        } else {
          // Single file, use as-is
          relativePath = file.originalname;
        }
        
        // Sanitize the path to prevent directory traversal
        const safePath = relativePath.replace(/\.\./g, '').replace(/^[/\\]+/, '');
        const targetPath = path.join(folderPath, safePath);
        const targetDir = path.dirname(targetPath);
        
        console.log(`Processing file: ${file.originalname} -> ${safePath}`);
        
        // Ensure target directory exists
        await fs.mkdir(targetDir, { recursive: true });
        
        // Copy file from upload location to structured folder
        await fs.copyFile(file.path, targetPath);
        
        // Clean up original uploaded file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.warn('Failed to cleanup original file:', unlinkError);
        }
      }

      // Validate that the folder structure is suitable for scanning
      await this.validateFolderForScanning(folderPath);

      const result = {
        id: folderId,
        path: folderPath,
        fileCount: files.length,
      };
      
      console.log('Folder processing result:', result);
      return result;
    } catch (error) {
      console.error('Folder processing error:', error);
      
      // Clean up on error
      try {
        await fs.rm(folderPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      
      // Also clean up uploaded files
      for (const file of files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.warn('Failed to cleanup uploaded file:', unlinkError);
        }
      }
      
      throw new Error(`Failed to process folder upload: ${error.message}`);
    }
  }

  /**
   * Validate folder structure for vulnerability scanning
   * @param {string} folderPath - Path to the uploaded folder
   */
  async validateFolderForScanning(folderPath) {
    try {
      console.log('Validating folder structure for scanning:', folderPath);
      
      // Check if folder exists and is accessible
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error('Target is not a directory');
      }

      // Get folder contents recursively to validate structure
      const files = await this.getFileList(folderPath);
      console.log(`Folder contains ${files.length} files, ready for vulnerability scanning`);

      // Check for common project files that scanners can analyze
      const projectFiles = files.filter(file => {
        const fileName = path.basename(file).toLowerCase();
        return (
          fileName.includes('package.json') ||
          fileName.includes('pom.xml') ||
          fileName.includes('requirements.txt') ||
          fileName.includes('composer.json') ||
          fileName.includes('gradle.build') ||
          fileName.includes('gemfile') ||
          fileName.includes('go.mod') ||
          fileName.endsWith('.js') ||
          fileName.endsWith('.py') ||
          fileName.endsWith('.java') ||
          fileName.endsWith('.php') ||
          fileName.endsWith('.go') ||
          fileName.endsWith('.rb')
        );
      });

      if (projectFiles.length > 0) {
        console.log(`Found ${projectFiles.length} scannable files in uploaded folder`);
      } else {
        console.warn('No common project files found - scanners may have limited results');
      }

      return true;
    } catch (error) {
      console.error('Folder validation failed:', error);
      throw new Error(`Folder validation failed: ${error.message}`);
    }
  }

  /**
   * Get list of all files in directory recursively
   * @param {string} dirPath - Directory path
   * @returns {Promise<Array>} List of file paths
   */
  async getFileList(dirPath) {
    const files = [];
    
    async function traverse(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories and common ignore patterns
          if (!entry.name.startsWith('.') && 
              !['node_modules', '__pycache__', 'target', 'build', 'dist'].includes(entry.name)) {
            await traverse(fullPath);
          }
        } else {
          files.push(fullPath);
        }
      }
    }

    await traverse(dirPath);
    return files;
  }

  /**
   * Clean up old temporary files (older than 1 hour)
   */
  async cleanupOldFiles() {
    try {
      const entries = await fs.readdir(this.tempDir, { withFileTypes: true });
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.tempDir, entry.name);
          const stats = await fs.stat(dirPath);
          
          if (stats.mtimeMs < oneHourAgo) {
            await this.cleanup(dirPath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
    }
  }
}
