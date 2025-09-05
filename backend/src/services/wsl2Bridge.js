import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';

const execPromise = promisify(exec);

// Configure detailed logger for WSL operations
const wslLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [WSL2-${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/wsl-operations.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ],
});

/**
 * Service for bridging with WSL2 to run Linux-based security tools
 */
export class WSL2Bridge {
  constructor() {
    this.isWSL2Available = null;
    this.timeout = parseInt(process.env.SCAN_TIMEOUT || '300000'); // 5 minutes default
    this.pathCache = new Map(); // Cache for WSL path conversions
    this.isPreWarmed = false;
  }

  /**
   * Check if WSL2 is available on the system
   * @returns {Promise<boolean>} True if WSL2 is available
   */
  async isAvailable() {
    const startTime = Date.now();
    wslLogger.info('🔍 Checking WSL2 availability...');

    if (this.isWSL2Available !== null) {
      wslLogger.debug('📋 Using cached WSL2 availability status', { 
        cached: this.isWSL2Available,
        elapsedMs: Date.now() - startTime 
      });
      return this.isWSL2Available;
    }

    if (process.platform !== 'win32') {
      wslLogger.warn('❌ Not running on Windows platform', { 
        platform: process.platform,
        elapsedMs: Date.now() - startTime 
      });
      this.isWSL2Available = false;
      return false;
    }

    try {
      wslLogger.debug('⚡ Executing WSL status command...');
      const commandStart = Date.now();
      
      const { stdout } = await execPromise('wsl --status', {
        timeout: 5000,
        encoding: 'utf8',
      });
      
      const commandElapsed = Date.now() - commandStart;
      wslLogger.debug('⏱️ WSL status command completed', { 
        executionTimeMs: commandElapsed,
        stdoutLength: stdout.length 
      });

      // Clean up the output (remove null bytes and normalize)
      const cleanOutput = stdout.replace(/\0/g, '').trim();
      wslLogger.debug('📊 WSL status output processed', { 
        rawLength: stdout.length,
        cleanLength: cleanOutput.length,
        rawOutput: stdout.substring(0, 200),
        cleanOutput: cleanOutput.substring(0, 200)
      });

      this.isWSL2Available =
        cleanOutput.includes('Version: 2') ||
        cleanOutput.includes('WSL 2') ||
        cleanOutput.includes('Default Version: 2');
      
      const totalElapsed = Date.now() - startTime;
      wslLogger.info('✅ WSL2 availability check completed', { 
        available: this.isWSL2Available,
        totalTimeMs: totalElapsed,
        commandTimeMs: commandElapsed,
        detectionCriteria: {
          hasVersion2: cleanOutput.includes('Version: 2'),
          hasWSL2: cleanOutput.includes('WSL 2'),
          hasDefaultVersion2: cleanOutput.includes('Default Version: 2')
        }
      });
      
      return this.isWSL2Available;
    } catch (error) {
      const totalElapsed = Date.now() - startTime;
      wslLogger.error('❌ WSL2 availability check failed', { 
        error: error.message,
        errorCode: error.code,
        signal: error.signal,
        totalTimeMs: totalElapsed,
        timeout: error.code === 'ETIMEDOUT'
      });
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
    const startTime = Date.now();
    wslLogger.info('🔄 Converting Windows path to WSL path', { windowsPath });

    // Check cache first
    if (this.pathCache.has(windowsPath)) {
      const cachedPath = this.pathCache.get(windowsPath);
      const totalElapsed = Date.now() - startTime;
      wslLogger.debug('💾 Using cached WSL path', {
        windowsPath,
        cachedPath,
        totalTimeMs: totalElapsed
      });
      return cachedPath;
    }

    // Pre-warm WSL if not done yet
    if (!this.isPreWarmed) {
      await this.preWarmWSL();
    }

    try {
      // Try direct mapping for temp directories first (faster)
      const directPath = this.tryDirectPathMapping(windowsPath);
      if (directPath) {
        this.pathCache.set(windowsPath, directPath);
        const totalElapsed = Date.now() - startTime;
        wslLogger.info('⚡ Direct path mapping used', {
          windowsPath,
          directPath,
          totalTimeMs: totalElapsed
        });
        return directPath;
      }

      wslLogger.debug('⚡ Executing wslpath command...');
      const commandStart = Date.now();

      // Escape backslashes properly for WSL
      const escapedPath = windowsPath.replace(/\\/g, '\\\\');
      wslLogger.debug('📝 Path escaped for WSL', { 
        original: windowsPath, 
        escaped: escapedPath 
      });

      const { stdout } = await execPromise(`wsl wslpath "${escapedPath}"`);
      const commandElapsed = Date.now() - commandStart;
      
      const wslPath = stdout.trim();
      const totalElapsed = Date.now() - startTime;

      // Cache the result
      this.pathCache.set(windowsPath, wslPath);

      wslLogger.info('✅ WSL path conversion successful', {
        windowsPath,
        wslPath,
        totalTimeMs: totalElapsed,
        commandTimeMs: commandElapsed,
        stdoutLength: stdout.length,
        cached: true
      });

      return wslPath;
    } catch (error) {
      const failureElapsed = Date.now() - startTime;
      wslLogger.warn('⚠️ WSL path conversion failed, using fallback', {
        windowsPath,
        error: error.message,
        errorCode: error.code,
        failureTimeMs: failureElapsed
      });

      // Fallback: manually convert Windows path to WSL format
      const fallbackStart = Date.now();
      const drive = windowsPath.charAt(0).toLowerCase();
      const restPath = windowsPath.substring(3).replace(/\\/g, '/');
      const fallbackPath = `/mnt/${drive}/${restPath}`;
      const fallbackElapsed = Date.now() - fallbackStart;

      wslLogger.info('🔄 Fallback WSL path conversion completed', {
        windowsPath,
        fallbackPath,
        fallbackTimeMs: fallbackElapsed,
        totalTimeMs: Date.now() - startTime,
        pathComponents: {
          drive,
          restPath: restPath.substring(0, 100) // Truncate for logging
        }
      });

      return fallbackPath;
    }
  }

  /**
   * Pre-warm WSL to reduce startup overhead
   * @returns {Promise<void>}
   */
  async preWarmWSL() {
    if (this.isPreWarmed) return;

    const startTime = Date.now();
    wslLogger.info('🔥 Pre-warming WSL to reduce startup overhead...');

    try {
      await execPromise('wsl echo "WSL Ready"', { timeout: 10000 });
      this.isPreWarmed = true;
      const elapsedTime = Date.now() - startTime;
      wslLogger.info('✅ WSL pre-warmed successfully', {
        preWarmTimeMs: elapsedTime
      });
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      wslLogger.warn('⚠️ WSL pre-warming failed, will use standard startup', {
        error: error.message,
        preWarmTimeMs: elapsedTime
      });
      // Don't fail the operation, just mark as pre-warmed to avoid retrying
      this.isPreWarmed = true;
    }
  }

  /**
   * Try direct path mapping for common Windows paths (faster than wslpath)
   * @param {string} windowsPath - Windows file path
   * @returns {string|null} WSL path if mapping successful, null otherwise
   */
  tryDirectPathMapping(windowsPath) {
    // Only map paths we're confident about (temp directories, project paths)
    const normalizedPath = windowsPath.replace(/\\/g, '/');
    
    // Match C:\Users\... patterns
    const driveMatch = windowsPath.match(/^([C-Z]):\\/i);
    if (driveMatch) {
      const drive = driveMatch[1].toLowerCase();
      const restPath = windowsPath.substring(3).replace(/\\/g, '/');
      
      // Only use direct mapping for temp directories and project paths to avoid issues
      if (windowsPath.includes('\\temp\\') || 
          windowsPath.includes('\\aihackthon2025\\') ||
          windowsPath.includes('\\uploads\\')) {
        const directPath = `/mnt/${drive}/${restPath}`;
        wslLogger.debug('🎯 Direct path mapping candidate', {
          windowsPath,
          directPath,
          reason: 'temp/project directory'
        });
        return directPath;
      }
    }
    
    return null;
  }

  /**
   * Run Semgrep security scanner
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runSemgrep(targetPath) {
    const startTime = Date.now();
    wslLogger.info('🔍 Starting Semgrep scan', { targetPath });

    if (!(await this.isAvailable())) {
      wslLogger.error('❌ WSL2 not available for Semgrep scan');
      throw new Error('WSL2 is not available');
    }

    try {
      // Convert Windows path to WSL path
      wslLogger.debug('🔄 Converting path for Semgrep...');
      const pathConversionStart = Date.now();
      const wslPath = await this.convertToWSLPath(targetPath);
      const pathConversionElapsed = Date.now() - pathConversionStart;
      
      wslLogger.debug('✅ Path conversion completed for Semgrep', {
        pathConversionTimeMs: pathConversionElapsed,
        wslPath
      });

      // Build Semgrep command
      const args = [
        'semgrep',
        '--config=auto',
        '--json',
        '--no-git-ignore',
        '--timeout=60',
        wslPath,
      ];

      wslLogger.info('⚡ Executing Semgrep command', {
        command: 'wsl',
        args: args.join(' '),
        targetPath,
        wslPath
      });

      const executionStart = Date.now();
      const result = await this.executeCommand('wsl', args);
      const executionElapsed = Date.now() - executionStart;

      wslLogger.debug('📊 Semgrep command output received', {
        executionTimeMs: executionElapsed,
        outputLength: result.length,
        outputPreview: result.substring(0, 200)
      });

      // Parse Semgrep JSON output
      wslLogger.debug('🔍 Parsing Semgrep output...');
      const parseStart = Date.now();
      const parsedResults = this.parseSemgrepOutput(result);
      const parseElapsed = Date.now() - parseStart;

      const totalElapsed = Date.now() - startTime;
      wslLogger.info('✅ Semgrep scan completed successfully', {
        totalTimeMs: totalElapsed,
        pathConversionTimeMs: pathConversionElapsed,
        executionTimeMs: executionElapsed,
        parseTimeMs: parseElapsed,
        resultCount: parsedResults.length,
        targetPath,
        wslPath
      });

      return parsedResults;
    } catch (error) {
      const totalElapsed = Date.now() - startTime;
      wslLogger.error('❌ Semgrep execution failed', {
        error: error.message,
        errorCode: error.code,
        signal: error.signal,
        totalTimeMs: totalElapsed,
        targetPath
      });
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
    const startTime = Date.now();
    wslLogger.info('🔍 Starting Trivy scan', { targetPath });

    if (!(await this.isAvailable())) {
      wslLogger.error('❌ WSL2 not available for Trivy scan');
      throw new Error('WSL2 is not available');
    }

    try {
      // Convert Windows path to WSL path
      wslLogger.debug('🔄 Converting path for Trivy...');
      const pathConversionStart = Date.now();
      const wslPath = await this.convertToWSLPath(targetPath);
      const pathConversionElapsed = Date.now() - pathConversionStart;
      
      wslLogger.debug('✅ Path conversion completed for Trivy', {
        pathConversionTimeMs: pathConversionElapsed,
        wslPath
      });

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

      wslLogger.info('⚡ Executing Trivy command', {
        command: 'wsl',
        args: args.join(' '),
        targetPath,
        wslPath
      });

      const executionStart = Date.now();
      const result = await this.executeCommand('wsl', args);
      const executionElapsed = Date.now() - executionStart;

      wslLogger.debug('📊 Trivy command output received', {
        executionTimeMs: executionElapsed,
        outputLength: result.length,
        outputPreview: result.substring(0, 200)
      });

      // Parse Trivy JSON output
      wslLogger.debug('🔍 Parsing Trivy output...');
      const parseStart = Date.now();
      const parsedResults = this.parseTrivyOutput(result);
      const parseElapsed = Date.now() - parseStart;

      const totalElapsed = Date.now() - startTime;
      wslLogger.info('✅ Trivy scan completed successfully', {
        totalTimeMs: totalElapsed,
        pathConversionTimeMs: pathConversionElapsed,
        executionTimeMs: executionElapsed,
        parseTimeMs: parseElapsed,
        resultCount: parsedResults.length,
        targetPath,
        wslPath
      });

      return parsedResults;
    } catch (error) {
      const totalElapsed = Date.now() - startTime;
      wslLogger.error('❌ Trivy execution failed', {
        error: error.message,
        errorCode: error.code,
        signal: error.signal,
        totalTimeMs: totalElapsed,
        targetPath
      });
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
    const startTime = Date.now();
    const commandStr = `${command} ${args.join(' ')}`;
    
    wslLogger.info('🚀 Executing WSL command', {
      command,
      args,
      fullCommand: commandStr,
      timeoutMs: this.timeout
    });

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let timedOut = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let lastOutputTime = Date.now();

      const process = spawn(command, args, {
        shell: false,
        windowsHide: true,
      });

      wslLogger.debug('📋 Process spawned', {
        pid: process.pid,
        spawnTime: Date.now() - startTime
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        const elapsedTime = Date.now() - startTime;
        const timeSinceLastOutput = Date.now() - lastOutputTime;
        
        wslLogger.error('⏰ Command timeout reached', {
          timeoutMs: this.timeout,
          elapsedMs: elapsedTime,
          timeSinceLastOutputMs: timeSinceLastOutput,
          stdoutBytes,
          stderrBytes,
          pid: process.pid
        });
        
        timedOut = true;
        process.kill('SIGTERM');
        reject(new Error(`Command timed out after ${this.timeout}ms`));
      }, this.timeout);

      process.stdout.on('data', (data) => {
        lastOutputTime = Date.now();
        stdoutBytes += data.length;
        output += data.toString();
        
        wslLogger.debug('📥 Stdout data received', {
          chunkSize: data.length,
          totalStdoutBytes: stdoutBytes,
          elapsedMs: Date.now() - startTime
        });
      });

      process.stderr.on('data', (data) => {
        lastOutputTime = Date.now();
        stderrBytes += data.length;
        errorOutput += data.toString();
        
        wslLogger.debug('📥 Stderr data received', {
          chunkSize: data.length,
          totalStderrBytes: stderrBytes,
          elapsedMs: Date.now() - startTime,
          stderrPreview: data.toString().substring(0, 100)
        });
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        const elapsedTime = Date.now() - startTime;
        
        wslLogger.error('❌ Process error occurred', {
          error: error.message,
          errorCode: error.code,
          elapsedMs: elapsedTime,
          stdoutBytes,
          stderrBytes,
          pid: process.pid
        });
        
        reject(error);
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        const elapsedTime = Date.now() - startTime;

        if (timedOut) return;

        wslLogger.info('🏁 Command execution completed', {
          exitCode: code,
          elapsedMs: elapsedTime,
          stdoutBytes,
          stderrBytes,
          outputLength: output.length,
          errorOutputLength: errorOutput.length,
          success: code === 0 || output.length > 0
        });

        if (code === 0) {
          wslLogger.debug('✅ Command succeeded with exit code 0');
          resolve(output);
        } else {
          // Some tools return non-zero exit codes even on success
          // Check if we have output before rejecting
          if (output) {
            wslLogger.warn('⚠️ Non-zero exit code but output received, treating as success', {
              exitCode: code,
              outputLength: output.length
            });
            resolve(output);
          } else {
            wslLogger.error('❌ Command failed with no output', {
              exitCode: code,
              errorOutput: errorOutput.substring(0, 500)
            });
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
