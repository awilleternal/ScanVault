# Security Scanner E2E Tests

This directory contains comprehensive end-to-end tests for the Security Scanner web application using Playwright.

## Test Structure

```
tests/
├── pages/                     # Page Object Models
│   └── SecurityScannerPage.js # Main page object for the application
├── fixtures/                  # Test data and fixtures
│   └── testFiles.js          # Test files, repositories, and mock data
├── utils/                     # Test utilities and helpers
│   └── testHelpers.js        # Common test functions and utilities
├── upload.spec.js            # File upload functionality tests
├── repository.spec.js        # Repository URL functionality tests
├── scanner-selection.spec.js # Scanner selection workflow tests
├── scan-progress.spec.js     # Scan progress monitoring tests
├── results-dashboard.spec.js # Results dashboard functionality tests
├── api-integration.spec.js   # API endpoint integration tests
├── e2e-workflow.spec.js      # Complete end-to-end workflow tests
├── global-setup.js           # Global test setup
├── global-teardown.js        # Global test teardown
└── README.md                 # This file
```

## Test Categories

### 1. Upload Tests (`upload.spec.js`)
- File upload interface validation
- ZIP file upload and validation
- File size limit enforcement
- Error handling and recovery
- Upload progress monitoring

### 2. Repository Tests (`repository.spec.js`)
- Repository URL validation
- Git repository cloning
- Authentication handling
- Network error handling
- Various Git provider support

### 3. Scanner Selection Tests (`scanner-selection.spec.js`)
- Scanner option display
- Multiple scanner selection
- Scanner metadata display
- Selection validation
- Time estimation

### 4. Progress Monitoring Tests (`scan-progress.spec.js`)
- Progress display and updates
- WebSocket connection handling
- Fallback progress simulation
- Error handling during scans
- Scan completion detection

### 5. Results Dashboard Tests (`results-dashboard.spec.js`)
- Results display and formatting
- Severity filtering
- Tab navigation (Overview, Semgrep, Trivy)
- Result card expansion
- Report downloads (JSON/PDF)

### 6. API Integration Tests (`api-integration.spec.js`)
- Health check endpoint
- Upload API validation
- Scan initiation API
- Results retrieval API
- Error response handling
- Security headers validation

### 7. End-to-End Workflow Tests (`e2e-workflow.spec.js`)
- Complete file upload workflow
- Complete repository URL workflow
- Multiple scan iterations
- Error recovery scenarios
- Performance testing

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run test:install
```

### Test Execution Commands

```bash
# Run all tests
npm test

# Run tests with visible browser
npm run test:headed

# Run tests with Playwright UI
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Run specific test suites
npm run test:upload        # File upload tests
npm run test:repository    # Repository URL tests
npm run test:scanner       # Scanner selection tests
npm run test:progress      # Progress monitoring tests
npm run test:results       # Results dashboard tests
npm run test:api          # API integration tests
npm run test:e2e          # End-to-end workflow tests

# Run tests on specific browsers
npm run test:chromium     # Chrome/Chromium only
npm run test:firefox      # Firefox only
npm run test:webkit       # Safari/WebKit only
npm run test:mobile       # Mobile browsers

# View test reports
npm run test:report
```

### Test Configuration

The main configuration is in `playwright.config.js` with the following key features:

- **Multiple Browsers**: Chrome, Firefox, Safari, Mobile browsers
- **Parallel Execution**: Tests run in parallel for faster execution
- **Automatic Server Startup**: Frontend (port 3000) and Backend (port 5000)
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Collected for debugging failed tests

## Test Data and Mocking

### Mock Data
- Located in `tests/fixtures/testFiles.js`
- Includes sample scan results, repository URLs, and test configurations
- Provides realistic test data for comprehensive testing

### API Mocking
- Tests use Playwright's route interception for API mocking
- Allows testing various scenarios (success, error, timeout)
- Enables testing without actual backend dependencies

### Test Files
- Dynamically created ZIP files for upload testing
- Automatic cleanup after test completion
- Various file sizes for testing limits

## Page Object Model

The `SecurityScannerPage` class provides:

- **Element Selectors**: Robust selectors for UI elements
- **Action Methods**: High-level methods for user interactions
- **Verification Methods**: State verification helpers
- **Workflow Methods**: Complete workflow automation

## Best Practices

### Writing Tests
1. Use Page Object Model for maintainable tests
2. Include proper wait conditions and timeouts
3. Clean up test data after test completion
4. Use descriptive test names and organize by functionality
5. Mock external dependencies for reliable testing

### Test Organization
1. Group related tests in describe blocks
2. Use beforeEach/afterEach for setup/cleanup
3. Keep tests independent and isolated
4. Use meaningful test data and assertions

### Error Handling
1. Take screenshots on test failures
2. Include proper error messages
3. Test both success and failure scenarios
4. Verify error recovery mechanisms

## Debugging Tests

### Debug Mode
```bash
npm run test:debug
```
Opens Playwright Inspector for step-by-step debugging.

### UI Mode
```bash
npm run test:ui
```
Opens Playwright UI for interactive test development and debugging.

### Screenshots and Videos
- Automatically captured on failures
- Stored in `test-results/` directory
- Include timestamps for easy identification

### Console Logs
- Application console logs are captured
- Helper functions verify no console errors
- Network requests can be inspected

## Continuous Integration

### GitHub Actions
```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npm test

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

### Environment Variables
- `CI=true`: Adjusts retry and parallelization for CI
- `FRONTEND_URL`: Override frontend URL
- `BACKEND_URL`: Override backend URL

## Maintenance

### Updating Tests
1. Update selectors when UI changes
2. Modify mock data when API changes
3. Add new test cases for new features
4. Update timeouts if performance changes

### Monitoring
1. Review test failure patterns
2. Update flaky tests with better waits
3. Monitor test execution times
4. Keep browser versions updated

## Troubleshooting

### Common Issues

**Tests failing due to timing**
- Increase timeouts in configuration
- Add explicit wait conditions
- Use `page.waitForLoadState()`

**Element not found errors**
- Verify selectors in Playwright Inspector
- Check if elements are hidden or disabled
- Use more specific selectors

**Server startup issues**
- Verify ports 3000 and 5000 are available
- Check server startup logs
- Ensure all dependencies are installed

**File creation errors**
- Verify write permissions in test directories
- Check available disk space
- Ensure cleanup is working properly

### Getting Help
1. Check Playwright documentation: https://playwright.dev/
2. Review test logs and screenshots
3. Use Playwright Inspector for debugging
4. Check browser developer tools for application errors

## Contributing

When adding new tests:
1. Follow existing test patterns
2. Add appropriate documentation
3. Include both positive and negative test cases
4. Update this README if adding new test categories
5. Ensure tests are reliable and maintainable
