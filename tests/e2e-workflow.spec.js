import { test, expect } from '@playwright/test';
import { SecurityScannerPage } from './pages/SecurityScannerPage.js';
import { testRepositories, mockScanResults } from './fixtures/testFiles.js';
import {
  createTestZipFile,
  cleanupTestFiles,
  takeTimestampedScreenshot,
  mockApiResponse,
} from './utils/testHelpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('End-to-End Workflow Tests', () => {
  let securityScannerPage;
  let createdTestFiles = [];

  test.beforeEach(async ({ page }) => {
    securityScannerPage = new SecurityScannerPage(page);
    await securityScannerPage.goto();
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await takeTimestampedScreenshot(page, `e2e-failure-${testInfo.title}`);
    }

    await cleanupTestFiles(createdTestFiles);
    createdTestFiles = [];
  });

  test('complete file upload to results workflow', async ({ page }) => {
    // Create test file
    const testZipPath = path.join(__dirname, 'fixtures', 'e2e-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    // Mock all API responses
    await mockApiResponse(page, '**/api/upload', {
      id: 'e2e-upload-id',
      fileName: 'e2e-test.zip',
      fileSize: 1024,
    });

    await mockApiResponse(page, '**/api/scan', {
      scanId: 'e2e-scan-id',
      websocketUrl: '/ws/e2e-scan-id',
      status: 'started',
      timestamp: new Date().toISOString(),
    });

    const combinedResults = [
      ...mockScanResults.semgrep,
      ...mockScanResults.trivy,
    ];
    await mockApiResponse(page, '**/api/scan/e2e-scan-id/results', {
      scanId: 'e2e-scan-id',
      status: 'completed',
      results: combinedResults,
    });

    // Step 1: Upload file
    await securityScannerPage.verifyInitialState();
    await securityScannerPage.uploadFile(testZipPath);

    // Step 2: Select scanners
    await securityScannerPage.verifyScannerSelectionState('e2e-test.zip');
    await securityScannerPage.selectScanners(['Semgrep', 'Trivy']);

    // Step 3: Start scan and monitor progress
    await securityScannerPage.startScan();
    await securityScannerPage.verifyScanProgressState();

    // Step 4: View results
    await securityScannerPage.waitForScanCompletion();
    await securityScannerPage.verifyScanResultsState();

    // Step 5: Verify results content
    const stats = await securityScannerPage.getScanResultsStats();
    expect(stats.totalissues || stats.total).toBeGreaterThan(0);

    // Step 6: Test new scan
    await securityScannerPage.startNewScan();
    await securityScannerPage.verifyInitialState();
  });

  test('complete repository URL to results workflow', async ({ page }) => {
    // Mock all API responses
    await mockApiResponse(page, '**/api/clone', {
      id: 'e2e-repo-id',
      repositoryUrl: testRepositories.validRepository,
      clonePath: '/tmp/e2e-repo',
    });

    await mockApiResponse(page, '**/api/scan', {
      scanId: 'e2e-repo-scan-id',
      websocketUrl: '/ws/e2e-repo-scan-id',
      status: 'started',
      timestamp: new Date().toISOString(),
    });

    await mockApiResponse(page, '**/api/scan/e2e-repo-scan-id/results', {
      scanId: 'e2e-repo-scan-id',
      status: 'completed',
      results: mockScanResults.semgrep,
    });

    // Step 1: Submit repository URL
    await securityScannerPage.verifyInitialState();
    await securityScannerPage.submitRepositoryUrl(
      testRepositories.validRepository
    );

    // Step 2: Select scanners
    await securityScannerPage.verifyScannerSelectionState(
      testRepositories.validRepository
    );
    await securityScannerPage.selectScanners(['Semgrep']);

    // Step 3: Start scan and complete workflow
    await securityScannerPage.startScan();
    await securityScannerPage.verifyScanProgressState();
    await securityScannerPage.waitForScanCompletion();
    await securityScannerPage.verifyScanResultsState();
  });

  test('multiple workflow iterations', async ({ page }) => {
    // Test running multiple scans in sequence
    for (let i = 0; i < 2; i++) {
      const testZipPath = path.join(
        __dirname,
        'fixtures',
        `multi-test-${i}.zip`
      );
      await createTestZipFile(testZipPath, 1024);
      createdTestFiles.push(testZipPath);

      // Mock responses for this iteration
      await mockApiResponse(page, '**/api/upload', {
        id: `multi-upload-id-${i}`,
        fileName: `multi-test-${i}.zip`,
        fileSize: 1024,
      });

      await mockApiResponse(page, '**/api/scan', {
        scanId: `multi-scan-id-${i}`,
        websocketUrl: `/ws/multi-scan-id-${i}`,
        status: 'started',
        timestamp: new Date().toISOString(),
      });

      await mockApiResponse(page, `**/api/scan/multi-scan-id-${i}/results`, {
        scanId: `multi-scan-id-${i}`,
        status: 'completed',
        results: mockScanResults.semgrep,
      });

      // Run workflow
      await securityScannerPage.uploadFile(testZipPath);
      await securityScannerPage.selectScanners(['Semgrep']);
      await securityScannerPage.startScan();
      await securityScannerPage.waitForScanCompletion();

      // Start new scan for next iteration
      if (i < 1) {
        await securityScannerPage.startNewScan();
      }
    }
  });

  test('error recovery workflow', async ({ page }) => {
    const testZipPath = path.join(__dirname, 'fixtures', 'error-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    // Mock failed upload first
    await page.route('**/api/upload', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Upload failed' } }),
      });
    });

    // Try upload and handle error
    await securityScannerPage.fileInput.setInputFiles(testZipPath);
    await securityScannerPage.waitForToast('Failed to upload file', 'error');

    // Should remain on upload page
    await securityScannerPage.verifyInitialState();

    // Now mock successful upload
    await mockApiResponse(page, '**/api/upload', {
      id: 'recovery-upload-id',
      fileName: 'error-test.zip',
      fileSize: 1024,
    });

    // Try upload again - should succeed
    await securityScannerPage.uploadFile(testZipPath);
    await securityScannerPage.verifyScannerSelectionState('error-test.zip');
  });

  test('browser back/forward navigation', async ({ page }) => {
    const testZipPath = path.join(__dirname, 'fixtures', 'nav-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    await mockApiResponse(page, '**/api/upload', {
      id: 'nav-upload-id',
      fileName: 'nav-test.zip',
      fileSize: 1024,
    });

    // Navigate through workflow
    await securityScannerPage.uploadFile(testZipPath);
    await securityScannerPage.verifyScannerSelectionState('nav-test.zip');

    // Test browser back button (if application supports it)
    await page.goBack();

    // Should either go back to upload or handle gracefully
    const onUploadPage = await securityScannerPage.dropzone
      .isVisible()
      .catch(() => false);
    const onSelectionPage = await securityScannerPage.startScanButton
      .isVisible()
      .catch(() => false);

    expect(onUploadPage || onSelectionPage).toBe(true);
  });

  test('workflow with different scanner combinations', async ({ page }) => {
    const scannerCombinations = [
      ['Semgrep'],
      ['Trivy'],
      ['Semgrep', 'Trivy'],
      ['Semgrep', 'Trivy', 'OWASP Dependency Check'],
    ];

    for (let i = 0; i < scannerCombinations.length; i++) {
      const testZipPath = path.join(
        __dirname,
        'fixtures',
        `combo-test-${i}.zip`
      );
      await createTestZipFile(testZipPath, 1024);
      createdTestFiles.push(testZipPath);

      const scanners = scannerCombinations[i];

      // Mock responses
      await mockApiResponse(page, '**/api/upload', {
        id: `combo-upload-id-${i}`,
        fileName: `combo-test-${i}.zip`,
        fileSize: 1024,
      });

      await mockApiResponse(page, '**/api/scan', {
        scanId: `combo-scan-id-${i}`,
        websocketUrl: `/ws/combo-scan-id-${i}`,
        status: 'started',
        timestamp: new Date().toISOString(),
      });

      await mockApiResponse(page, `**/api/scan/combo-scan-id-${i}/results`, {
        scanId: `combo-scan-id-${i}`,
        status: 'completed',
        results: mockScanResults.semgrep.slice(0, scanners.length),
      });

      // Run workflow with specific scanner combination
      await securityScannerPage.uploadFile(testZipPath);
      await securityScannerPage.selectScanners(scanners);
      await securityScannerPage.startScan();
      await securityScannerPage.waitForScanCompletion(60000); // Longer timeout for multiple tools

      // Verify results
      const stats = await securityScannerPage.getScanResultsStats();
      expect(stats.totalissues || stats.total).toBeGreaterThanOrEqual(0);

      // Start new scan for next iteration
      if (i < scannerCombinations.length - 1) {
        await securityScannerPage.startNewScan();
      }
    }
  });

  test('workflow performance and responsiveness', async ({ page }) => {
    // Test workflow under various conditions
    const testZipPath = path.join(__dirname, 'fixtures', 'perf-test.zip');
    await createTestZipFile(testZipPath, 5 * 1024 * 1024); // 5MB file
    createdTestFiles.push(testZipPath);

    // Mock responses with some delay
    await page.route('**/api/upload', (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'perf-upload-id',
            fileName: 'perf-test.zip',
            fileSize: 5 * 1024 * 1024,
          }),
        });
      }, 1000); // 1 second delay
    });

    await mockApiResponse(page, '**/api/scan', {
      scanId: 'perf-scan-id',
      websocketUrl: '/ws/perf-scan-id',
      status: 'started',
      timestamp: new Date().toISOString(),
    });

    // Measure upload time
    const uploadStart = Date.now();
    await securityScannerPage.uploadFile(testZipPath);
    const uploadTime = Date.now() - uploadStart;

    // Upload should complete within reasonable time
    expect(uploadTime).toBeLessThan(30000); // 30 seconds max

    // Continue with workflow
    await securityScannerPage.selectScanners(['Semgrep']);
    await securityScannerPage.startScan();

    // UI should remain responsive during scan
    await expect(securityScannerPage.newScanButton).toBeVisible();
  });
});
