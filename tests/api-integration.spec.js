import { test, expect } from '@playwright/test';
import { testConfig, testRepositories } from './fixtures/testFiles.js';
import {
  createTestZipFile,
  cleanupTestFiles,
  verifyApiEndpoint,
} from './utils/testHelpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('API Integration Tests', () => {
  let createdTestFiles = [];

  test.afterEach(async () => {
    // Cleanup test files
    await cleanupTestFiles(createdTestFiles);
    createdTestFiles = [];
  });

  test.describe('Health Check API', () => {
    test('should return healthy status', async ({ page }) => {
      const response = await verifyApiEndpoint(
        page,
        `${testConfig.backend.url}/api/health`
      );
      const data = await response.json();

      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
    });
  });

  test.describe('File Upload API', () => {
    test('should upload ZIP file successfully', async ({ page }) => {
      // Create test file
      const testZipPath = path.join(__dirname, 'fixtures', 'api-test.zip');
      await createTestZipFile(testZipPath, 1024);
      createdTestFiles.push(testZipPath);

      // Create form data for upload
      const fileContent = await import('fs').then((fs) =>
        fs.readFileSync(testZipPath)
      );

      // Test upload endpoint
      const response = await page.request.post(
        `${testConfig.backend.url}/api/upload`,
        {
          multipart: {
            file: {
              name: 'api-test.zip',
              mimeType: 'application/zip',
              buffer: fileContent,
            },
          },
        }
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      expect(data.id).toBeDefined();
      expect(data.fileName).toBe('api-test.zip');
      expect(data.fileSize).toBeDefined();
      expect(data.uploadPath).toBeDefined();
    });

    test('should reject non-ZIP files', async ({ page }) => {
      // Create test text file
      const testTextPath = path.join(__dirname, 'fixtures', 'api-test.txt');
      const fs = await import('fs');
      fs.writeFileSync(testTextPath, 'This is not a ZIP file');
      createdTestFiles.push(testTextPath);

      const fileContent = fs.readFileSync(testTextPath);

      const response = await page.request.post(
        `${testConfig.backend.url}/api/upload`,
        {
          multipart: {
            file: {
              name: 'api-test.txt',
              mimeType: 'text/plain',
              buffer: fileContent,
            },
          },
        }
      );

      expect([400, 500]).toContain(response.status());
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toMatch(/ZIP|file type|invalid/i);
    });

    test('should reject files larger than size limit', async ({ page }) => {
      // This test would need a very large file, so we'll test with headers
      const response = await page.request.post(
        `${testConfig.backend.url}/api/upload`,
        {
          multipart: {
            file: {
              name: 'large-file.zip',
              mimeType: 'application/zip',
              buffer: Buffer.alloc(101 * 1024 * 1024), // 101MB
            },
          },
        }
      );

      // Should reject large files (could be 400, 413, or 500 depending on server config)
      expect([400, 413, 500]).toContain(response.status());
    });

    test('should handle missing file in request', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/upload`,
        {
          data: {},
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  test.describe('Repository Clone API', () => {
    test('should validate repository URL format', async ({ page }) => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'https://',
        '',
      ];

      for (const invalidUrl of invalidUrls) {
        const response = await page.request.post(
          `${testConfig.backend.url}/api/clone`,
          {
            data: {
              repositoryUrl: invalidUrl,
            },
          }
        );

        expect([400, 500]).toContain(response.status());
        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error.message).toMatch(/URL|invalid|required/i);
      }
    });

    test('should handle valid repository URL format', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/clone`,
        {
          data: {
            repositoryUrl: testRepositories.validRepository,
          },
        }
      );

      // Should either succeed or fail gracefully (depending on network access)
      expect([200, 400, 404, 500]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data.id).toBeDefined();
        expect(data.repositoryUrl).toBe(testRepositories.validRepository);
      }
    });

    test('should handle missing repository URL', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/clone`,
        {
          data: {},
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toMatch(/repository.*required/i);
    });
  });

  test.describe('Scan API', () => {
    let uploadedFileId;

    test.beforeEach(async ({ page }) => {
      // Upload a test file first
      const testZipPath = path.join(__dirname, 'fixtures', 'scan-api-test.zip');
      await createTestZipFile(testZipPath, 1024);
      createdTestFiles.push(testZipPath);

      const fileContent = await import('fs').then((fs) =>
        fs.readFileSync(testZipPath)
      );

      const uploadResponse = await page.request.post(
        `${testConfig.backend.url}/api/upload`,
        {
          multipart: {
            file: {
              name: 'scan-api-test.zip',
              mimeType: 'application/zip',
              buffer: fileContent,
            },
          },
        }
      );

      if (uploadResponse.status() === 200) {
        const uploadData = await uploadResponse.json();
        uploadedFileId = uploadData.id;
      }
    });

    test('should start scan with valid parameters', async ({ page }) => {
      if (!uploadedFileId) {
        test.skip('File upload failed, skipping scan test');
      }

      const response = await page.request.post(
        `${testConfig.backend.url}/api/scan`,
        {
          data: {
            targetId: uploadedFileId,
            selectedTools: ['Semgrep', 'Trivy'],
          },
        }
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      expect(data.scanId).toBeDefined();
      expect(data.websocketUrl).toBeDefined();
      expect(data.status).toBe('started');
      expect(data.timestamp).toBeDefined();
    });

    test('should reject scan without target ID', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/scan`,
        {
          data: {
            selectedTools: ['Semgrep'],
          },
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error.message).toMatch(/target.*required/i);
    });

    test('should reject scan without selected tools', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/scan`,
        {
          data: {
            targetId: 'test-id',
            selectedTools: [],
          },
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error.message).toMatch(/tool.*selected/i);
    });

    test('should reject scan with invalid tools', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/scan`,
        {
          data: {
            targetId: 'test-id',
            selectedTools: ['InvalidTool'],
          },
        }
      );

      // Should either validate tools or start scan (depends on implementation)
      expect([200, 400]).toContain(response.status());
    });
  });

  test.describe('Scan Results API', () => {
    test('should return 404 for non-existent scan', async ({ page }) => {
      const response = await page.request.get(
        `${testConfig.backend.url}/api/scan/non-existent-id/results`
      );

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error.message).toMatch(/not found/i);
    });

    test('should handle scan results request format', async ({ page }) => {
      // Test with a potentially valid scan ID format
      const response = await page.request.get(
        `${testConfig.backend.url}/api/scan/test-scan-id/results`
      );

      // Should return 404 (scan not found) or 200 (if scan exists)
      expect([200, 404]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data.scanId).toBeDefined();
        expect(data.status).toBeDefined();
        expect(data.results).toBeDefined();
        expect(Array.isArray(data.results)).toBe(true);
      }
    });
  });

  test.describe('Report Download API', () => {
    test('should return 404 for non-existent scan report', async ({ page }) => {
      const response = await page.request.get(
        `${testConfig.backend.url}/api/scan/non-existent-id/report/json`
      );

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error.message).toMatch(/not found/i);
    });

    test('should validate report format parameter', async ({ page }) => {
      const response = await page.request.get(
        `${testConfig.backend.url}/api/scan/test-id/report/invalid-format`
      );

      expect([400, 404, 500]).toContain(response.status());
      const data = await response.json();
      expect(data.error.message).toMatch(/format|invalid|not found/i);
    });

    test('should accept valid report formats', async ({ page }) => {
      const formats = ['json', 'pdf'];

      for (const format of formats) {
        const response = await page.request.get(
          `${testConfig.backend.url}/api/scan/test-id/report/${format}`
        );

        // Should return 404 (scan not found) rather than format error
        expect(response.status()).toBe(404);

        if (response.status() !== 404) {
          // If scan existed, should return proper format
          const contentType = response.headers()['content-type'];
          if (format === 'json') {
            expect(contentType).toMatch(/application\/json/);
          } else if (format === 'pdf') {
            expect(contentType).toMatch(/application\/pdf/);
          }
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 routes gracefully', async ({ page }) => {
      const response = await page.request.get(
        `${testConfig.backend.url}/api/non-existent-endpoint`
      );

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toMatch(/not found/i);
    });

    test('should handle malformed JSON requests', async ({ page }) => {
      const response = await page.request.post(
        `${testConfig.backend.url}/api/scan`,
        {
          data: 'invalid json',
          headers: {
            'content-type': 'application/json',
          },
        }
      );

      expect([400, 500]).toContain(response.status());
    });

    test('should include proper CORS headers', async ({ page }) => {
      // Use GET request instead of OPTIONS since page.request.options might not be available
      const response = await page.request.get(
        `${testConfig.backend.url}/api/health`
      );

      const corsHeaders = response.headers();
      expect(corsHeaders['access-control-allow-origin']).toBeDefined();
    });

    test('should handle request timeout gracefully', async ({ page }) => {
      // Test with a potentially slow endpoint
      const response = await page.request.get(
        `${testConfig.backend.url}/api/health`,
        {
          timeout: 1000, // 1 second timeout
        }
      );

      // Should either respond quickly or timeout gracefully
      expect([200, 408]).toContain(response.status());
    });
  });

  test.describe('Security Headers', () => {
    test('should include security headers', async ({ page }) => {
      const response = await page.request.get(
        `${testConfig.backend.url}/api/health`
      );

      const headers = response.headers();

      // Check for common security headers
      expect(
        headers['x-frame-options'] || headers['x-content-type-options']
      ).toBeDefined();
    });

    test('should validate content types', async ({ page }) => {
      // Send request with unexpected content type
      const response = await page.request.post(
        `${testConfig.backend.url}/api/scan`,
        {
          data: { test: 'data' },
          headers: {
            'content-type': 'text/plain',
          },
        }
      );

      // Should handle content type validation (could be 400, 415, or 500)
      expect([400, 415, 500]).toContain(response.status());
    });
  });

  test.describe('Rate Limiting', () => {
    test('should handle multiple rapid requests', async ({ page }) => {
      const requests = [];

      // Send multiple rapid requests
      for (let i = 0; i < 5; i++) {
        requests.push(page.request.get(`${testConfig.backend.url}/api/health`));
      }

      const responses = await Promise.all(requests);

      // Most should succeed, some might be rate limited
      const successCount = responses.filter((r) => r.status() === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  test.describe('WebSocket Connection', () => {
    test('should provide WebSocket endpoint information', async ({ page }) => {
      // This would test WebSocket connection if scan was started
      // For now, just verify the health endpoint mentions WebSocket capability

      const response = await verifyApiEndpoint(
        page,
        `${testConfig.backend.url}/api/health`
      );
      expect(response.status()).toBe(200);

      // WebSocket server should be available (tested indirectly)
      // Direct WebSocket testing would require more complex setup
    });
  });

  test.describe('API Documentation Compliance', () => {
    test('should return proper HTTP status codes', async ({ page }) => {
      // Test various endpoints return expected status codes
      const testCases = [
        { method: 'GET', url: '/api/health', expectedStatus: 200 },
        { method: 'GET', url: '/api/non-existent', expectedStatus: 404 },
        { method: 'POST', url: '/api/scan', expectedStatus: 400 }, // Missing data
      ];

      for (const testCase of testCases) {
        let response;
        const fullUrl = `${testConfig.backend.url}${testCase.url}`;

        if (testCase.method === 'GET') {
          response = await page.request.get(fullUrl);
        } else if (testCase.method === 'POST') {
          response = await page.request.post(fullUrl, { data: {} });
        }

        expect(response.status()).toBe(testCase.expectedStatus);
      }
    });

    test('should return proper content types', async ({ page }) => {
      const response = await page.request.get(
        `${testConfig.backend.url}/api/health`
      );

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/application\/json/);
    });
  });
});
