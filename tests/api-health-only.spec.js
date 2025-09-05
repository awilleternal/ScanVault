import { test, expect } from '@playwright/test';
import { testConfig } from './fixtures/testFiles.js';

test.describe('API Health Check Only', () => {
  test('should return healthy status from backend', async ({ page }) => {
    const response = await page.request.get(`${testConfig.backend.url}/api/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeDefined();
    expect(typeof data.uptime).toBe('number');
  });

  test('should handle 404 routes gracefully', async ({ page }) => {
    const response = await page.request.get(`${testConfig.backend.url}/api/non-existent-endpoint`);
    
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.message).toMatch(/not found/i);
  });

  test('should include proper CORS headers', async ({ page }) => {
    const response = await page.request.get(`${testConfig.backend.url}/api/health`);
    
    const corsHeaders = response.headers();
    expect(corsHeaders['access-control-allow-origin']).toBeDefined();
  });

  test('should return proper content types', async ({ page }) => {
    const response = await page.request.get(`${testConfig.backend.url}/api/health`);
    
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/application\/json/);
  });
});
