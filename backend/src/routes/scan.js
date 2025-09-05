import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ScanOrchestrator } from '../services/scanOrchestrator.js';
import { folderRegistry } from '../services/folderRegistry.js';

const router = express.Router();

// Store scan sessions in memory (in production, use a database)
const scanSessions = new Map();

/**
 * POST /api/scan
 * Start a security scan
 */
router.post('/', async (req, res, next) => {
  try {
    const { targetId, selectedTools } = req.body;

    if (!targetId) {
      return res.status(400).json({
        error: {
          message: 'Target ID is required',
        },
      });
    }

    if (
      !selectedTools ||
      !Array.isArray(selectedTools) ||
      selectedTools.length === 0
    ) {
      return res.status(400).json({
        error: {
          message: 'At least one scanning tool must be selected',
        },
      });
    }

    // Create scan ID
    const scanId = uuidv4();

    // Get WebSocket clients from app locals
    const wsClients = req.app.locals.wsClients;

    // Create scan orchestrator
    const orchestrator = new ScanOrchestrator(scanId, wsClients);

    // Check if this is a direct folder scan
    let actualTargetId = targetId;
    if (folderRegistry.isDirectScan(targetId)) {
      // Use the actual folder path for direct scans
      actualTargetId = folderRegistry.getPath(targetId);
      console.log(`Direct folder scan: ${targetId} -> ${actualTargetId}`);
    }

    // Store scan session
    scanSessions.set(scanId, {
      id: scanId,
      targetId,
      actualTargetId,
      selectedTools,
      status: 'running',
      startTime: new Date(),
      orchestrator,
    });

    // Start scan in background
    orchestrator
      .startScan(actualTargetId, selectedTools)
      .then((results) => {
        const session = scanSessions.get(scanId);
        if (session) {
          session.status = 'completed';
          session.endTime = new Date();
          session.results = results;
        }
      })
      .catch((error) => {
        const session = scanSessions.get(scanId);
        if (session) {
          session.status = 'failed';
          session.endTime = new Date();
          session.error = error.message;
        }
      });

    res.json({
      scanId,
      websocketUrl: `/ws/${scanId}`,
      status: 'started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scan/:scanId/results
 * Get scan results
 */
router.get('/:scanId/results', (req, res, next) => {
  try {
    const { scanId } = req.params;
    const session = scanSessions.get(scanId);

    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Scan not found',
        },
      });
    }

    res.json({
      scanId: session.id,
      status: session.status,
      targetId: session.targetId,
      selectedTools: session.selectedTools,
      startTime: session.startTime,
      endTime: session.endTime,
      results: session.results || [],
      error: session.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scan/:scanId/report/:format
 * Download scan report
 */
router.get('/:scanId/report/:format', async (req, res, next) => {
  try {
    const { scanId, format } = req.params;
    const session = scanSessions.get(scanId);

    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Scan not found',
        },
      });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({
        error: {
          message: 'Scan is not completed yet',
        },
      });
    }

    // Import report generator
    const { ReportGeneratorService } = await import(
      '../services/reportGenerator.js'
    );
    const reportGenerator = new ReportGeneratorService();

    if (format === 'json') {
      try {
        // Generate JSON report
        const report = reportGenerator.generateJSONReport(session);
        const jsonString = JSON.stringify(report, null, 2);
        const buffer = Buffer.from(jsonString, 'utf8');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="security-scan-${scanId}.json"`
        );
        res.setHeader('Cache-Control', 'no-cache');
        res.send(buffer);
      } catch (jsonError) {
        console.error('JSON report generation failed:', jsonError);
        return res.status(500).json({
          error: {
            message: 'Failed to generate JSON report',
            details: jsonError.message,
          },
        });
      }
    } else if (format === 'pdf') {
      try {
        // Generate PDF report
        const pdfBuffer = await reportGenerator.generatePDFReport(session);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="security-scan-${scanId}.pdf"`
        );
        res.setHeader('Cache-Control', 'no-cache');
        res.send(pdfBuffer);
      } catch (pdfError) {
        console.error('PDF report generation failed:', pdfError);
        return res.status(500).json({
          error: {
            message: 'Failed to generate PDF report',
            details: pdfError.message,
          },
        });
      }
    } else {
      res.status(400).json({
        error: {
          message: 'Invalid report format. Use "json" or "pdf"',
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
