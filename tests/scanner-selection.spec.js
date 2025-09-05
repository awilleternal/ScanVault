import { test, expect } from '@playwright/test';
import { SecurityScannerPage } from './pages/SecurityScannerPage.js';
import { expectedScannerTools, testFiles } from './fixtures/testFiles.js';
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

test.describe('Scanner Selection Workflow', () => {
  let securityScannerPage;
  let createdTestFiles = [];

  test.beforeEach(async ({ page }) => {
    securityScannerPage = new SecurityScannerPage(page);
    await securityScannerPage.goto();

    // Set up a file upload to reach scanner selection
    const testZipPath = path.join(__dirname, 'fixtures', 'scanner-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    // Mock successful upload
    await mockApiResponse(page, '**/api/upload', {
      id: 'test-upload-id',
      fileName: 'scanner-test.zip',
      fileSize: 1024,
      uploadPath: '/tmp/scanner-test.zip',
    });

    await securityScannerPage.uploadFile(testZipPath);
    await securityScannerPage.verifyScannerSelectionState('scanner-test.zip');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Take screenshot on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      await takeTimestampedScreenshot(
        page,
        `scanner-selection-failure-${testInfo.title}`
      );
    }

    // Cleanup test files
    await cleanupTestFiles(createdTestFiles);
    createdTestFiles = [];
  });

  test('should display all available security scanners', async ({ page }) => {
    // Verify page title and description
    await expect(
      page.locator('h2', { hasText: 'Select Security Scanners' })
    ).toBeVisible();
    await expect(
      page.locator('text=Choose which security tools to run')
    ).toBeVisible();
    await expect(page.locator('text=scanner-test.zip')).toBeVisible();

    // Verify all expected tools are displayed
    for (const tool of expectedScannerTools) {
      await expect(page.locator(`text=${tool}`)).toBeVisible();
    }

    // Verify quick action buttons
    await expect(securityScannerPage.selectAllButton).toBeVisible();
    await expect(securityScannerPage.deselectAllButton).toBeVisible();

    // Verify start scan button
    await expect(securityScannerPage.startScanButton).toBeVisible();
    await expect(securityScannerPage.startScanButton).toBeDisabled(); // Should be disabled initially
  });

  test('should display scanner information and metadata', async ({ page }) => {
    // Check for Semgrep information
    const semgrepCard = page.locator('text=Semgrep').locator('..');
    await expect(
      semgrepCard.locator('text=Static analysis tool')
    ).toBeVisible();
    await expect(semgrepCard.locator('text=2-5 minutes')).toBeVisible();
    await expect(
      semgrepCard.locator('text=Requires WSL2 on Windows')
    ).toBeVisible();

    // Check for Trivy information
    const trivyCard = page.locator('text=Trivy').locator('..');
    await expect(trivyCard.locator('text=vulnerability scanner')).toBeVisible();
    await expect(trivyCard.locator('text=1-3 minutes')).toBeVisible();

    // Check for OWASP Dependency Check information
    const owaspCard = page.locator('text=OWASP Dependency Check').locator('..');
    await expect(owaspCard.locator('text=project dependencies')).toBeVisible();
    await expect(owaspCard.locator('text=3-7 minutes')).toBeVisible();
    await expect(owaspCard.locator('text=Windows only')).toBeVisible();
  });

  test('should select and deselect individual scanners', async ({ page }) => {
    // Initially no scanners should be selected
    await expect(page.locator('text=Selected tools: 0')).toBeVisible();
    await expect(securityScannerPage.startScanButton).toBeDisabled();

    // Select Semgrep
    await page
      .locator('text=Semgrep')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();
    await expect(page.locator('text=Selected tools: 1')).toBeVisible();
    await expect(securityScannerPage.startScanButton).toBeEnabled();

    // Select Trivy
    await page
      .locator('text=Trivy')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();
    await expect(page.locator('text=Selected tools: 2')).toBeVisible();

    // Deselect Semgrep
    await page
      .locator('text=Semgrep')
      .locator('..')
      .locator('input[type="checkbox"]')
      .uncheck();
    await expect(page.locator('text=Selected tools: 1')).toBeVisible();

    // Deselect all
    await page
      .locator('text=Trivy')
      .locator('..')
      .locator('input[type="checkbox"]')
      .uncheck();
    await expect(page.locator('text=Selected tools: 0')).toBeVisible();
    await expect(securityScannerPage.startScanButton).toBeDisabled();
  });

  test('should support select all functionality', async ({ page }) => {
    // Click select all
    await securityScannerPage.selectAllButton.click();

    // All checkboxes should be checked
    for (const tool of expectedScannerTools) {
      const checkbox = page
        .locator('text=' + tool)
        .locator('..')
        .locator('input[type="checkbox"]');
      await expect(checkbox).toBeChecked();
    }

    // Selected count should match total tools
    await expect(
      page.locator(`text=Selected tools: ${expectedScannerTools.length}`)
    ).toBeVisible();
    await expect(securityScannerPage.startScanButton).toBeEnabled();

    // Selected tools should be displayed as tags
    for (const tool of expectedScannerTools) {
      await expect(
        page.locator('.bg-primary-100').filter({ hasText: tool })
      ).toBeVisible();
    }
  });

  test('should support deselect all functionality', async ({ page }) => {
    // First select all
    await securityScannerPage.selectAllButton.click();
    await expect(
      page.locator(`text=Selected tools: ${expectedScannerTools.length}`)
    ).toBeVisible();

    // Then deselect all
    await securityScannerPage.deselectAllButton.click();

    // All checkboxes should be unchecked
    for (const tool of expectedScannerTools) {
      const checkbox = page
        .locator('text=' + tool)
        .locator('..')
        .locator('input[type="checkbox"]');
      await expect(checkbox).not.toBeChecked();
    }

    // Selected count should be 0
    await expect(page.locator('text=Selected tools: 0')).toBeVisible();
    await expect(securityScannerPage.startScanButton).toBeDisabled();

    // No selected tool tags should be visible
    await expect(page.locator('.bg-primary-100')).not.toBeVisible();
  });

  test('should calculate and display estimated scan time', async ({ page }) => {
    // No tools selected
    await expect(
      page.locator('text=Estimated total time: 0 minutes')
    ).toBeVisible();

    // Select one tool
    await page
      .locator('text=Semgrep')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();
    await expect(
      page.locator('text=Estimated total time: 2-5 minutes')
    ).toBeVisible();

    // Select all tools
    await securityScannerPage.selectAllButton.click();
    const expectedMin = expectedScannerTools.length * 2;
    const expectedMax = expectedScannerTools.length * 5;
    await expect(
      page.locator(
        `text=Estimated total time: ${expectedMin}-${expectedMax} minutes`
      )
    ).toBeVisible();
  });

  test('should handle card click selection', async ({ page }) => {
    // Click on scanner card (not checkbox) should toggle selection
    const semgrepCard = page
      .locator('text=Semgrep')
      .locator('..')
      .locator('..');

    // Click card to select
    await semgrepCard.click();
    const checkbox = page
      .locator('text=Semgrep')
      .locator('..')
      .locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();

    // Click card again to deselect
    await semgrepCard.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('should show visual feedback for selected scanners', async ({
    page,
  }) => {
    const semgrepCard = page
      .locator('text=Semgrep')
      .locator('..')
      .locator('..');

    // Initially not selected
    await expect(semgrepCard).not.toHaveClass(
      /border-primary-500|bg-primary-50/
    );

    // Select scanner
    await semgrepCard.click();

    // Should show selected state styling
    await expect(semgrepCard).toHaveClass(/border-primary-500|bg-primary-50/);
  });

  test('should prevent starting scan without selection', async ({ page }) => {
    // Try to click disabled start button
    await expect(securityScannerPage.startScanButton).toBeDisabled();

    // Click should not do anything (button disabled)
    // This is more of a visual test - button should remain disabled
  });

  test('should show validation message when trying to start without selection', async ({
    page,
  }) => {
    // Force click on start button even though disabled (simulate edge case)
    await page.evaluate(() => {
      document.querySelector('button[disabled]').disabled = false;
    });

    await securityScannerPage.startScanButton.click();

    // Should show validation toast
    await securityScannerPage.waitForToast(
      'Please select at least one security tool',
      'error'
    );
  });

  test('should successfully start scan with selected tools', async ({
    page,
  }) => {
    // Mock scan start response
    await mockApiResponse(page, '**/api/scan', {
      scanId: 'test-scan-id',
      websocketUrl: '/ws/test-scan-id',
      status: 'started',
      timestamp: new Date().toISOString(),
    });

    // Select scanners and start
    await securityScannerPage.selectScanners(['Semgrep', 'Trivy']);
    await securityScannerPage.startScan();

    // Should navigate to progress monitoring
    await securityScannerPage.verifyScanProgressState();
  });

  test('should maintain selection state during interaction', async ({
    page,
  }) => {
    // Select some tools
    await page
      .locator('text=Semgrep')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();
    await page
      .locator('text=Trivy')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();

    // Verify selection persists
    await expect(page.locator('text=Selected tools: 2')).toBeVisible();

    // Interact with page (scroll, etc.) and verify selection is maintained
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);

    // Selection should still be there
    await expect(page.locator('text=Selected tools: 2')).toBeVisible();
    const semgrepCheckbox = page
      .locator('text=Semgrep')
      .locator('..')
      .locator('input[type="checkbox"]');
    const trivyCheckbox = page
      .locator('text=Trivy')
      .locator('..')
      .locator('input[type="checkbox"]');
    await expect(semgrepCheckbox).toBeChecked();
    await expect(trivyCheckbox).toBeChecked();
  });

  test('should handle scanner selection with keyboard navigation', async ({
    page,
  }) => {
    // Test keyboard accessibility
    const firstCheckbox = page.locator('input[type="checkbox"]').first();

    // Focus and activate with keyboard
    await firstCheckbox.focus();
    await page.keyboard.press('Space');

    // Should be selected
    await expect(firstCheckbox).toBeChecked();
    await expect(page.locator('text=Selected tools: 1')).toBeVisible();

    // Deselect with keyboard
    await page.keyboard.press('Space');
    await expect(firstCheckbox).not.toBeChecked();
  });

  test('should display selected tools as chips/tags', async ({ page }) => {
    // Select multiple tools
    await securityScannerPage.selectScanners(['Semgrep', 'Trivy']);

    // Should show tools as chips
    await expect(
      page.locator('.bg-primary-100').filter({ hasText: 'Semgrep' })
    ).toBeVisible();
    await expect(
      page.locator('.bg-primary-100').filter({ hasText: 'Trivy' })
    ).toBeVisible();

    // Chips should have icons
    await expect(
      page
        .locator('.bg-primary-100')
        .filter({ hasText: 'Semgrep' })
        .locator('text=🔍')
    ).toBeVisible();
    await expect(
      page
        .locator('.bg-primary-100')
        .filter({ hasText: 'Trivy' })
        .locator('text=🛡️')
    ).toBeVisible();
  });

  test('should handle scan start failure gracefully', async ({ page }) => {
    // Mock scan start failure
    await page.route('**/api/scan', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Failed to start scan' },
        }),
      });
    });

    // Select tools and try to start scan
    await securityScannerPage.selectScanners(['Semgrep']);
    await securityScannerPage.startScanButton.click();

    // Should show error and remain on selection page
    await securityScannerPage.waitForToast('Failed to start scan', 'error');
    await expect(securityScannerPage.startScanButton).toBeVisible();
  });

  test('should show new scan option during selection', async ({ page }) => {
    // New scan button should be visible in header
    await expect(securityScannerPage.newScanButton).toBeVisible();

    // Click new scan should reset to upload page
    await securityScannerPage.newScanButton.click();
    await securityScannerPage.verifyInitialState();
  });
});
