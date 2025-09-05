import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test fixtures and sample data for Security Scanner tests
 */

export const testFiles = {
  // Sample ZIP file for testing (you'll need to create this)
  sampleZip: path.join(__dirname, 'sample-vulnerable-app.zip'),
  
  // Large file for testing file size limits
  largeFile: path.join(__dirname, 'large-test-file.zip'),
  
  // Invalid file for testing validation
  invalidFile: path.join(__dirname, 'invalid-file.txt'),
};

export const testRepositories = {
  // Public test repositories
  validRepository: 'https://github.com/OWASP/WebGoat.git',
  
  // Small test repository for faster testing
  smallRepository: 'https://github.com/octocat/Hello-World.git',
  
  // Invalid repository URL
  invalidRepository: 'https://invalid-repo-url.com/repo.git',
  
  // Non-existent repository
  nonExistentRepository: 'https://github.com/nonexistent/repository.git',
};

export const expectedScannerTools = [
  'Semgrep',
  'Trivy', 
  'OWASP Dependency Check'
];

export const severityLevels = [
  'CRITICAL',
  'HIGH',
  'MEDIUM', 
  'LOW',
  'INFO'
];

export const mockScanResults = {
  semgrep: [
    {
      id: 'semgrep-1',
      tool: 'Semgrep',
      severity: 'HIGH',
      type: 'SQL Injection',
      file: 'app/database.js',
      line: 42,
      description: 'Potential SQL injection vulnerability detected',
      fix: 'Use parameterized queries instead of string concatenation',
      references: [
        'https://owasp.org/www-community/attacks/SQL_Injection',
        'https://semgrep.dev/playground/s/sql-injection'
      ]
    },
    {
      id: 'semgrep-2',
      tool: 'Semgrep',
      severity: 'MEDIUM',
      type: 'Cross-site Scripting (XSS)',
      file: 'app/routes.js',
      line: 156,
      description: 'Potential XSS vulnerability from unescaped user input',
      fix: 'Escape user input before rendering in HTML',
      references: [
        'https://owasp.org/www-community/attacks/xss/',
        'https://semgrep.dev/playground/s/xss'
      ]
    }
  ],
  
  trivy: [
    {
      id: 'trivy-1',
      tool: 'Trivy',
      severity: 'CRITICAL',
      type: 'Known Vulnerability',
      file: 'package.json',
      line: 1,
      description: 'lodash 4.17.15 has a critical vulnerability CVE-2021-23337',
      fix: 'Upgrade lodash to version 4.17.21 or later',
      references: [
        'https://nvd.nist.gov/vuln/detail/CVE-2021-23337',
        'https://github.com/advisories/GHSA-35jh-r3h4-6jhm'
      ]
    }
  ]
};

export const testTimeouts = {
  upload: 30000,
  clone: 60000,
  scan: 300000, // 5 minutes
  download: 30000,
};

export const testConfig = {
  frontend: {
    url: 'http://localhost:3000',
    port: 3000
  },
  backend: {
    url: 'http://localhost:5000',
    port: 5000
  }
};
