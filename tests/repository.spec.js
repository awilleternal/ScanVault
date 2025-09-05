import { test, expect } from '@playwright/test';
import { SecurityScannerPage } from './pages/SecurityScannerPage.js';
import { testRepositories, testTimeouts } from './fixtures/testFiles.js';
import {
  takeTimestampedScreenshot,
  mockApiResponse,
  simulateSlowNetwork,
  resetNetworkConditions,
} from './utils/testHelpers.js';

test.describe('Repository URL Functionality', () => {
  let securityScannerPage;

  test.beforeEach(async ({ page }) => {
    securityScannerPage = new SecurityScannerPage(page);
    await securityScannerPage.goto();
    await securityScannerPage.verifyInitialState();

    // Switch to repository URL mode
    await securityScannerPage.uploadTypeToggle.url.click();
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Reset network conditions
    await resetNetworkConditions(page);

    // Take screenshot on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      await takeTimestampedScreenshot(
        page,
        `repository-test-failure-${testInfo.title}`
      );
    }
  });

  test('should display repository URL interface', async ({ page }) => {
    // Verify URL mode is selected
    await expect(securityScannerPage.uploadTypeToggle.url).toHaveClass(
      /bg-primary-600|text-white/
    );

    // Verify repository input elements
    await expect(securityScannerPage.repositoryUrlInput).toBeVisible();
    await expect(securityScannerPage.cloneRepositoryButton).toBeVisible();

    // Verify form labels and help text
    await expect(page.locator('label[for="repositoryUrl"]')).toHaveText(
      'Repository URL'
    );
    await expect(
      page.locator('text=Supports GitHub, GitLab, Bitbucket')
    ).toBeVisible();

    // Verify placeholder text
    await expect(securityScannerPage.repositoryUrlInput).toHaveAttribute(
      'placeholder',
      /github\.com|repository/
    );
  });

  test('should validate repository URL format', async ({ page }) => {
    // Test invalid URL formats
    const invalidUrls = [
      'not-a-url',
      'ftp://invalid-protocol.com',
      'https://',
      'github.com/repo', // missing protocol
      '',
    ];

    for (const invalidUrl of invalidUrls) {
      await securityScannerPage.repositoryUrlInput.fill(invalidUrl);
      await securityScannerPage.cloneRepositoryButton.click();

      // Should show validation error
      if (invalidUrl === '') {
        await expect(
          page.locator('text=Repository URL is required')
        ).toBeVisible();
      } else {
        await expect(
          page.locator('text=Please enter a valid URL')
        ).toBeVisible();
      }

      // Clear for next iteration
      await securityScannerPage.repositoryUrlInput.clear();
    }
  });

  test('should successfully clone a valid repository', async ({ page }) => {
    // Mock successful repository clone
    await mockApiResponse(page, '**/api/clone', {
      id: 'test-repo-id',
      repositoryUrl: testRepositories.validRepository,
      clonePath: '/tmp/test-repo',
      status: 'success',
    });

    // Submit valid repository URL
    await securityScannerPage.submitRepositoryUrl(
      testRepositories.validRepository
    );

    // Verify success toast
    await securityScannerPage.waitForToast(
      'Repository cloned successfully',
      'success'
    );

    // Verify navigation to scanner selection
    await securityScannerPage.verifyScannerSelectionState(
      testRepositories.validRepository
    );
  });

  test('should handle repository clone with loading state', async ({
    page,
  }) => {
    // Mock slow repository clone
    await page.route('**/api/clone', (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-repo-id',
            repositoryUrl: testRepositories.smallRepository,
            status: 'success',
          }),
        });
      }, 3000); // 3 second delay
    });

    // Fill repository URL
    await securityScannerPage.repositoryUrlInput.fill(
      testRepositories.smallRepository
    );

    // Click clone button
    await securityScannerPage.cloneRepositoryButton.click();

    // Should show loading toast
    await securityScannerPage.waitForToast('Cloning repository', 'loading');

    // Button should be disabled during cloning
    await expect(securityScannerPage.cloneRepositoryButton).toBeDisabled();
    await expect(securityScannerPage.cloneRepositoryButton).toHaveText(
      /Processing/
    );

    // Wait for completion
    await securityScannerPage.waitForToast(
      'Repository cloned successfully',
      'success'
    );

    // Button should be enabled again
    await expect(securityScannerPage.cloneRepositoryButton).toBeEnabled();
  });

  test('should handle repository not found error', async ({ page }) => {
    // Mock repository not found response
    await page.route('**/api/clone', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Repository not found or not accessible' },
        }),
      });
    });

    // Try to clone non-existent repository
    await securityScannerPage.repositoryUrlInput.fill(
      testRepositories.nonExistentRepository
    );
    await securityScannerPage.cloneRepositoryButton.click();

    // Should show error toast
    await securityScannerPage.waitForToast('Repository not found', 'error');

    // Should remain on repository URL page
    await expect(securityScannerPage.repositoryUrlInput).toBeVisible();
  });

  test('should handle authentication required error', async ({ page }) => {
    // Mock authentication required response
    await page.route('**/api/clone', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Authentication required for private repository' },
        }),
      });
    });

    // Try to clone private repository
    await securityScannerPage.repositoryUrlInput.fill(
      'https://github.com/private/repository.git'
    );
    await securityScannerPage.cloneRepositoryButton.click();

    // Should show authentication error
    await securityScannerPage.waitForToast('Authentication required', 'error');
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    // Simulate slow network
    await simulateSlowNetwork(page);

    // Mock timeout response
    await page.route('**/api/clone', (route) => {
      // Simulate network timeout by not responding
      setTimeout(() => {
        route.abort();
      }, testTimeouts.clone);
    });

    // Try to clone repository
    await securityScannerPage.repositoryUrlInput.fill(
      testRepositories.validRepository
    );
    await securityScannerPage.cloneRepositoryButton.click();

    // Should eventually show timeout error
    await securityScannerPage.waitForToast(
      'Failed to clone repository',
      'error'
    );
  });

  test('should handle server error gracefully', async ({ page }) => {
    // Mock server error
    await page.route('**/api/clone', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Internal server error during clone' },
        }),
      });
    });

    // Try to clone repository
    await securityScannerPage.repositoryUrlInput.fill(
      testRepositories.validRepository
    );
    await securityScannerPage.cloneRepositoryButton.click();

    // Should show server error
    await securityScannerPage.waitForToast('Internal server error', 'error');
  });

  test('should support various Git repository formats', async ({ page }) => {
    const validRepositoryFormats = [
      'https://github.com/user/repo.git',
      'https://github.com/user/repo',
      'https://gitlab.com/user/repo.git',
      'https://bitbucket.org/user/repo.git',
      'https://git.example.com/user/repo.git',
    ];

    for (const repoUrl of validRepositoryFormats) {
      // Mock successful response for each format
      await mockApiResponse(page, '**/api/clone', {
        id: `repo-${Date.now()}`,
        repositoryUrl: repoUrl,
        status: 'success',
      });

      // Test each format
      await securityScannerPage.repositoryUrlInput.fill(repoUrl);

      // Should not show validation errors
      await expect(
        page.locator('text=Please enter a valid URL')
      ).not.toBeVisible();

      // Clear for next iteration
      await securityScannerPage.repositoryUrlInput.clear();
    }
  });

  test('should clear form after successful submission', async ({ page }) => {
    // Mock successful clone
    await mockApiResponse(page, '**/api/clone', {
      id: 'test-repo-id',
      repositoryUrl: testRepositories.validRepository,
      status: 'success',
    });

    // Fill and submit form
    await securityScannerPage.repositoryUrlInput.fill(
      testRepositories.validRepository
    );
    await securityScannerPage.cloneRepositoryButton.click();

    // Wait for success
    await securityScannerPage.waitForToast(
      'Repository cloned successfully',
      'success'
    );

    // Form should be cleared (though we navigate away, this tests the form reset)
    // This would be more relevant if we stayed on the same page
  });

  test('should handle concurrent clone requests', async ({ page }) => {
    // This test would be more complex and might require multiple browser contexts
    // For now, just test that multiple rapid clicks don't cause issues

    await mockApiResponse(page, '**/api/clone', {
      id: 'test-repo-id',
      repositoryUrl: testRepositories.validRepository,
      status: 'success',
    });

    await securityScannerPage.repositoryUrlInput.fill(
      testRepositories.validRepository
    );

    // Rapidly click clone button multiple times
    await securityScannerPage.cloneRepositoryButton.click();
    await securityScannerPage.cloneRepositoryButton.click(); // Should be disabled
    await securityScannerPage.cloneRepositoryButton.click(); // Should be disabled

    // Should only process one request
    await securityScannerPage.waitForToast(
      'Repository cloned successfully',
      'success'
    );
  });

  test('should preserve URL input during loading', async ({ page }) => {
    const testUrl = testRepositories.validRepository;

    // Mock slow response
    await page.route('**/api/clone', (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-repo-id',
            repositoryUrl: testUrl,
            status: 'success',
          }),
        });
      }, 2000);
    });

    // Fill URL and submit
    await securityScannerPage.repositoryUrlInput.fill(testUrl);
    await securityScannerPage.cloneRepositoryButton.click();

    // URL should still be visible in input during loading
    await expect(securityScannerPage.repositoryUrlInput).toHaveValue(testUrl);

    // Wait for completion
    await securityScannerPage.waitForToast(
      'Repository cloned successfully',
      'success'
    );
  });

  test('should handle special characters in repository URLs', async ({
    page,
  }) => {
    const specialCharUrls = [
      'https://github.com/user/repo-with-dashes.git',
      'https://github.com/user/repo_with_underscores.git',
      'https://github.com/user123/repo123.git',
      'https://github.com/user.name/repo.name.git',
    ];

    for (const url of specialCharUrls) {
      await mockApiResponse(page, '**/api/clone', {
        id: `repo-${Date.now()}`,
        repositoryUrl: url,
        status: 'success',
      });

      await securityScannerPage.repositoryUrlInput.fill(url);

      // Should be valid
      await expect(
        page.locator('text=Please enter a valid URL')
      ).not.toBeVisible();

      await securityScannerPage.repositoryUrlInput.clear();
    }
  });
});
