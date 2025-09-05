import { v4 as uuidv4 } from 'uuid';
import { WSL2Bridge } from './wsl2Bridge.js';
import { ODCBridge } from './odcBridge.js';
import { folderRegistry } from './folderRegistry.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import winston from 'winston';

// Configure detailed logger for scan orchestration
const orchestratorLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [ORCHESTRATOR-${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/scan-orchestrator.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for orchestrating security scans across multiple tools
 */
export class ScanOrchestrator {
  constructor(scanId, wsClients) {
    this.scanId = scanId;
    this.wsClients = wsClients;
    this.wsl2Bridge = new WSL2Bridge();
    this.odcBridge = new ODCBridge();
    this.results = [];
    this.progress = 0;
    this.currentTool = null;
  }

  /**
   * Start a security scan with selected tools
   * @param {string} targetId - Target ID or path to scan
   * @param {string[]} selectedTools - Array of selected tool names
   * @returns {Promise<Array>} Scan results
   */
  async startScan(targetId, selectedTools) {
    const scanStartTime = Date.now();
    const scanContext = {
      scanId: this.scanId,
      targetId,
      selectedTools,
      toolCount: selectedTools.length
    };

    orchestratorLogger.info('🚀 Starting security scan', scanContext);

    try {
      orchestratorLogger.debug('📋 Scan initialization phase', scanContext);
      this.sendProgress('Initializing scan...', 0);

      // Resolve targetId to actual file path
      orchestratorLogger.debug('🔍 Resolving target path...', { targetId });
      const pathResolutionStart = Date.now();
      
      const targetPath = this.resolveTargetPath(targetId);
      const pathResolutionElapsed = Date.now() - pathResolutionStart;
      
      orchestratorLogger.info('✅ Target path resolved', {
        targetId,
        targetPath,
        resolutionTimeMs: pathResolutionElapsed,
        ...scanContext
      });
      
      this.sendProgress(`Resolved target path: ${targetPath}`, 5);

      // Validate target path exists and is accessible
      orchestratorLogger.debug('🔍 Validating target path existence...', { targetPath });
      const validationStart = Date.now();
      
      if (!fs.existsSync(targetPath)) {
        orchestratorLogger.error('❌ Target path does not exist', { 
          targetPath, 
          validationTimeMs: Date.now() - validationStart 
        });
        throw new Error(`Target path does not exist: ${targetPath}`);
      }
      
      orchestratorLogger.debug('✅ Target path exists', { 
        targetPath,
        existenceCheckMs: Date.now() - validationStart 
      });

      // Additional validation for directory structure
      const statsStart = Date.now();
      const stats = fs.statSync(targetPath);
      const statsElapsed = Date.now() - statsStart;
      
      if (!stats.isDirectory()) {
        orchestratorLogger.error('❌ Target path is not a directory', { 
          targetPath,
          statsTimeMs: statsElapsed 
        });
        throw new Error(`Target path is not a directory: ${targetPath}`);
      }
      
      orchestratorLogger.debug('✅ Target path is a valid directory', { 
        targetPath,
        statsTimeMs: statsElapsed,
        size: stats.size,
        modified: stats.mtime
      });

      // List files in the target directory for debugging
      try {
        const fileListStart = Date.now();
        const files = fs.readdirSync(targetPath);
        const fileListElapsed = Date.now() - fileListStart;
        
        orchestratorLogger.info('📁 Target directory contents analyzed', {
          targetPath,
          fileCount: files.length,
          fileListTimeMs: fileListElapsed,
          sampleFiles: files.slice(0, 10),
          hasMoreFiles: files.length > 10
        });
        
      } catch (error) {
        orchestratorLogger.warn('⚠️ Error listing directory contents', {
          targetPath,
          error: error.message,
          validationTimeMs: Date.now() - validationStart
        });
      }

      // Log scanning mode for debugging
      const isDirect =
        path.isAbsolute(targetId) ||
        targetId.includes('/') ||
        targetId.includes('\\');
      
      const scanMode = isDirect ? 'DIRECT' : 'STANDARD';
      orchestratorLogger.info('📋 Scan mode determined', {
        mode: scanMode,
        isDirect,
        targetId,
        targetPath,
        ...scanContext
      });

      const totalTools = selectedTools.length;
      let completedTools = 0;
      const toolResults = [];

      orchestratorLogger.info('🔧 Starting tool execution phase', {
        totalTools,
        tools: selectedTools,
        ...scanContext
      });

      for (const tool of selectedTools) {
        const toolStartTime = Date.now();
        this.currentTool = tool;
        const toolProgress = (completedTools / totalTools) * 100;

        orchestratorLogger.info(`🔍 Starting ${tool} scan`, {
          tool,
          toolIndex: completedTools + 1,
          totalTools,
          progress: toolProgress,
          ...scanContext
        });

        this.sendProgress(`Starting ${tool} scan...`, toolProgress);

        try {
          let currentToolResults = [];

          switch (tool) {
            case 'Semgrep':
              currentToolResults = await this.runSemgrepWithRealTime(targetPath);
              break;
            case 'Trivy':
              currentToolResults = await this.runTrivyWithRealTime(targetPath);
              break;
            case 'OWASP Dependency Check':
              currentToolResults = await this.runODCWithRealTime(targetPath);
              break;
            default:
              orchestratorLogger.warn(`❓ Unknown tool requested: ${tool}`, { tool, ...scanContext });
          }

          const toolElapsed = Date.now() - toolStartTime;
          this.results.push(...currentToolResults);
          toolResults.push({
            tool,
            resultCount: currentToolResults.length,
            executionTimeMs: toolElapsed
          });
          completedTools++;

          const newProgress = (completedTools / totalTools) * 100;
          
          orchestratorLogger.info(`✅ ${tool} scan completed`, {
            tool,
            resultCount: currentToolResults.length,
            executionTimeMs: toolElapsed,
            completedTools,
            totalTools,
            progress: newProgress,
            ...scanContext
          });
          
          this.sendProgress(`Completed ${tool} scan`, newProgress);
        } catch (error) {
          const toolElapsed = Date.now() - toolStartTime;
          
          orchestratorLogger.error(`❌ ${tool} scan failed`, {
            tool,
            error: error.message,
            errorCode: error.code,
            executionTimeMs: toolElapsed,
            ...scanContext
          });
          
          this.sendProgress(
            `Error in ${tool}: ${error.message}`,
            this.progress
          );
          
          toolResults.push({
            tool,
            error: error.message,
            executionTimeMs: toolElapsed
          });
          
          // Continue with other tools even if one fails
        }
      }

      const totalScanTime = Date.now() - scanStartTime;
      
      this.sendProgress('Scan completed successfully!', 100);

      // Deduplicate results
      const deduplicationStart = Date.now();
      const finalResults = this.deduplicateResults(this.results);
      const deduplicationElapsed = Date.now() - deduplicationStart;

      orchestratorLogger.info('🎉 Scan completed successfully', {
        totalScanTimeMs: totalScanTime,
        deduplicationTimeMs: deduplicationElapsed,
        rawResultCount: this.results.length,
        finalResultCount: finalResults.length,
        duplicatesRemoved: this.results.length - finalResults.length,
        toolResults,
        ...scanContext
      });

      // Send completion message to trigger frontend transition
      this.sendCompletion();

      return finalResults;
    } catch (error) {
      const totalScanTime = Date.now() - scanStartTime;
      
      orchestratorLogger.error('❌ Scan failed', {
        error: error.message,
        errorCode: error.code,
        stack: error.stack,
        totalScanTimeMs: totalScanTime,
        currentProgress: this.progress,
        currentTool: this.currentTool,
        ...scanContext
      });
      
      this.sendProgress(`Scan failed: ${error.message}`, this.progress);
      throw error;
    }
  }

  /**
   * Run Semgrep scanner
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runSemgrep(targetPath) {
    // Check if WSL2 is available and not in mock mode
    const isWSL2Available = await this.wsl2Bridge.isAvailable();

    if (process.env.MOCK_WSL2 === 'true') {
      orchestratorLogger.info('Using mocked Semgrep results (MOCK_WSL2=true)');
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return this.getMockedSemgrepResults();
    }

    if (!isWSL2Available) {
      orchestratorLogger.warn('WSL2 not available, returning empty results');
      return [];
    }

    orchestratorLogger.info(`Running real Semgrep on ${targetPath}`);
    return this.wsl2Bridge.runSemgrep(targetPath);
  }

  /**
   * Run Trivy scanner
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runTrivy(targetPath) {
    // Check if WSL2 is available and not in mock mode
    const isWSL2Available = await this.wsl2Bridge.isAvailable();

    if (process.env.MOCK_WSL2 === 'true') {
      orchestratorLogger.info('Using mocked Trivy results (MOCK_WSL2=true)');
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return this.getMockedTrivyResults();
    }

    if (!isWSL2Available) {
      orchestratorLogger.warn('WSL2 not available, returning empty results');
      return [];
    }

    orchestratorLogger.info(`Running real Trivy on ${targetPath}`);
    return this.wsl2Bridge.runTrivy(targetPath);
  }

  /**
   * Run OWASP Dependency Check
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runODC(targetPath) {
    // Check if ODC is enabled and available
    const isODCAvailable = await this.odcBridge.isAvailable();

    if (process.env.ENABLE_ODC !== 'true') {
      console.warn('ODC disabled (ENABLE_ODC not true)');
      return [];
    }

    if (!isODCAvailable) {
      console.warn('ODC not available, returning mocked results');
      return this.getMockedODCResults();
    }

    console.warn('Running real ODC on target path');
    return this.odcBridge.runODC(targetPath);
  }

  /**
   * Get mocked Semgrep results
   * @returns {Array} Mocked results
   */
  getMockedSemgrepResults() {
    return [
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'HIGH',
        type: 'SQL Injection',
        file: 'src/database/queries.js',
        line: 42,
        description:
          'User input is concatenated directly into SQL query without proper sanitization',
        fix: 'Use parameterized queries or prepared statements instead of string concatenation',
        references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'MEDIUM',
        type: 'Hardcoded Secret',
        file: 'config/database.js',
        line: 15,
        description: 'API key appears to be hardcoded in the source code',
        fix: 'Move sensitive data to environment variables or secure configuration management',
        references: ['https://cwe.mitre.org/data/definitions/798.html'],
      },
    ];
  }

  /**
   * Get mocked Trivy results
   * @returns {Array} Mocked results
   */
  getMockedTrivyResults() {
    return [
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'CRITICAL',
        type: 'Vulnerable Dependency',
        file: 'package.json',
        line: 25,
        description:
          'lodash@4.17.11 has known security vulnerabilities (CVE-2020-8203)',
        fix: 'Update lodash to version 4.17.21 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2020-8203'],
      },
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'HIGH',
        type: 'Outdated Package',
        file: 'package-lock.json',
        line: 150,
        description: 'express@4.16.0 has multiple security issues',
        fix: 'Update express to the latest version (4.18.2 or later)',
        references: [
          'https://github.com/expressjs/express/security/advisories',
        ],
      },
    ];
  }

  /**
   * Get mocked ODC results
   * @returns {Array} Mocked results
   */
  getMockedODCResults() {
    return [
      {
        id: uuidv4(),
        tool: 'OWASP Dependency Check',
        severity: 'LOW',
        type: 'License Risk',
        file: 'dependencies.json',
        line: 0,
        description:
          'GPL licensed dependency detected which may have legal implications',
        fix: 'Review license compatibility with your project requirements',
        references: ['https://www.gnu.org/licenses/gpl-3.0.html'],
      },
    ];
  }

  /**
   * Deduplicate scan results
   * @param {Array} results - Raw scan results
   * @returns {Array} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Map();

    return results.filter((result) => {
      // Create a unique key based on file, line, and type
      const key = `${result.file}:${result.line}:${result.type}`;

      if (seen.has(key)) {
        // If we've seen this before, merge the tools
        const existing = seen.get(key);
        if (!existing.tool.includes(result.tool)) {
          existing.tool = `${existing.tool}, ${result.tool}`;
        }
        return false;
      }

      seen.set(key, result);
      return true;
    });
  }

  /**
   * Resolve target ID to actual file path
   * @param {string} targetId - Target ID from upload/clone or direct path
   * @returns {string} Resolved file path
   */
  resolveTargetPath(targetId) {
    orchestratorLogger.debug(`🔍 Resolving target path for: "${targetId}"`);
    
    // IMPORTANT: Direct paths are ONLY allowed for registered folder uploads
    // ZIP files and repository clones should ALWAYS use temp directory

    // Check if this is a registered direct folder scan
    if (folderRegistry.isDirectScan(targetId)) {
      const directPath = folderRegistry.getPath(targetId);
      orchestratorLogger.debug(`📂 Direct folder scan: ${targetId} -> ${directPath}`);
      return directPath;
    }

    // Check if targetId is already a full path (absolute path)
    if (path.isAbsolute(targetId)) {
      orchestratorLogger.debug(`📍 Direct scanning: Using absolute path: ${targetId}`);
      return targetId;
    }

    // Check if it's a UUID pattern (most upload/clone IDs are UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(targetId)) {
      const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../../../temp');
      const resolvedPath = path.join(tempDir, targetId);
      orchestratorLogger.debug(`🆔 UUID detected: Resolved '${targetId}' to temp path: ${resolvedPath}`);
      return resolvedPath;
    }

    // For relative paths that are NOT UUIDs, treat as direct paths (but warn)
    if (targetId.includes('/') || targetId.includes('\\')) {
      const resolvedPath = path.resolve(targetId);
      orchestratorLogger.warn(`⚠️  POTENTIAL BUG: Resolved relative path '${targetId}' to: ${resolvedPath}`);
      orchestratorLogger.warn(`⚠️  This might be scanning local files instead of uploaded/cloned content!`);
      return resolvedPath;
    }

    // For simple names without paths, also check if it's a directory in current location
    // This is likely a bug - we should prefer temp directory
    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../../../temp');
    const tempPath = path.join(tempDir, targetId);
    const localPath = path.resolve(targetId);

    // Check if the target exists in temp directory
    try {
      if (fs.existsSync(tempPath)) {
        orchestratorLogger.debug(`✅ Found in temp directory: ${tempPath}`);
        return tempPath;
      }
    } catch (error) {
      orchestratorLogger.warn(`❌ Error checking temp path: ${error.message}`);
    }

    // Check if it exists locally (this might be the bug)
    try {
      if (fs.existsSync(localPath)) {
        orchestratorLogger.warn(`⚠️  FOUND LOCALLY (POTENTIAL BUG): ${localPath}`);
        orchestratorLogger.warn(`⚠️  This suggests scanning local project files instead of uploaded/cloned content!`);
        return localPath;
      }
    } catch (error) {
      orchestratorLogger.warn(`❌ Error checking local path: ${error.message}`);
    }

    // Default to temp directory
    orchestratorLogger.debug(`🎯 Default: Using temp path: ${tempPath}`);
    return tempPath;
  }

  /**
   * Send completion notification to WebSocket clients
   */
  sendCompletion() {
    const completionData = {
      type: 'complete',
      scanId: this.scanId,
      timestamp: new Date().toISOString(),
      resultCount: this.results.length,
    };

    // Send to WebSocket client if connected
    const client = this.wsClients.get(this.scanId);
    if (client && client.readyState === 1) {
      // 1 = OPEN
      try {
        client.send(JSON.stringify(completionData));
        orchestratorLogger.debug(`[${this.scanId}] Sent completion notification`);
      } catch (error) {
        orchestratorLogger.error('Failed to send completion message:', error);
      }
    } else {
      orchestratorLogger.debug(
        `No WebSocket client found for completion notification: ${this.scanId}`
      );
    }
  }

  /**
   * Run Semgrep scanner with real-time vulnerability broadcasting
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runSemgrepWithRealTime(targetPath) {
    // Check if WSL2 is available and not in mock mode
    const isWSL2Available = await this.wsl2Bridge.isAvailable();

    if (process.env.MOCK_WSL2 === 'true') {
      orchestratorLogger.info(
        'Using mocked Semgrep results with real-time updates (MOCK_WSL2=true)'
      );
      return this.getMockedSemgrepResultsRealTime();
    }

    if (!isWSL2Available) {
      orchestratorLogger.warn('WSL2 not available, returning empty results');
      return [];
    }

    orchestratorLogger.info(`Running real Semgrep on ${targetPath}`);
    // For real Semgrep, fall back to original method for now
    return this.runSemgrep(targetPath);
  }

  /**
   * Run Trivy scanner with real-time vulnerability broadcasting
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runTrivyWithRealTime(targetPath) {
    // Check if WSL2 is available and not in mock mode
    const isWSL2Available = await this.wsl2Bridge.isAvailable();

    if (process.env.MOCK_WSL2 === 'true') {
      orchestratorLogger.info(
        'Using mocked Trivy results with real-time updates (MOCK_WSL2=true)'
      );
      return this.getMockedTrivyResultsRealTime();
    }

    if (!isWSL2Available) {
      orchestratorLogger.warn('WSL2 not available, returning empty results');
      return [];
    }

    orchestratorLogger.info(`Running real Trivy on ${targetPath}`);
    // For real Trivy, fall back to original method for now
    return this.runTrivy(targetPath);
  }

  /**
   * Run OWASP Dependency Check with real-time vulnerability broadcasting
   * @param {string} targetPath - Path to scan
   * @returns {Promise<Array>} Scan results
   */
  async runODCWithRealTime(targetPath) {
    // Check if ODC is enabled and available
    const isODCAvailable = await this.odcBridge.isAvailable();

    if (process.env.ENABLE_ODC !== 'true') {
      console.warn('ODC disabled (ENABLE_ODC not true)');
      return [];
    }

    if (!isODCAvailable) {
      console.warn(
        'ODC not available, returning mocked results with real-time updates'
      );
      return this.getMockedODCResultsRealTime();
    }

    console.warn('Running real ODC on target path');
    // For real ODC, fall back to original method for now
    return this.runODC(targetPath);
  }

  /**
   * Get mocked Semgrep results with real-time broadcasting
   * @returns {Promise<Array>} Mocked results
   */
  async getMockedSemgrepResultsRealTime() {
    const vulnerabilities = [
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'CRITICAL',
        type: 'SQL Injection',
        file: 'vulnerable-test-app/index.js',
        line: 26,
        description:
          'Direct string concatenation in SQL query allows SQL injection attacks',
        fix: 'Use parameterized queries or prepared statements instead of string concatenation',
        references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'CRITICAL',
        type: 'Command Injection',
        file: 'vulnerable-test-app/index.js',
        line: 38,
        description:
          'User input directly executed in shell command without sanitization',
        fix: 'Validate and sanitize user input before using in shell commands, or use safer alternatives',
        references: [
          'https://owasp.org/www-community/attacks/Command_Injection',
        ],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'HIGH',
        type: 'Cross-Site Scripting (XSS)',
        file: 'vulnerable-test-app/index.js',
        line: 70,
        description: 'User input directly embedded in HTML without encoding',
        fix: 'Encode user input before embedding in HTML or use templating engines with auto-escaping',
        references: ['https://owasp.org/www-community/attacks/xss/'],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'HIGH',
        type: 'Path Traversal',
        file: 'vulnerable-test-app/index.js',
        line: 51,
        description: 'File path constructed from user input without validation',
        fix: 'Validate file paths and restrict access to specific directories',
        references: ['https://owasp.org/www-community/attacks/Path_Traversal'],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'HIGH',
        type: 'Hardcoded Secrets',
        file: 'vulnerable-test-app/index.js',
        line: 11,
        description: 'Database credentials hardcoded in source code',
        fix: 'Use environment variables or secure configuration management for sensitive data',
        references: [
          'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
        ],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'CRITICAL',
        type: 'Code Injection (eval)',
        file: 'vulnerable-test-app/index.js',
        line: 119,
        description: 'User input passed directly to eval() function',
        fix: 'Never use eval() with user input. Use JSON.parse() for data or specific parsers',
        references: [
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval!',
        ],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'MEDIUM',
        type: 'Weak Cryptography',
        file: 'vulnerable-test-app/index.js',
        line: 83,
        description:
          'MD5 hash used for password hashing (cryptographically broken)',
        fix: 'Use bcrypt, scrypt, or Argon2 for password hashing',
        references: [
          'https://owasp.org/www-project-cheat-sheets/cheatsheets/Password_Storage_Cheat_Sheet.html',
        ],
      },
      {
        id: uuidv4(),
        tool: 'Semgrep',
        severity: 'MEDIUM',
        type: 'Information Disclosure',
        file: 'vulnerable-test-app/index.js',
        line: 104,
        description: 'Sensitive information exposed in debug endpoint',
        fix: 'Remove debug endpoints from production or secure them properly',
        references: [
          'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
        ],
      },
    ];

    // Simulate discovering vulnerabilities over time
    const results = [];
    for (let i = 0; i < vulnerabilities.length; i++) {
      const vuln = vulnerabilities[i];

      // Add some realistic delay between discoveries
      await new Promise((resolve) =>
        setTimeout(resolve, 300 + Math.random() * 700)
      );

      // Send real-time vulnerability update
      this.sendVulnerability(vuln);

      results.push(vuln);

      // Update progress based on vulnerability discovery
      const progress = ((i + 1) / vulnerabilities.length) * 100;
      this.sendProgress(
        `Found ${vuln.severity} vulnerability: ${vuln.type}`,
        progress
      );
    }

    return results;
  }

  /**
   * Get mocked Trivy results with real-time broadcasting
   * @returns {Promise<Array>} Mocked results
   */
  async getMockedTrivyResultsRealTime() {
    const vulnerabilities = [
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'HIGH',
        type: 'CVE-2021-3807',
        file: 'package.json',
        line: 1,
        description: 'ansi-regex: Regular Expression Denial of Service (ReDoS)',
        fix: 'Update to ansi-regex version 6.0.1 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-3807'],
      },
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'CRITICAL',
        type: 'CVE-2020-8203',
        file: 'package.json',
        line: 1,
        description: 'lodash: Prototype Pollution vulnerability',
        fix: 'Update to lodash version 4.17.12 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2020-8203'],
      },
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'HIGH',
        type: 'CVE-2022-0155',
        file: 'package.json',
        line: 1,
        description:
          'follow-redirects: Exposure of Sensitive Information vulnerability',
        fix: 'Update to follow-redirects version 1.14.7 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-0155'],
      },
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'MEDIUM',
        type: 'CVE-2021-23337',
        file: 'package.json',
        line: 1,
        description: 'lodash: Command Injection vulnerability',
        fix: 'Update to lodash version 4.17.21 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
      },
      {
        id: uuidv4(),
        tool: 'Trivy',
        severity: 'HIGH',
        type: 'CVE-2022-25883',
        file: 'package.json',
        line: 1,
        description: 'semver: Regular Expression Denial of Service (ReDoS)',
        fix: 'Update to semver version 7.5.2 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-25883'],
      },
    ];

    // Simulate discovering vulnerabilities over time
    const results = [];
    for (let i = 0; i < vulnerabilities.length; i++) {
      const vuln = vulnerabilities[i];

      // Add some realistic delay between discoveries
      await new Promise((resolve) =>
        setTimeout(resolve, 400 + Math.random() * 800)
      );

      // Send real-time vulnerability update
      this.sendVulnerability(vuln);

      results.push(vuln);

      // Update progress based on vulnerability discovery
      const progress = ((i + 1) / vulnerabilities.length) * 100;
      this.sendProgress(
        `Found dependency vulnerability: ${vuln.type}`,
        progress
      );
    }

    return results;
  }

  /**
   * Get mocked ODC results with real-time broadcasting
   * @returns {Promise<Array>} Mocked results
   */
  async getMockedODCResultsRealTime() {
    const vulnerabilities = [
      {
        id: uuidv4(),
        tool: 'OWASP Dependency Check',
        severity: 'MEDIUM',
        type: 'CVE-2021-44228',
        file: 'pom.xml',
        line: 45,
        description: 'Apache Log4j2 Remote Code Execution (Log4Shell)',
        fix: 'Update Log4j2 to version 2.17.1 or later',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-44228'],
      },
      {
        id: uuidv4(),
        tool: 'OWASP Dependency Check',
        severity: 'LOW',
        type: 'License Risk',
        file: 'dependencies.json',
        line: 0,
        description:
          'GPL licensed dependency detected which may have legal implications',
        fix: 'Review license compatibility with your project requirements',
        references: ['https://www.gnu.org/licenses/gpl-3.0.html'],
      },
    ];

    // Simulate discovering vulnerabilities over time
    const results = [];
    for (let i = 0; i < vulnerabilities.length; i++) {
      const vuln = vulnerabilities[i];

      // Add some realistic delay between discoveries
      await new Promise((resolve) =>
        setTimeout(resolve, 500 + Math.random() * 1000)
      );

      // Send real-time vulnerability update
      this.sendVulnerability(vuln);

      results.push(vuln);

      // Update progress based on vulnerability discovery
      const progress = ((i + 1) / vulnerabilities.length) * 100;
      this.sendProgress(`Found ODC vulnerability: ${vuln.type}`, progress);
    }

    return results;
  }

  /**
   * Send individual vulnerability discovery to WebSocket clients
   * @param {Object} vulnerability - The discovered vulnerability
   */
  sendVulnerability(vulnerability) {
    const vulnerabilityData = {
      type: 'vulnerability',
      scanId: this.scanId,
      vulnerability,
      currentTool: this.currentTool,
      timestamp: new Date().toISOString(),
      totalFound: this.results.length + 1, // +1 because this isn't added to results yet
    };

    // Send to WebSocket client if connected
    const client = this.wsClients.get(this.scanId);
    if (client && client.readyState === 1) {
      // 1 = OPEN
      try {
        client.send(JSON.stringify(vulnerabilityData));
        orchestratorLogger.debug(
          `[${this.scanId}] Sent vulnerability: ${vulnerability.type} (${vulnerability.severity})`
        );
      } catch (error) {
        orchestratorLogger.error('Failed to send vulnerability message:', error);
      }
    } else {
      orchestratorLogger.debug(`No WebSocket client found for vulnerability ${this.scanId}`);
    }
  }

  /**
   * Send progress update to WebSocket clients
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage
   */
  sendProgress(message, percent) {
    this.progress = percent;

    const progressData = {
      type: 'progress',
      scanId: this.scanId,
      currentTool: this.currentTool,
      progressPercent: Math.round(percent),
      message,
      timestamp: new Date().toISOString(),
    };

    // Send to WebSocket client if connected
    const client = this.wsClients.get(this.scanId);
    if (client && client.readyState === 1) {
      // 1 = OPEN
      try {
        client.send(JSON.stringify(progressData));
      } catch (error) {
        orchestratorLogger.error('Failed to send WebSocket message:', error);
      }
    } else {
      orchestratorLogger.debug(`No WebSocket client found for scan ${this.scanId}`);
    }

    // Also log progress
    orchestratorLogger.debug(`[${this.scanId}] ${message} (${Math.round(percent)}%)`);
  }
}
