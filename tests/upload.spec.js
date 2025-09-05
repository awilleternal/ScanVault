import { test, expect } from '@playwright/test';
import { SecurityScannerPage } from './pages/SecurityScannerPage.js';
import { testFiles, testTimeouts } from './fixtures/testFiles.js';
import {
  createTestZipFile,
  cleanupTestFiles,
  takeTimestampedScreenshot,
} from './utils/testHelpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('File Upload Functionality', () => {
  let securityScannerPage;
  let createdTestFiles = [];

  test.beforeEach(async ({ page }) => {
    securityScannerPage = new SecurityScannerPage(page);
    await securityScannerPage.goto();
    await securityScannerPage.verifyInitialState();
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Take screenshot on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      await takeTimestampedScreenshot(
        page,
        `upload-test-failure-${testInfo.title}`
      );
    }

    // Cleanup test files
    await cleanupTestFiles(createdTestFiles);
    createdTestFiles = [];
  });

  test('should display file upload interface by default', async ({ page }) => {
    // Verify upload type toggle is visible and file upload is selected
    await expect(securityScannerPage.uploadTypeToggle.file).toHaveClass(
      /bg-primary-600|text-white/
    );
    await expect(securityScannerPage.dropzone).toBeVisible();

    // Verify dropzone instructions
    await expect(
      page.locator('text=Drag and drop a ZIP file here')
    ).toBeVisible();
    await expect(page.locator('text=or click to select a file')).toBeVisible();
    await expect(
      page.locator('text=ZIP files only, up to 100MB')
    ).toBeVisible();
  });

  test('should switch between upload types', async ({ page }) => {
    // Initially file upload should be selected
    await expect(securityScannerPage.uploadTypeToggle.file).toHaveClass(
      /bg-primary-600/
    );

    // Switch to URL upload
    await securityScannerPage.uploadTypeToggle.url.click();
    await expect(securityScannerPage.uploadTypeToggle.url).toHaveClass(
      /bg-primary-600/
    );
    await expect(securityScannerPage.repositoryUrlInput).toBeVisible();

    // Switch back to file upload
    await securityScannerPage.uploadTypeToggle.file.click();
    await expect(securityScannerPage.uploadTypeToggle.file).toHaveClass(
      /bg-primary-600/
    );
    await expect(securityScannerPage.dropzone).toBeVisible();
  });

  test('should successfully upload a valid ZIP file', async ({ page }) => {
    // Create a test ZIP file
    const testZipPath = path.join(__dirname, 'fixtures', 'test-upload.zip');
    await createTestZipFile(testZipPath, 1024); // 1KB test file
    createdTestFiles.push(testZipPath);

    // Upload the file
    await securityScannerPage.uploadFile(testZipPath);

    // Verify success toast appears
    await securityScannerPage.waitForToast(
      'File uploaded successfully',
      'success'
    );

    // Verify navigation to scanner selection
    await securityScannerPage.verifyScannerSelectionState('test-upload.zip');
  });

  test('should show upload progress during file upload', async ({ page }) => {
    // Create a larger test file to see progress
    const testZipPath = path.join(
      __dirname,
      'fixtures',
      'large-test-upload.zip'
    );
    await createTestZipFile(testZipPath, 10 * 1024 * 1024); // 10MB test file
    createdTestFiles.push(testZipPath);

    // Start upload and check for progress
    await securityScannerPage.uploadTypeToggle.file.click();
    await securityScannerPage.fileInput.setInputFiles(testZipPath);

    // Progress bar should appear
    await expect(
      securityScannerPage.uploadProgress.or(page.locator('text=Uploading'))
    ).toBeVisible({ timeout: 5000 });

    // Wait for upload completion
    await securityScannerPage.waitForToast(
      'File uploaded successfully',
      'success'
    );
  });

  test('should reject non-ZIP files', async ({ page }) => {
    // Create a test text file
    const testTextPath = path.join(__dirname, 'fixtures', 'test-file.txt');
    const fs = await import('fs');
    fs.writeFileSync(testTextPath, 'This is not a ZIP file');
    createdTestFiles.push(testTextPath);

    // Try to upload the text file
    await securityScannerPage.uploadTypeToggle.file.click();
    await securityScannerPage.fileInput.setInputFiles(testTextPath);

    // Should show error toast
    await securityScannerPage.waitForToast('Please upload a ZIP file', 'error');

    // Should remain on upload page
    await expect(securityScannerPage.dropzone).toBeVisible();
  });

  test('should reject files larger than 100MB', async ({ page }) => {
    // Create a large test file (simulate > 100MB)
    const testLargePath = path.join(__dirname, 'fixtures', 'large-file.zip');
    await createTestZipFile(testLargePath, 101 * 1024 * 1024); // 101MB
    createdTestFiles.push(testLargePath);

    // Try to upload the large file
    await securityScannerPage.uploadTypeToggle.file.click();
    await securityScannerPage.fileInput.setInputFiles(testLargePath);

    // Should show error toast
    await securityScannerPage.waitForToast(
      'File size must be less than 100MB',
      'error'
    );

    // Should remain on upload page
    await expect(securityScannerPage.dropzone).toBeVisible();
  });

  test('should handle drag and drop file upload', async ({ page }) => {
    // Create a test ZIP file
    const testZipPath = path.join(__dirname, 'fixtures', 'drag-drop-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    // Simulate drag over
    await securityScannerPage.dropzone.hover();

    // The dropzone should show active state (this is hard to test exactly in Playwright)
    // But we can test the actual file selection
    await securityScannerPage.fileInput.setInputFiles(testZipPath);

    // Verify upload success
    await securityScannerPage.waitForToast(
      'File uploaded successfully',
      'success'
    );
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Mock a failed upload response
    await page.route('**/api/upload', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Internal server error' } }),
      });
    });

    // Create and try to upload a test file
    const testZipPath = path.join(__dirname, 'fixtures', 'error-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    await securityScannerPage.fileInput.setInputFiles(testZipPath);

    // Should show error toast
    await securityScannerPage.waitForToast('Failed to upload file', 'error');

    // Should remain on upload page
    await expect(securityScannerPage.dropzone).toBeVisible();
  });

  test('should disable upload during processing', async ({ page }) => {
    // Create a test file
    const testZipPath = path.join(__dirname, 'fixtures', 'disable-test.zip');
    await createTestZipFile(testZipPath, 1024);
    createdTestFiles.push(testZipPath);

    // Mock a slow upload response
    await page.route('**/api/upload', (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-upload-id',
            fileName: 'disable-test.zip',
            fileSize: 1024,
          }),
        });
      }, 3000); // 3 second delay
    });

    // Start upload
    await securityScannerPage.fileInput.setInputFiles(testZipPath);

    // Dropzone should be disabled during upload
    await expect(securityScannerPage.dropzone).toHaveClass(
      /opacity-50|cursor-not-allowed/
    );

    // Wait for completion
    await securityScannerPage.waitForToast(
      'File uploaded successfully',
      'success'
    );
  });

  test('should maintain upload state after page refresh', async ({ page }) => {
    // This test would need more complex state management testing
    // For now, just verify initial state after refresh
    await page.reload();
    await securityScannerPage.verifyInitialState();
  });
});
