/**
 * Global setup for Playwright tests
 * This runs once before all tests start
 */

export default async function globalSetup(config) {
  console.log('🚀 Starting global setup for Security Scanner tests...');

  // Wait for services to be ready
  console.log('⏳ Waiting for frontend and backend services to be ready...');

  // The webServer configuration in playwright.config.js will handle starting the services
  // This is just for any additional setup that might be needed

  console.log('✅ Global setup completed');
}
