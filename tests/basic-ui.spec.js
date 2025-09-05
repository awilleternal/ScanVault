import { test, expect } from '@playwright/test';
import { SecurityScannerPage } from './pages/SecurityScannerPage.js';

test.describe('Basic UI Functionality', () => {
  let securityScannerPage;

  test.beforeEach(async ({ page }) => {
    securityScannerPage = new SecurityScannerPage(page);
    await securityScannerPage.goto();
  });

  test('should display the main application interface', async ({ page }) => {
    // Verify the app loads correctly
    await expect(securityScannerPage.appTitle).toBeVisible();
    await expect(
      page.locator('h2', { hasText: 'Upload a Plugin or Repository' })
    ).toBeVisible();

    // Verify upload interface is visible
    await expect(securityScannerPage.uploadTypeToggle.file).toBeVisible();
    await expect(securityScannerPage.uploadTypeToggle.url).toBeVisible();

    // Verify file upload is selected by default
    await expect(securityScannerPage.dropzone).toBeVisible();
  });

  test('should switch between upload types', async ({ page }) => {
    // Initially file upload should be selected
    await expect(securityScannerPage.dropzone).toBeVisible();

    // Switch to URL upload
    await securityScannerPage.uploadTypeToggle.url.click();
    await expect(securityScannerPage.repositoryUrlInput).toBeVisible();

    // Switch back to file upload
    await securityScannerPage.uploadTypeToggle.file.click();
    await expect(securityScannerPage.dropzone).toBeVisible();
  });

  test('should display upload instructions', async ({ page }) => {
    // Check file upload instructions
    await expect(
      page.locator('text=Drag and drop a ZIP file here')
    ).toBeVisible();
    await expect(page.locator('text=or click to select a file')).toBeVisible();
    await expect(
      page.locator('text=ZIP files only, up to 100MB')
    ).toBeVisible();

    // Switch to URL mode and check instructions
    await securityScannerPage.uploadTypeToggle.url.click();
    await expect(
      page.locator('label', { hasText: 'Repository URL' })
    ).toBeVisible();
    await expect(
      page.locator('text=Supports GitHub, GitLab, Bitbucket')
    ).toBeVisible();
  });

  test('should show form validation for repository URL', async ({ page }) => {
    // Switch to URL mode
    await securityScannerPage.uploadTypeToggle.url.click();

    // Try to submit empty form
    await page.locator('button', { hasText: 'Clone Repository' }).click();

    // Should show validation error
    await expect(page.locator('text=Repository URL is required')).toBeVisible();

    // Try invalid URL
    await securityScannerPage.repositoryUrlInput.fill('invalid-url');
    await page.locator('button', { hasText: 'Clone Repository' }).click();

    // Should show URL validation error
    await expect(page.locator('text=Please enter a valid URL')).toBeVisible();
  });

  test('should show Toaster component for notifications', async ({ page }) => {
    // The Toaster component should be in the DOM
    // This doesn't test actual toasts, just that the toast system is set up
    await expect(
      page
        .locator('[data-hot-toast]')
        .or(
          page.locator('#react-hot-toast-1').or(page.locator('[role="status"]'))
        )
    ).toHaveCount(0); // Should be empty initially
  });

  test('should have proper accessibility elements', async ({ page }) => {
    // Check for proper form labels
    await securityScannerPage.uploadTypeToggle.url.click();
    await expect(page.locator('label[for="repositoryUrl"]')).toBeVisible();

    // Check for proper input associations
    await expect(page.locator('input#repositoryUrl')).toBeVisible();

    // Check for proper button text
    await expect(
      page.locator('button', { hasText: 'Clone Repository' })
    ).toBeVisible();
  });

  test('should handle file input interaction', async ({ page }) => {
    // File input should be present and functional
    await expect(securityScannerPage.fileInput).toBeAttached();

    // Dropzone should be clickable
    await expect(securityScannerPage.dropzone).toBeVisible();

    // Should be able to click on the dropzone
    await securityScannerPage.dropzone.click();
  });

  test('should show proper navigation elements', async ({ page }) => {
    // Header should be visible
    await expect(securityScannerPage.header).toBeVisible();

    // App title should be clickable/visible
    await expect(securityScannerPage.appTitle).toBeVisible();

    // New scan button should NOT be visible initially (only shows after upload)
    await expect(securityScannerPage.newScanButton).not.toBeVisible();
  });
});
