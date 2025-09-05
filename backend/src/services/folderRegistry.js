/**
 * Registry for mapping scan IDs to folder paths
 * This allows direct folder scanning without copying files
 * 
 * SCANNING BEHAVIOR:
 * - ZIP files: ALWAYS extracted to temp directory (copied)
 * - Repository clones: ALWAYS cloned to temp directory (copied)
 * - Folder uploads via /upload-folder: Files copied to temp directory
 * - Direct folder scans via /scan-folder-path: Files scanned in original location (NO copying)
 * 
 * This registry is ONLY used for direct folder scanning to map scan IDs to original paths
 */

class FolderRegistry {
  constructor() {
    this.mappings = new Map();
  }

  /**
   * Register a direct folder path with a scan ID
   * @param {string} scanId - Unique scan identifier
   * @param {string} folderPath - Absolute path to the folder
   */
  register(scanId, folderPath) {
    console.log(`Registering direct folder scan: ${scanId} -> ${folderPath}`);
    this.mappings.set(scanId, folderPath);
  }

  /**
   * Get the folder path for a scan ID
   * @param {string} scanId - Scan identifier
   * @returns {string|null} Folder path or null if not found
   */
  getPath(scanId) {
    return this.mappings.get(scanId) || null;
  }

  /**
   * Check if a scan ID is registered for direct scanning
   * @param {string} scanId - Scan identifier
   * @returns {boolean} True if registered
   */
  isDirectScan(scanId) {
    return this.mappings.has(scanId);
  }

  /**
   * Remove a mapping (cleanup after scan)
   * @param {string} scanId - Scan identifier
   */
  unregister(scanId) {
    this.mappings.delete(scanId);
  }

  /**
   * Get all registered mappings (for debugging)
   * @returns {Map} All mappings
   */
  getAllMappings() {
    return new Map(this.mappings);
  }
}

// Export singleton instance
export const folderRegistry = new FolderRegistry();
