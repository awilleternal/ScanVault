import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

/**
 * Service for bridging with WSL2 to run Linux-based security tools
 */
export class WSL2Bridge {
  constructor() {
    this.isWSL2Available = null;
    this.timeout = parseInt(process.env.SCAN_TIMEOUT || '300000'); // 5 minutes default
  }

  /**
   * Check if WSL2 is available on the system
   * @returns {Promise<boolean>} True if WSL2 is available
   */
  async isAvailable() {
    if (this.isWSL2Available !== null) {
      return this.isWSL2Available;
    }

    if (process.platform !== 'win32') {
      this.isWSL2Available = false;
      return false;
    }

    try {
      const { stdout } = await execPromise('wsl --status', {
        timeout: 5000,
        encoding: 'utf8',
      });
      // Clean up the output (remove null bytes and normalize)
      const cleanOutput = stdout.replace(/\0/g, '').trim();
      console.log('WSL status output:', cleanOutput);

      this.isWSL2Available =
        cleanOutput.includes('Version: 2') ||
        cleanOutput.includes('WSL 2') ||
        cleanOutput.includes('Default Version: 2');
      console.log('WSL2 available:', this.isWSL2Available);
      return this.isWSL2Available;
    } catch (error) {
      console.log('WSL2 not available:', error.message);
      this.isWSL2Available = false;
      return false;
    }
  }

  /**
   * Convert Windows path to WSL path
   * @param {string} windowsPath - Windows file path
   * @returns {Promise<string>} WSL path
   */
  async convertToWSLPath(windowsPath) {
    try {
      console.log(`Converting Windows path to WSL: ${windowsPath}`);

      // Escape backslashes properly for WSL
      const escapedPath = windowsPath.replace(/\\/g, '\\\\');
      const { stdout } = await execPromise(`wsl wslpath "${escapedPath}"`);
      const wslPath = stdout.trim();

      console.log(
        `WSL path conversion successful: ${windowsPath} -> ${wslPath}`
      );
      return wslPath;
    } catch (error) {
      console.log(
        `WSL path conversion failed, using fallback: ${error.message}`
      );

      // Fallback: manually convert Windows path to WSL format
      const drive = windowsPath.charAt(0).toLowerCase();
      const restPath = windowsPath.substring(3).replace(/\\/g, '/');
      const fallbackPath = `/mnt/${drive}/${restPath}`;

      console.log(`Fallback WSL path: ${windowsPath} -> ${fallbackPath}`);
      return fallbackPath;
    }
  }

  /**
   * Run Semgrep security scanner
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runSemgrep(targetPath) {
    if (!(await this.isAvailable())) {
      throw new Error('WSL2 is not available');
    }

    try {
      // Convert Windows path to WSL path
      const wslPath = await this.convertToWSLPath(targetPath);

      // Build Semgrep command
      const args = [
        'semgrep',
        '--config=auto',
        '--json',
        '--no-git-ignore',
        '--timeout=60',
        wslPath,
      ];

      const result = await this.executeCommand('wsl', args);

      // Parse Semgrep JSON output
      return this.parseSemgrepOutput(result);
    } catch (error) {
      console.error('Semgrep execution failed:', error);
      // Return empty results on error rather than throwing
      return [];
    }
  }

  /**
   * Run Trivy vulnerability scanner
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runTrivy(targetPath) {
    if (!(await this.isAvailable())) {
      throw new Error('WSL2 is not available');
    }

    try {
      // Convert Windows path to WSL path
      const wslPath = await this.convertToWSLPath(targetPath);

      // Build Trivy command
      const args = [
        'trivy',
        'fs',
        '--format',
        'json',
        '--severity',
        'CRITICAL,HIGH,MEDIUM,LOW',
        '--timeout',
        '5m',
        wslPath,
      ];

      const result = await this.executeCommand('wsl', args);

      // Parse Trivy JSON output
      return this.parseTrivyOutput(result);
    } catch (error) {
      console.error('Trivy execution failed:', error);
      // Return empty results on error rather than throwing
      return [];
    }
  }

  /**
   * Execute a command with timeout
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
        shell: false,
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
          // Some tools return non-zero exit codes even on success
          // Check if we have output before rejecting
          if (output) {
            resolve(output);
          } else {
            reject(
              new Error(`Command failed with code ${code}: ${errorOutput}`)
            );
          }
        }
      });
    });
  }

  /**
   * Parse Semgrep JSON output
   * @param {string} output - Semgrep JSON output
   * @returns {Array} Parsed results
   */
  parseSemgrepOutput(output) {
    try {
      const data = JSON.parse(output);
      const results = [];

      if (data.results) {
        data.results.forEach((result) => {
          // Extract relative path (remove WSL mount prefix)
          const filePath = result.path
            .replace(/^\/mnt\/[a-z]\//, '')
            .replace(/\//g, '\\');

          results.push({
            id: result.check_id || result.fingerprint,
            tool: 'Semgrep',
            severity: this.mapSemgrepSeverity(result.severity || 'INFO'),
            type:
              result.extra?.metadata?.category ||
              result.check_id?.split('.').pop() ||
              'Security Issue',
            file: filePath,
            line: result.start?.line || 0,
            description:
              result.extra?.message || result.message || result.check_id,
            fix: this.generateSemgrepFix(result),
            references: result.extra?.metadata?.references || [],
            confidence: result.extra?.metadata?.confidence || 'MEDIUM',
            impact: result.extra?.metadata?.impact || 'MEDIUM',
            cwe: result.extra?.metadata?.cwe || [],
            owasp: result.extra?.metadata?.owasp || [],
          });
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to parse Semgrep output:', error);
      console.error('Raw output:', output);
      return [];
    }
  }

  /**
   * Parse Trivy JSON output
   * @param {string} output - Trivy JSON output
   * @returns {Array} Parsed results
   */
  parseTrivyOutput(output) {
    try {
      const data = JSON.parse(output);
      const results = [];

      if (data.Results) {
        data.Results.forEach((target) => {
          if (target.Vulnerabilities) {
            target.Vulnerabilities.forEach((vuln) => {
              // Extract relative path (remove WSL mount prefix)
              const filePath = target.Target.replace(
                /^\/mnt\/[a-z]\//,
                ''
              ).replace(/\//g, '\\');

              results.push({
                id: vuln.VulnerabilityID,
                tool: 'Trivy',
                severity: vuln.Severity?.toUpperCase() || 'INFO',
                type: 'Vulnerable Dependency',
                file: filePath,
                line: 0, // Trivy doesn't provide line numbers
                description:
                  vuln.Description || vuln.Title || vuln.VulnerabilityID,
                fix: this.generateTrivyFix(vuln),
                references: vuln.References || [],
                pkgName: vuln.PkgName,
                installedVersion: vuln.InstalledVersion,
                fixedVersion: vuln.FixedVersion,
                cvss: vuln.CVSS,
                cweIDs: vuln.CweIDs || [],
              });
            });
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to parse Trivy output:', error);
      console.error('Raw output:', output);
      return [];
    }
  }

  /**
   * Map Semgrep severity to standard severity levels
   * @param {string} severity - Semgrep severity
   * @returns {string} Mapped severity
   */
  mapSemgrepSeverity(severity) {
    const severityMap = {
      ERROR: 'CRITICAL',
      CRITICAL: 'CRITICAL',
      WARNING: 'HIGH',
      HIGH: 'HIGH',
      INFO: 'MEDIUM',
      MEDIUM: 'MEDIUM',
      INVENTORY: 'LOW',
      LOW: 'LOW',
      EXPERIMENTAL: 'INFO',
    };

    return severityMap[severity.toUpperCase()] || 'INFO';
  }

  /**
   * Generate fix suggestion for Semgrep findings
   * @param {Object} result - Semgrep result object
   * @returns {string} Fix suggestion
   */
  generateSemgrepFix(result) {
    const checkId = result.check_id || '';

    // Generate specific fixes based on rule type
    if (checkId.includes('sql-injection')) {
      return 'Use parameterized queries or prepared statements instead of string concatenation';
    } else if (checkId.includes('xss')) {
      return 'Sanitize user input and use proper escaping functions';
    } else if (checkId.includes('eval')) {
      return 'Avoid using eval(). Use safer alternatives like JSON.parse() for data';
    } else if (checkId.includes('command-injection')) {
      return 'Use spawn() with argument arrays instead of exec() with strings';
    } else if (checkId.includes('csrf')) {
      return 'Implement CSRF protection middleware like csurf';
    } else if (checkId.includes('hardcoded')) {
      return 'Move sensitive data to environment variables or secure configuration';
    }

    return (
      result.extra?.metadata?.fix ||
      'Review and fix the identified security issue'
    );
  }

  /**
   * Generate fix suggestion for Trivy findings
   * @param {Object} vuln - Trivy vulnerability object
   * @returns {string} Fix suggestion
   */
  generateTrivyFix(vuln) {
    if (vuln.FixedVersion) {
      return `Update ${vuln.PkgName} from ${vuln.InstalledVersion} to ${vuln.FixedVersion} or later`;
    } else if (vuln.Status === 'will_not_fix') {
      return `No fix available for ${vuln.PkgName}. Consider using an alternative package`;
    } else {
      return `Update ${vuln.PkgName} to the latest version to resolve security issues`;
    }
  }
}
