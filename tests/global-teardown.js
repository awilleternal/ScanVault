/**
 * Global teardown for Playwright tests
 * This runs once after all tests complete
 */

export default async function globalTeardown(config) {
  console.log('🧹 Starting global teardown for Security Scanner tests...');
  
  // Clean up any global resources if needed
  // The webServer processes will be automatically stopped by Playwright
  
  console.log('✅ Global teardown completed');
}
