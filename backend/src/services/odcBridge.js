import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for running OWASP Dependency Check on Windows (following WSL2Bridge pattern)
 */
export class ODCBridge {
  constructor() {
    this.isODCAvailable = null;
    this.timeout = parseInt(process.env.SCAN_TIMEOUT || '300000'); // 5 minutes default (same as WSL2)
    this.odcPath = process.env.ODC_PATH || 'dependency-check.bat'; // Allow custom ODC path
  }

  /**
   * Check if ODC is available on the system
   * @returns {Promise<boolean>} True if ODC is available
   */
  async isAvailable() {
    if (this.isODCAvailable !== null) {
      return this.isODCAvailable;
    }

    if (process.platform !== 'win32') {
      this.isODCAvailable = false;
      return false;
    }

    try {
      // Test if ODC is accessible
      const result = await this.executeCommand(this.odcPath, ['--version']);
      this.isODCAvailable = result.toLowerCase().includes('dependency-check');
      console.warn('ODC available:', this.isODCAvailable);
      return this.isODCAvailable;
    } catch (error) {
      console.warn('ODC not available:', error.message);
      this.isODCAvailable = false;
      return false;
    }
  }

  /**
   * Run OWASP Dependency Check scanner
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runODC(targetPath) {
    if (!await this.isAvailable()) {
      throw new Error('ODC is not available');
    }

    try {
      console.log(`ODC scanning target path: ${targetPath}`);
      
      // Validate target path exists
      if (!fs.existsSync(targetPath)) {
        throw new Error(`Target path does not exist: ${targetPath}`);
      }
      
      // Create temporary output directory
      const tempDir = path.join(process.env.TEMP || 'temp', `odc-${Date.now()}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      console.log(`ODC output directory: ${tempDir}`);

      // Build ODC command
      const projectName = path.basename(targetPath) || 'SecurityScan';
      const args = [
        '--project', projectName,
        '--scan', targetPath,
        '--out', tempDir,
        '--format', 'JSON',
        '--enableRetired'
      ];
      
      console.log(`ODC command args: ${args.join(' ')}`);

      // Add NVD API key if available (like your WSL2 pattern)
      if (process.env.ODC_NVD_API_KEY) {
        args.push('--nvdApiKey', process.env.ODC_NVD_API_KEY);
      }

      await this.executeCommand(this.odcPath, args);
      
      // Parse ODC JSON output
      const results = this.parseODCOutput(tempDir);
      
      // Clean up temp directory
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup temp directory:', cleanupError);
      }
      
      return results;
    } catch (error) {
      console.error('ODC execution failed:', error);
      // Return empty results on error rather than throwing (matches WSL2Bridge pattern)
      return [];
    }
  }

  /**
   * Execute a command with timeout (following WSL2Bridge.executeCommand pattern)
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @returns {Promise<string>} Command output
   */
  executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let timedOut = false;

      const process = spawn(command, args, {
        shell: true, // Changed from false to true for Windows batch files
        windowsHide: true,
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        process.kill('SIGTERM');
        reject(new Error('Command timed out'));
      }, this.timeout);

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (timedOut) return;
        
        if (code === 0) {
          resolve(output);
        } else {
          // Some tools return non-zero exit codes even on success (matches WSL2Bridge)
          if (output) {
            resolve(output);
          } else {
            reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
          }
        }
      });
    });
  }

  /**
   * Parse ODC JSON output (following the parseXXXOutput pattern from WSL2Bridge)
   * @param {string} outputDir - Directory containing ODC output
   * @returns {Array} Parsed results matching your existing structure
   */
  parseODCOutput(outputDir) {
    try {
      const jsonFile = path.join(outputDir, 'dependency-check-report.json');
      
      if (!fs.existsSync(jsonFile)) {
        console.warn('ODC JSON report not found');
        return [];
      }

      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      const results = [];

      if (data.dependencies) {
        data.dependencies.forEach(dependency => {
          if (dependency.vulnerabilities) {
            dependency.vulnerabilities.forEach(vuln => {
              results.push({
                id: vuln.name || uuidv4(),
                tool: 'OWASP Dependency Check', // Exact match to existing mock
                severity: this.mapODCSeverity(vuln.severity),
                type: 'Vulnerable Dependency',
                file: dependency.fileName || 'Unknown',
                line: 0, // ODC doesn't provide line numbers (like Trivy)
                description: vuln.description || vuln.name,
                fix: this.generateODCFix(dependency, vuln),
                references: vuln.references?.map(ref => ref.url || ref.name) || [],
              });
            });
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to parse ODC output:', error);
      return [];
    }
  }

  /**
   * Map ODC severity to standard severity levels (following WSL2Bridge pattern)
   * @param {string} severity - ODC severity
   * @returns {string} Mapped severity
   */
  mapODCSeverity(severity) {
    if (!severity) return 'LOW';
    
    const severityMap = {
      'CRITICAL': 'CRITICAL',
      'HIGH': 'HIGH',
      'MEDIUM': 'MEDIUM', 
      'LOW': 'LOW',
      'INFO': 'LOW',
      'INFORMATIONAL': 'LOW'
    };
    
    return severityMap[severity.toUpperCase()] || 'LOW';
  }

  /**
   * Generate fix suggestion for ODC findings (following WSL2Bridge pattern)
   * @param {Object} dependency - Dependency object
   * @param {Object} vuln - Vulnerability object
   * @returns {string} Fix suggestion
   */
  generateODCFix(dependency, vuln) {
    return `Update ${dependency.fileName} to address ${vuln.name}. Check for newer versions or alternative packages.`;
  }
}
