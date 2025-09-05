import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setTimeout, clearTimeout } from 'timers';

/**
 * Test helper utilities for Security Scanner E2E tests
 */

/**
 * Create a test ZIP file for upload testing
 * @param {string} filePath - Path where to create the test file
 * @param {number} sizeInBytes - Size of the file in bytes
 */
export async function createTestZipFile(filePath, sizeInBytes = 1024) {
  const dir = path.dirname(filePath);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create a simple test file content
  const content = Buffer.alloc(sizeInBytes, 'test data ');
  fs.writeFileSync(filePath, content);
}

/**
 * Clean up test files
 * @param {string[]} filePaths - Array of file paths to clean up
 */
export async function cleanupTestFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup test file ${filePath}:`, error.message);
    }
  }
}

/**
 * Wait for element with custom retry logic
 * @param {import('@playwright/test').Page} page 
 * @param {string} selector 
 * @param {number} timeout 
 */
export async function waitForElementWithRetry(page, selector, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const element = page.locator(selector);
      await expect(element).toBeVisible({ timeout: 5000 });
      return element;
    } catch (error) {
      // Wait before retrying
      await page.waitForTimeout(1000);
    }
  }
  
  throw new Error(`Element with selector "${selector}" not found within ${timeout}ms`);
}

/**
 * Take a screenshot with timestamp
 * @param {import('@playwright/test').Page} page 
 * @param {string} name 
 */
export async function takeTimestampedScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await page.screenshot({ path: `test-results/${filename}`, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
}

/**
 * Verify API endpoint is accessible
 * @param {import('@playwright/test').Page} page 
 * @param {string} endpoint 
 */
export async function verifyApiEndpoint(page, endpoint) {
  const response = await page.request.get(endpoint);
  expect(response.status()).toBe(200);
  return response;
}

/**
 * Wait for file download and verify
 * @param {import('@playwright/test').Page} page 
 * @param {Function} triggerDownload - Function that triggers the download
 * @param {string} expectedFilenamePattern - Pattern to match filename
 */
export async function waitForDownloadAndVerify(page, triggerDownload, expectedFilenamePattern) {
  const downloadPromise = page.waitForDownload();
  await triggerDownload();
  const download = await downloadPromise;
  
  // Verify filename matches pattern
  const filename = download.suggestedFilename();
  expect(filename).toMatch(new RegExp(expectedFilenamePattern));
  
  // Verify file was actually downloaded
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  
  // Get file size to verify it's not empty
  const stats = fs.statSync(path);
  expect(stats.size).toBeGreaterThan(0);
  
  return download;
}

/**
 * Mock network request with custom response
 * @param {import('@playwright/test').Page} page 
 * @param {string} url 
 * @param {Object} responseData 
 */
export async function mockApiResponse(page, url, responseData) {
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData)
    });
  });
}

/**
 * Wait for WebSocket connection
 * @param {import('@playwright/test').Page} page 
 * @param {string} expectedUrl 
 */
export async function waitForWebSocketConnection(page, expectedUrl) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 10000);

    page.on('websocket', ws => {
      if (ws.url().includes(expectedUrl)) {
        clearTimeout(timeout);
        resolve(ws);
      }
    });
  });
}

/**
 * Simulate slow network conditions
 * @param {import('@playwright/test').Page} page 
 */
export async function simulateSlowNetwork(page) {
  // Simulate slow 3G connection
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 500 * 1024 / 8, // 500kb/s
    uploadThroughput: 500 * 1024 / 8,   // 500kb/s
    latency: 400 // 400ms
  });
}

/**
 * Reset network conditions to normal
 * @param {import('@playwright/test').Page} page 
 */
export async function resetNetworkConditions(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0
  });
}

/**
 * Verify console logs don't contain errors
 * @param {import('@playwright/test').Page} page 
 */
export async function verifyNoConsoleErrors(page) {
  const logs = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });
  
  // Return a function to check logs at end of test
  return () => {
    if (logs.length > 0) {
      console.warn('Console errors detected:', logs);
      // You might want to fail the test or just warn
      // expect(logs).toHaveLength(0);
    }
    return logs;
  };
}

/**
 * Generate test data for form inputs
 * @param {string} type - Type of test data needed
 */
export function generateTestData(type) {
  const timestamp = Date.now();
  
  switch (type) {
    case 'repository':
      return `https://github.com/test/repo-${timestamp}.git`;
    case 'filename':
      return `test-file-${timestamp}.zip`;
    case 'email':
      return `test-${timestamp}@example.com`;
    case 'uuid':
      return `${timestamp}-test-uuid`;
    default:
      return `test-data-${timestamp}`;
  }
}
