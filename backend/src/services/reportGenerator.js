import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Service for generating scan reports in various formats
 */
export class ReportGeneratorService {
  constructor() {
    this.reportsDir = process.env.REPORTS_DIR || './reports';
    this.initDirectories();
  }

  /**
   * Initialize reports directory
   */
  async initDirectories() {
    try {
      await fs.promises.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  /**
   * Generate JSON report
   * @param {Object} scanSession - Complete scan session data
   * @returns {Object} JSON report
   */
  generateJSONReport(scanSession) {
    const { results = [] } = scanSession;

    // Calculate summary statistics
    const summary = {
      total: results.length,
      critical: results.filter(r => r.severity === 'CRITICAL').length,
      high: results.filter(r => r.severity === 'HIGH').length,
      medium: results.filter(r => r.severity === 'MEDIUM').length,
      low: results.filter(r => r.severity === 'LOW').length,
      info: results.filter(r => r.severity === 'INFO').length,
    };

    // Group results by tool
    const toolBreakdown = results.reduce((acc, result) => {
      const tool = result.tool || 'Unknown';
      if (!acc[tool]) acc[tool] = 0;
      acc[tool]++;
      return acc;
    }, {});

    // Group results by file
    const fileBreakdown = results.reduce((acc, result) => {
      const file = result.file || 'Unknown';
      if (!acc[file]) acc[file] = [];
      acc[file].push(result);
      return acc;
    }, {});

    return {
      metadata: {
        scanId: scanSession.id,
        targetId: scanSession.targetId,
        timestamp: new Date().toISOString(),
        scanDuration: scanSession.endTime 
          ? scanSession.endTime - scanSession.startTime 
          : null,
        selectedTools: scanSession.selectedTools,
        generatedAt: new Date().toISOString(),
      },
      summary,
      toolBreakdown,
      fileBreakdown: Object.keys(fileBreakdown).map(file => ({
        file,
        issueCount: fileBreakdown[file].length,
        issues: fileBreakdown[file],
      })),
      results: results.map(result => ({
        ...result,
        // Add additional metadata
        foundBy: result.tool,
        category: this.categorizeVulnerability(result.type),
        riskScore: this.calculateRiskScore(result.severity),
      })),
      recommendations: this.generateRecommendations(results),
    };
  }

  /**
   * Generate PDF report
   * @param {Object} scanSession - Complete scan session data
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePDFReport(scanSession) {
    return new Promise((resolve, reject) => {
      try {
        // Validate scan session
        if (!scanSession || !scanSession.id) {
          reject(new Error('Invalid scan session data'));
          return;
        }

        const doc = new PDFDocument({
          margin: 50,
          info: {
            Title: `Security Scan Report - ${scanSession.id}`,
            Author: 'Security Scanner',
            Subject: 'Vulnerability Assessment Report',
            CreationDate: new Date(),
          },
        });

        const buffers = [];
        doc.on('data', buffer => buffers.push(buffer));
        doc.on('end', () => {
          try {
            const finalBuffer = Buffer.concat(buffers);
            if (finalBuffer.length === 0) {
              reject(new Error('Generated PDF is empty'));
              return;
            }
            resolve(finalBuffer);
          } catch (concatError) {
            reject(new Error(`Failed to create PDF buffer: ${concatError.message}`));
          }
        });
        doc.on('error', (error) => {
          reject(new Error(`PDF generation error: ${error.message}`));
        });

        this.generatePDFContent(doc, scanSession);
        doc.end();
      } catch (error) {
        reject(new Error(`Failed to initialize PDF generation: ${error.message}`));
      }
    });
  }

  /**
   * Generate PDF content
   * @param {PDFDocument} doc - PDF document instance
   * @param {Object} scanSession - Scan session data
   */
  generatePDFContent(doc, scanSession) {
    const { results = [] } = scanSession;

    // Title page
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('Security Scan Report', { align: 'center' });

    doc.moveDown();
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Scan ID: ${scanSession.id}`, { align: 'center' })
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.moveDown(2);

    // Executive Summary
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Executive Summary');

    doc.moveDown();
    doc.fontSize(12)
       .font('Helvetica');

    const summary = {
      total: results.length,
      critical: results.filter(r => r.severity === 'CRITICAL').length,
      high: results.filter(r => r.severity === 'HIGH').length,
      medium: results.filter(r => r.severity === 'MEDIUM').length,
      low: results.filter(r => r.severity === 'LOW').length,
    };

    doc.text(`Total Issues Found: ${summary.total}`)
       .text(`Critical: ${summary.critical}`)
       .text(`High: ${summary.high}`)
       .text(`Medium: ${summary.medium}`)
       .text(`Low: ${summary.low}`);

    doc.moveDown();

    // Risk Assessment
    const riskLevel = this.calculateOverallRisk(summary);
    doc.text(`Overall Risk Level: ${riskLevel}`);

    doc.moveDown(2);

    // Tools Used
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Security Tools Used');

    doc.moveDown();
    doc.fontSize(12)
       .font('Helvetica');

    scanSession.selectedTools.forEach(tool => {
      doc.text(`• ${tool}`);
    });

    doc.moveDown(2);

    // Detailed Findings
    if (results.length > 0) {
      doc.addPage();
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Detailed Findings');

      doc.moveDown();

      // Group by severity
      const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      
      severities.forEach(severity => {
        const severityResults = results.filter(r => r.severity === severity);
        
        if (severityResults.length > 0) {
          doc.fontSize(14)
             .font('Helvetica-Bold')
             .text(`${severity} Severity Issues (${severityResults.length})`);

          doc.moveDown();

          severityResults.forEach((result, index) => {
            if (doc.y > 700) { // Start new page if near bottom
              doc.addPage();
            }

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(`${index + 1}. ${result.type}`);

            doc.fontSize(10)
               .font('Helvetica')
               .text(`File: ${result.file}:${result.line}`)
               .text(`Tool: ${result.tool}`)
               .text(`Description: ${result.description}`);

            if (result.fix) {
              doc.text(`Fix: ${result.fix}`);
            }

            doc.moveDown();
          });

          doc.moveDown();
        }
      });
    }

    // Recommendations
    doc.addPage();
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Recommendations');

    doc.moveDown();
    doc.fontSize(12)
       .font('Helvetica');

    const recommendations = this.generateRecommendations(results);
    recommendations.forEach(rec => {
      doc.text(`• ${rec}`);
      doc.moveDown(0.5);
    });
  }

  /**
   * Categorize vulnerability type
   * @param {string} type - Vulnerability type
   * @returns {string} Category
   */
  categorizeVulnerability(type) {
    const categories = {
      'SQL Injection': 'Injection',
      'XSS': 'Injection',
      'CSRF': 'Authentication',
      'Hardcoded Secret': 'Sensitive Data',
      'Vulnerable Dependency': 'Dependencies',
      'Outdated Package': 'Dependencies',
      'License Risk': 'Legal',
    };

    return categories[type] || 'Other';
  }

  /**
   * Calculate risk score based on severity
   * @param {string} severity - Vulnerability severity
   * @returns {number} Risk score (1-10)
   */
  calculateRiskScore(severity) {
    const scores = {
      'CRITICAL': 10,
      'HIGH': 8,
      'MEDIUM': 5,
      'LOW': 3,
      'INFO': 1,
    };

    return scores[severity] || 1;
  }

  /**
   * Calculate overall risk level
   * @param {Object} summary - Vulnerability summary
   * @returns {string} Overall risk level
   */
  calculateOverallRisk(summary) {
    if (summary.critical > 0) return 'CRITICAL';
    if (summary.high > 3) return 'HIGH';
    if (summary.high > 0 || summary.medium > 5) return 'MEDIUM';
    if (summary.medium > 0 || summary.low > 10) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Generate actionable recommendations
   * @param {Array} results - Scan results
   * @returns {Array} Recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];

    // Check for common patterns
    const hasCritical = results.some(r => r.severity === 'CRITICAL');
    const hasInjection = results.some(r => r.type.includes('Injection'));
    const hasOutdatedDeps = results.some(r => r.type.includes('Outdated') || r.type.includes('Vulnerable'));
    const hasSecrets = results.some(r => r.type.includes('Secret') || r.type.includes('Hardcoded'));

    if (hasCritical) {
      recommendations.push('Address all CRITICAL severity issues immediately before deployment');
    }

    if (hasInjection) {
      recommendations.push('Implement input validation and use parameterized queries to prevent injection attacks');
    }

    if (hasOutdatedDeps) {
      recommendations.push('Update all dependencies to their latest secure versions');
      recommendations.push('Consider using automated dependency update tools like Dependabot');
    }

    if (hasSecrets) {
      recommendations.push('Move all secrets to environment variables or secure vaults');
      recommendations.push('Implement secret scanning in your CI/CD pipeline');
    }

    // General recommendations
    recommendations.push('Integrate security scanning into your development workflow');
    recommendations.push('Regular security scans should be performed on all code changes');
    recommendations.push('Consider implementing security training for your development team');

    return recommendations;
  }
}
