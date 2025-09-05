import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReportGeneratorService } from '../services/reportGenerator.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

describe('ReportGeneratorService', () => {
  let reportGenerator;
  let mockScanResults;

  beforeEach(() => {
    reportGenerator = new ReportGeneratorService();
    mockScanResults = [
      {
        id: '1',
        tool: 'Semgrep',
        severity: 'CRITICAL',
        type: 'SQL Injection',
        file: 'src/database/queries.js',
        line: 42,
        description: 'User input is concatenated directly into SQL query',
        fix: 'Use parameterized queries instead',
        references: ['https://owasp.org/sql-injection'],
        confidence: 'HIGH',
        impact: 'CRITICAL',
        cwe: ['CWE-89'],
        owasp: ['A03:2021'],
      },
      {
        id: '2',
        tool: 'Trivy',
        severity: 'HIGH',
        type: 'Vulnerable Dependency',
        file: 'package.json',
        line: 25,
        description: 'lodash@4.17.11 has known vulnerabilities',
        fix: 'Update lodash to version 4.17.21',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2020-8203'],
        pkgName: 'lodash',
        installedVersion: '4.17.11',
        fixedVersion: '4.17.21',
      },
      {
        id: '3',
        tool: 'Semgrep',
        severity: 'MEDIUM',
        type: 'Hardcoded Secret',
        file: 'config/database.js',
        line: 15,
        description: 'API key appears to be hardcoded',
        fix: 'Move to environment variables',
        references: [],
      },
    ];

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateJSONReport', () => {
    test('should generate complete JSON report with metadata', async () => {
      const scanMetadata = {
        scanId: 'test-scan-123',
        targetPath: '/test/project',
        selectedTools: ['Semgrep', 'Trivy'],
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:05:00Z'),
        duration: 300000, // 5 minutes
      };

      fs.writeFile.mockResolvedValue();

      const result = await reportGenerator.generateJSONReport(
        mockScanResults,
        scanMetadata
      );

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('fileName');
      expect(result.fileName).toMatch(/security-scan-report-\d{8}-\d{6}\.json/);

      const writeCall = fs.writeFile.mock.calls[0];
      const reportData = JSON.parse(writeCall[1]);

      expect(reportData).toHaveProperty('metadata');
      expect(reportData).toHaveProperty('summary');
      expect(reportData).toHaveProperty('results');

      expect(reportData.metadata.scanId).toBe('test-scan-123');
      expect(reportData.metadata.duration).toBe(300000);
      expect(reportData.summary.totalIssues).toBe(3);
      expect(reportData.summary.severityBreakdown.CRITICAL).toBe(1);
      expect(reportData.summary.severityBreakdown.HIGH).toBe(1);
      expect(reportData.summary.severityBreakdown.MEDIUM).toBe(1);
    });

    test('should handle empty scan results', async () => {
      const scanMetadata = {
        scanId: 'empty-scan',
        selectedTools: ['Semgrep'],
        startTime: new Date(),
        endTime: new Date(),
      };

      fs.writeFile.mockResolvedValue();

      const result = await reportGenerator.generateJSONReport([], scanMetadata);

      const writeCall = fs.writeFile.mock.calls[0];
      const reportData = JSON.parse(writeCall[1]);

      expect(reportData.summary.totalIssues).toBe(0);
      expect(reportData.results).toEqual([]);
    });

    test('should include tool distribution in summary', async () => {
      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep', 'Trivy'],
        startTime: new Date(),
        endTime: new Date(),
      };

      fs.writeFile.mockResolvedValue();

      await reportGenerator.generateJSONReport(mockScanResults, scanMetadata);

      const writeCall = fs.writeFile.mock.calls[0];
      const reportData = JSON.parse(writeCall[1]);

      expect(reportData.summary.toolDistribution.Semgrep).toBe(2);
      expect(reportData.summary.toolDistribution.Trivy).toBe(1);
    });

    test('should handle file write errors', async () => {
      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep'],
        startTime: new Date(),
        endTime: new Date(),
      };

      fs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(
        reportGenerator.generateJSONReport(mockScanResults, scanMetadata)
      ).rejects.toThrow('Failed to generate JSON report');
    });
  });

  describe('generatePDFReport', () => {
    test('should generate PDF report with proper structure', async () => {
      const puppeteer = await import('puppeteer');
      const mockBrowser = {
        newPage: vi.fn(),
        close: vi.fn(),
      };
      const mockPage = {
        setContent: vi.fn(),
        pdf: vi.fn().mockResolvedValue(Buffer.from('PDF content')),
      };

      puppeteer.default.launch.mockResolvedValue(mockBrowser);
      mockBrowser.newPage.mockResolvedValue(mockPage);
      fs.writeFile.mockResolvedValue();

      const scanMetadata = {
        scanId: 'test-scan-123',
        targetPath: '/test/project',
        selectedTools: ['Semgrep', 'Trivy'],
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:05:00Z'),
      };

      const result = await reportGenerator.generatePDFReport(
        mockScanResults,
        scanMetadata
      );

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('fileName');
      expect(result.fileName).toMatch(/security-scan-report-\d{8}-\d{6}\.pdf/);

      expect(mockPage.setContent).toHaveBeenCalled();
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should include executive summary in PDF', async () => {
      const puppeteer = await import('puppeteer');
      const mockBrowser = {
        newPage: vi.fn(),
        close: vi.fn(),
      };
      const mockPage = {
        setContent: vi.fn(),
        pdf: vi.fn().mockResolvedValue(Buffer.from('PDF content')),
      };

      puppeteer.default.launch.mockResolvedValue(mockBrowser);
      mockBrowser.newPage.mockResolvedValue(mockPage);
      fs.writeFile.mockResolvedValue();

      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep', 'Trivy'],
        startTime: new Date(),
        endTime: new Date(),
      };

      await reportGenerator.generatePDFReport(mockScanResults, scanMetadata);

      const htmlContent = mockPage.setContent.mock.calls[0][0];

      expect(htmlContent).toContain('Security Scan Report');
      expect(htmlContent).toContain('Executive Summary');
      expect(htmlContent).toContain('Total Issues: 3');
      expect(htmlContent).toContain('Critical: 1');
      expect(htmlContent).toContain('High: 1');
      expect(htmlContent).toContain('Medium: 1');
    });

    test('should handle PDF generation errors', async () => {
      const puppeteer = await import('puppeteer');
      puppeteer.default.launch.mockRejectedValue(new Error('Puppeteer failed'));

      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep'],
        startTime: new Date(),
        endTime: new Date(),
      };

      await expect(
        reportGenerator.generatePDFReport(mockScanResults, scanMetadata)
      ).rejects.toThrow('Failed to generate PDF report');
    });

    test('should clean up browser on error', async () => {
      const puppeteer = await import('puppeteer');
      const mockBrowser = {
        newPage: vi.fn(),
        close: vi.fn(),
      };
      const mockPage = {
        setContent: vi.fn(),
        pdf: vi.fn().mockRejectedValue(new Error('PDF generation failed')),
      };

      puppeteer.default.launch.mockResolvedValue(mockBrowser);
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep'],
        startTime: new Date(),
        endTime: new Date(),
      };

      await expect(
        reportGenerator.generatePDFReport(mockScanResults, scanMetadata)
      ).rejects.toThrow('Failed to generate PDF report');

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('generateExecutiveSummary', () => {
    test('should create comprehensive executive summary', () => {
      const summary = reportGenerator.generateExecutiveSummary(mockScanResults);

      expect(summary).toHaveProperty('totalIssues', 3);
      expect(summary).toHaveProperty('severityBreakdown');
      expect(summary).toHaveProperty('toolDistribution');
      expect(summary).toHaveProperty('riskScore');
      expect(summary).toHaveProperty('recommendations');

      expect(summary.severityBreakdown.CRITICAL).toBe(1);
      expect(summary.severityBreakdown.HIGH).toBe(1);
      expect(summary.severityBreakdown.MEDIUM).toBe(1);
      expect(summary.severityBreakdown.LOW).toBe(0);

      expect(summary.toolDistribution.Semgrep).toBe(2);
      expect(summary.toolDistribution.Trivy).toBe(1);
    });

    test('should calculate risk score correctly', () => {
      const summary = reportGenerator.generateExecutiveSummary(mockScanResults);

      // Risk score calculation: CRITICAL=10, HIGH=7, MEDIUM=4, LOW=1
      const expectedRiskScore = 1 * 10 + 1 * 7 + 1 * 4; // 21
      expect(summary.riskScore).toBe(expectedRiskScore);
    });

    test('should provide appropriate recommendations', () => {
      const summary = reportGenerator.generateExecutiveSummary(mockScanResults);

      expect(summary.recommendations).toContain(
        'Address critical security issues immediately'
      );
      expect(summary.recommendations).toContain(
        'Review and fix high-severity vulnerabilities'
      );
    });

    test('should handle empty results', () => {
      const summary = reportGenerator.generateExecutiveSummary([]);

      expect(summary.totalIssues).toBe(0);
      expect(summary.riskScore).toBe(0);
      expect(summary.recommendations).toContain('No security issues detected');
    });
  });

  describe('generateHTMLContent', () => {
    test('should generate valid HTML structure', () => {
      const scanMetadata = {
        scanId: 'test-scan',
        targetPath: '/test/project',
        selectedTools: ['Semgrep', 'Trivy'],
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:05:00Z'),
      };

      const html = reportGenerator.generateHTMLContent(
        mockScanResults,
        scanMetadata
      );

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('Security Scan Report');
      expect(html).toContain('test-scan');
    });

    test('should include CSS styling', () => {
      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep'],
        startTime: new Date(),
        endTime: new Date(),
      };

      const html = reportGenerator.generateHTMLContent(
        mockScanResults,
        scanMetadata
      );

      expect(html).toContain('<style>');
      expect(html).toContain('body {');
      expect(html).toContain('.severity-critical');
      expect(html).toContain('.severity-high');
    });

    test('should render vulnerability details correctly', () => {
      const scanMetadata = {
        scanId: 'test-scan',
        selectedTools: ['Semgrep'],
        startTime: new Date(),
        endTime: new Date(),
      };

      const html = reportGenerator.generateHTMLContent(
        mockScanResults,
        scanMetadata
      );

      expect(html).toContain('SQL Injection');
      expect(html).toContain('src/database/queries.js:42');
      expect(html).toContain('Use parameterized queries instead');
      expect(html).toContain('CWE-89');
      expect(html).toContain('A03:2021');
    });
  });

  describe('cleanupOldReports', () => {
    test('should remove reports older than retention period', async () => {
      const oldTime = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago

      fs.readdir.mockResolvedValue([
        { name: 'old-report.json', isFile: () => true },
        { name: 'new-report.json', isFile: () => true },
        { name: 'other-file.txt', isFile: () => true },
      ]);

      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('old-report')) {
          return Promise.resolve({ mtimeMs: oldTime });
        }
        return Promise.resolve({ mtimeMs: Date.now() });
      });

      fs.unlink.mockResolvedValue();

      await reportGenerator.cleanupOldReports();

      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-report.json')
      );
    });

    test('should only clean up report files', async () => {
      fs.readdir.mockResolvedValue([
        { name: 'report.json', isFile: () => true },
        { name: 'report.pdf', isFile: () => true },
        { name: 'other-file.txt', isFile: () => true },
      ]);

      fs.stat.mockResolvedValue({
        mtimeMs: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });

      fs.unlink.mockResolvedValue();

      await reportGenerator.cleanupOldReports();

      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('report.json')
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('report.pdf')
      );
    });

    test('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory read failed'));

      // Should not throw
      await expect(reportGenerator.cleanupOldReports()).resolves.not.toThrow();
    });
  });

  describe('getReportPath', () => {
    test('should generate unique report paths', () => {
      const path1 = reportGenerator.getReportPath('json');
      const path2 = reportGenerator.getReportPath('json');

      expect(path1).not.toBe(path2);
      expect(path1).toContain('.json');
      expect(path2).toContain('.json');
    });

    test('should handle different formats', () => {
      const jsonPath = reportGenerator.getReportPath('json');
      const pdfPath = reportGenerator.getReportPath('pdf');

      expect(jsonPath).toContain('.json');
      expect(pdfPath).toContain('.pdf');
    });
  });
});
