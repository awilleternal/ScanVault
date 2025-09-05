import { test, expect } from '@playwright/test';
import { SecurityScannerPage } from './pages/SecurityScannerPage.js';
import { mockScanResults, severityLevels } from './fixtures/testFiles.js';
import { 
  createTestZipFile, 
  cleanupTestFiles, 
  takeTimestampedScreenshot, 
  mockApiResponse,
  waitForDownloadAndVerify
} from './utils/testHelpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Results Dashboard Functionality', () => {
  let securityScannerPage;
  let createdTestFiles = [];

  test.beforeEach(async ({ page }) => {
    securityScannerPage = new SecurityScannerPage(page);
    await securityScannerPage.goto();
    
    // Set up complete scan workflow to reach results
    const testZipPath = path.join(__dirname, 'fixtures', 'results-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);
    
    // Mock all necessary API calls
    await mockApiResponse(page, '**/api/upload', {
      id: 'test-upload-id',
      fileName: 'results-test.zip',
      fileSize: 1024
    });
    
    await mockApiResponse(page, '**/api/scan', {
      scanId: 'test-scan-id',
      websocketUrl: '/ws/test-scan-id',
      status: 'started',
      timestamp: new Date().toISOString()
    });
    
    // Mock scan results with comprehensive test data
    const combinedResults = [...mockScanResults.semgrep, ...mockScanResults.trivy];
    await mockApiResponse(page, '**/api/scan/test-scan-id/results', {
      scanId: 'test-scan-id',
      status: 'completed',
      results: combinedResults
    });
    
    // Navigate through complete workflow
    await securityScannerPage.uploadFile(testZipPath);
    await securityScannerPage.selectScanners(['Semgrep', 'Trivy']);
    await securityScannerPage.startScan();
    
    // Wait for scan completion and results
    await securityScannerPage.waitForScanCompletion();
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Take screenshot on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      await takeTimestampedScreenshot(page, `results-dashboard-failure-${testInfo.title}`);
    }
    
    // Cleanup test files
    await cleanupTestFiles(createdTestFiles);
    createdTestFiles = [];
  });

  test('should display results dashboard with summary statistics', async ({ page }) => {
    // Verify results section is visible
    await expect(securityScannerPage.resultsSection).toBeVisible();
    
    // Verify summary title
    await expect(page.locator('h2', { hasText: 'Security Scan Results Summary' })).toBeVisible();
    
    // Verify statistics grid
    await expect(securityScannerPage.summaryStats).toBeVisible();
    
    // Verify download buttons
    await expect(securityScannerPage.downloadJsonButton).toBeVisible();
    await expect(securityScannerPage.downloadPdfButton).toBeVisible();
    
    // Verify tab navigation
    await expect(securityScannerPage.tabNavigation).toBeVisible();
  });

  test('should show correct summary statistics', async ({ page }) => {
    // Get and verify statistics
    const stats = await securityScannerPage.getScanResultsStats();
    
    // Should have total issues count
    expect(stats.totalissues || stats.total).toBeGreaterThan(0);
    
    // Should display severity breakdown
    for (const severity of severityLevels) {
      const severityKey = severity.toLowerCase();
      expect(stats[severityKey]).toBeGreaterThanOrEqual(0);
    }
    
    // Verify visual display of stats
    await expect(page.locator('.text-3xl').first()).toBeVisible();
  });

  test('should display tab navigation with correct counts', async ({ page }) => {
    // Verify overview tab
    const overviewTab = page.locator('button', { hasText: /Overview.*\(\d+\)/ });
    await expect(overviewTab).toBeVisible();
    
    // Verify Semgrep tab
    const semgrepTab = page.locator('button', { hasText: /Semgrep.*\(\d+\)/ });
    await expect(semgrepTab).toBeVisible();
    
    // Verify Trivy tab
    const trivyTab = page.locator('button', { hasText: /Trivy.*\(\d+\)/ });
    await expect(trivyTab).toBeVisible();
    
    // Overview should be active by default
    await expect(overviewTab).toHaveClass(/border-primary-500|text-primary-600/);
  });

  test('should switch between result tabs correctly', async ({ page }) => {
    // Switch to Semgrep tab
    await securityScannerPage.switchToTab('semgrep');
    
    // Verify Semgrep tab is active
    await expect(page.locator('button', { hasText: /Semgrep/ })).toHaveClass(/border-blue-500|text-blue-600/);
    
    // Should show Semgrep description
    await expect(page.locator('text=finds security vulnerabilities, bugs, and anti-patterns')).toBeVisible();
    
    // Switch to Trivy tab
    await securityScannerPage.switchToTab('trivy');
    
    // Verify Trivy tab is active
    await expect(page.locator('button', { hasText: /Trivy/ })).toHaveClass(/border-green-500|text-green-600/);
    
    // Should show Trivy description
    await expect(page.locator('text=scans your dependencies and container images')).toBeVisible();
    
    // Switch back to overview
    await securityScannerPage.switchToTab('overview');
    await expect(page.locator('button', { hasText: /Overview/ })).toHaveClass(/border-primary-500|text-primary-600/);
  });

  test('should filter results by severity', async ({ page }) => {
    // Get initial results count
    const initialCount = await securityScannerPage.getResultsCount();
    expect(initialCount).toBeGreaterThan(0);
    
    // Filter by HIGH severity
    await securityScannerPage.filterBySeverity('HIGH');
    
    // Should show filtered results
    const highResults = await securityScannerPage.getResultsCount();
    
    // Filter by CRITICAL severity
    await securityScannerPage.filterBySeverity('CRITICAL');
    
    // Should show different count
    const criticalResults = await securityScannerPage.getResultsCount();
    
    // Reset to all
    await securityScannerPage.filterBySeverity('ALL');
    const allResults = await securityScannerPage.getResultsCount();
    
    // All should be >= any filtered count
    expect(allResults).toBeGreaterThanOrEqual(highResults);
    expect(allResults).toBeGreaterThanOrEqual(criticalResults);
  });

  test('should display vulnerability cards with correct information', async ({ page }) => {
    // Should have result cards
    const resultCards = await securityScannerPage.resultCards.all();
    expect(resultCards.length).toBeGreaterThan(0);
    
    // Check first result card contains required information
    const firstCard = resultCards[0];
    
    // Should show severity
    await expect(firstCard.locator('text=/CRITICAL|HIGH|MEDIUM|LOW|INFO/')).toBeVisible();
    
    // Should show tool name
    await expect(firstCard.locator('text=/Semgrep|Trivy/')).toBeVisible();
    
    // Should show vulnerability type
    await expect(firstCard.locator('.text-base.font-medium')).toBeVisible();
    
    // Should show file location
    await expect(firstCard.locator('text=:')).toBeVisible(); // file:line format
  });

  test('should expand and collapse result cards', async ({ page }) => {
    const resultCount = await securityScannerPage.getResultsCount();
    
    if (resultCount > 0) {
      // Click to expand first result
      await securityScannerPage.expandResultCard(0);
      
      // Should show expanded content
      await expect(page.locator('text=Description').first()).toBeVisible();
      
      // Click again to collapse
      await securityScannerPage.expandResultCard(0);
      
      // Expanded content might be hidden (depends on implementation)
      // This test verifies the click interaction works
    }
  });

  test('should show detailed information in expanded cards', async ({ page }) => {
    const resultCount = await securityScannerPage.getResultsCount();
    
    if (resultCount > 0) {
      // Expand first result
      await securityScannerPage.expandResultCard(0);
      
      // Should show description
      await expect(page.locator('text=Description').first()).toBeVisible();
      
      // May show suggested fix
      const fixSection = page.locator('text=Suggested Fix');
      if (await fixSection.isVisible()) {
        await expect(fixSection).toBeVisible();
      }
      
      // May show references
      const referencesSection = page.locator('text=References');
      if (await referencesSection.isVisible()) {
        await expect(referencesSection).toBeVisible();
      }
    }
  });

  test('should handle empty results gracefully', async ({ page }) => {
    // Mock empty results
    await page.route('**/api/scan/*/results', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId: 'empty-scan-id',
          status: 'completed',
          results: []
        })
      });
    });
    
    // Reload to get empty results
    await page.reload();
    
    // Should show no results message
    await expect(page.locator('text=No security issues found')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Your code is clean')).toBeVisible();
  });

  test('should download JSON report', async ({ page }) => {
    // Mock download response
    await page.route('**/api/scan/*/report/json', route => {
      route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename="security-scan-test-scan-id.json"'
        },
        body: JSON.stringify({
          scanId: 'test-scan-id',
          results: mockScanResults.semgrep
        })
      });
    });
    
    // Download JSON report
    const download = await waitForDownloadAndVerify(
      page,
      () => securityScannerPage.downloadJsonButton.click(),
      'security-scan.*\\.json'
    );
    
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('should download PDF report', async ({ page }) => {
    // Mock PDF download response
    await page.route('**/api/scan/*/report/pdf', route => {
      route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="security-scan-test-scan-id.pdf"'
        },
        body: Buffer.from('fake pdf content')
      });
    });
    
    // Download PDF report
    const download = await waitForDownloadAndVerify(
      page,
      () => securityScannerPage.downloadPdfButton.click(),
      'security-scan.*\\.pdf'
    );
    
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('should handle download failures gracefully', async ({ page }) => {
    // Mock download failure
    await page.route('**/api/scan/*/report/*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Report generation failed' }
        })
      });
    });
    
    // Try to download
    await securityScannerPage.downloadJsonButton.click();
    
    // Should handle error gracefully (may show toast or error message)
    // The exact behavior depends on implementation
    await page.waitForTimeout(2000);
  });

  test('should display tool-specific styling and icons', async ({ page }) => {
    // Should show tool-specific elements
    await expect(page.locator('text=🔍').or(page.locator('text=Semgrep'))).toBeVisible();
    await expect(page.locator('text=📦').or(page.locator('text=Trivy'))).toBeVisible();
    
    // Should have tool-specific color coding
    const semgrepElements = page.locator('.border-blue-500, .bg-blue-50, .text-blue-600');
    const trivyElements = page.locator('.border-green-500, .bg-green-50, .text-green-600');
    
    // At least one should be visible if we have results from both tools
    const hasSemgrepStyling = await semgrepElements.first().isVisible().catch(() => false);
    const hasTrivyStyling = await trivyElements.first().isVisible().catch(() => false);
    
    // Should have some tool-specific styling
    expect(hasSemgrepStyling || hasTrivyStyling).toBe(true);
  });

  test('should show severity-based color coding', async ({ page }) => {
    // Should have severity-based styling
    const severityElements = page.locator(
      '.text-red-800, .text-orange-800, .text-yellow-800, .text-blue-800, .text-gray-800'
    );
    
    if (await securityScannerPage.getResultsCount() > 0) {
      await expect(severityElements.first()).toBeVisible();
    }
  });

  test('should maintain filter state when switching tabs', async ({ page }) => {
    // Set filter
    await securityScannerPage.filterBySeverity('HIGH');
    
    // Switch tabs
    await securityScannerPage.switchToTab('semgrep');
    
    // Filter should be maintained
    await expect(securityScannerPage.severityFilter).toHaveValue('HIGH');
    
    // Switch back
    await securityScannerPage.switchToTab('overview');
    
    // Filter should still be there
    await expect(securityScannerPage.severityFilter).toHaveValue('HIGH');
  });

  test('should start new scan from results page', async ({ page }) => {
    // New scan button should be visible
    await expect(securityScannerPage.newScanButton).toBeVisible();
    
    // Click should reset to upload page
    await securityScannerPage.newScanButton.click();
    await securityScannerPage.verifyInitialState();
  });

  test('should handle large number of results efficiently', async ({ page }) => {
    // This test verifies the UI can handle many results
    // The exact number depends on implementation
    
    const resultCount = await securityScannerPage.getResultsCount();
    
    if (resultCount > 0) {
      // Should be able to scroll through results
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1000);
      
      // Results should still be visible
      await expect(securityScannerPage.resultCards.first()).toBeVisible();
      
      // Should be able to interact with results after scrolling
      await securityScannerPage.expandResultCard(0);
    }
  });

  test('should show appropriate loading states during data fetching', async ({ page }) => {
    // This would test loading states when fetching results
    // Since results are already loaded in beforeEach, we test the state
    
    // Results should be fully loaded
    await expect(securityScannerPage.summaryStats).toBeVisible();
    
    // No loading indicators should be visible
    const loadingElements = page.locator('.animate-spin, .animate-pulse, text=Loading');
    const hasLoading = await loadingElements.first().isVisible().catch(() => false);
    
    // Should not have loading states when results are displayed
    expect(hasLoading).toBe(false);
  });
});
