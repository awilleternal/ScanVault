import { expect } from '@playwright/test';

/**
 * Page Object Model for the Security Scanner application
 */
export class SecurityScannerPage {
  constructor(page) {
    this.page = page;
    
    // Header elements
    this.header = page.locator('header');
    this.appTitle = page.locator('h1').filter({ hasText: 'Security Scanner' });
    this.newScanButton = page.locator('button', { hasText: 'New Scan' });
    
    // Upload section elements
    this.uploadTypeToggle = {
      file: page.locator('button', { hasText: 'Upload ZIP File' }),
      url: page.locator('button', { hasText: 'Repository URL' })
    };
    
    // File upload elements
    this.dropzone = page.locator('[data-testid="dropzone"]').or(page.locator('.border-dashed'));
    this.fileInput = page.locator('input[type="file"]');
    this.uploadProgress = page.locator('.bg-primary-600').first(); // Progress bar
    
    // URL input elements
    this.repositoryUrlInput = page.locator('input[id="repositoryUrl"]');
    this.cloneRepositoryButton = page.locator('button', { hasText: 'Clone Repository' });
    
    // Scanner selection elements
    this.scannerCards = page.locator('.border.rounded-lg').filter({ has: page.locator('input[type="checkbox"]') });
    this.selectAllButton = page.locator('button', { hasText: 'Select All' });
    this.deselectAllButton = page.locator('button', { hasText: 'Deselect All' });
    this.startScanButton = page.locator('button', { hasText: 'Start Security Scan' });
    
    // Individual scanner checkboxes
    this.scannerCheckboxes = {
      semgrep: page.locator('input[type="checkbox"]').filter({ 
        has: page.locator('text=Semgrep') 
      }),
      trivy: page.locator('input[type="checkbox"]').filter({ 
        has: page.locator('text=Trivy') 
      }),
      owaspDependencyCheck: page.locator('input[type="checkbox"]').filter({ 
        has: page.locator('text=OWASP Dependency Check') 
      })
    };
    
    // Progress monitoring elements
    this.progressSection = page.locator('.max-w-4xl.mx-auto');
    this.currentToolIndicator = page.locator('[data-testid="current-tool"]').or(
      page.locator('text=/Scanning|Running|Progress/').first()
    );
    this.progressBar = page.locator('.bg-primary-600, .bg-blue-600').first();
    this.progressLogs = page.locator('[data-testid="progress-logs"]').or(
      page.locator('pre, .font-mono, .bg-gray-100')
    );
    
    // Results dashboard elements
    this.resultsSection = page.locator('.space-y-6').filter({ 
      has: page.locator('text=Security Scan Results Summary') 
    });
    this.summaryStats = page.locator('.grid.grid-cols-2, .grid.grid-cols-6');
    this.tabNavigation = page.locator('nav.-mb-px');
    this.overviewTab = page.locator('button', { hasText: /Overview.*\(\d+\)/ });
    this.semgrepTab = page.locator('button', { hasText: /Semgrep.*\(\d+\)/ });
    this.trivyTab = page.locator('button', { hasText: /Trivy.*\(\d+\)/ });
    
    // Filter and action elements
    this.severityFilter = page.locator('select#severity-filter');
    this.downloadJsonButton = page.locator('button', { hasText: 'Download JSON' });
    this.downloadPdfButton = page.locator('button', { hasText: 'Download PDF Report' });
    
    // Results list elements
    this.resultCards = page.locator('.card.border-l-4');
    this.noResultsMessage = page.locator('text=No security issues found');
    
    // Toast notifications - react-hot-toast specific selectors
    this.toastNotifications = page.locator('[data-hot-toast]').or(
      page.locator('[data-testid="toast"]').or(
        page.locator('[role="status"]').or(
          page.locator('.react-hot-toast').or(
            page.locator('[id^="react-hot-toast"]')
          )
        )
      )
    );
  }

  /**
   * Navigate to the Security Scanner application
   */
  async goto() {
    await this.page.goto('/');
    await expect(this.appTitle).toBeVisible();
  }

  /**
   * Upload a file using drag and drop or file input
   * @param {string} filePath - Path to the file to upload
   */
  async uploadFile(filePath) {
    // Ensure we're in file upload mode
    await this.uploadTypeToggle.file.click();
    
    // Use the file input for reliable file upload
    await this.fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete - try multiple strategies
    try {
      await this.waitForToast('File uploaded successfully', 'success');
    } catch (error) {
      // Alternative: check if we moved to scanner selection state
      await expect(this.page.locator('h2', { hasText: 'Select Security Scanners' })).toBeVisible({ timeout: 10000 });
    }
  }

  /**
   * Submit a repository URL
   * @param {string} repositoryUrl - Repository URL to clone
   */
  async submitRepositoryUrl(repositoryUrl) {
    // Switch to URL mode
    await this.uploadTypeToggle.url.click();
    
    // Fill in the repository URL
    await this.repositoryUrlInput.fill(repositoryUrl);
    
    // Submit the form
    await this.cloneRepositoryButton.click();
    
    // Wait for success message
    await expect(this.page.locator('text=Repository cloned successfully')).toBeVisible({ timeout: 60000 });
  }

  /**
   * Select security scanners
   * @param {string[]} scanners - Array of scanner names to select
   */
  async selectScanners(scanners) {
    // Wait for scanner selection section to be visible
    await expect(this.startScanButton).toBeVisible();
    
    // First deselect all to ensure clean state
    await this.deselectAllButton.click();
    
    // Select requested scanners
    for (const scanner of scanners) {
      const scannerName = scanner.toLowerCase().replace(/\s+/g, '');
      const checkboxLocator = this.scannerCheckboxes[scannerName] || 
        this.page.locator(`input[type="checkbox"]`).filter({ 
          has: this.page.locator(`text=${scanner}`) 
        });
      
      await checkboxLocator.check();
    }
  }

  /**
   * Start the security scan
   */
  async startScan() {
    await this.startScanButton.click();
    
    // Wait for scan to start
    await expect(this.progressSection).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for scan completion
   * @param {number} timeoutMs - Timeout in milliseconds (default 5 minutes)
   */
  async waitForScanCompletion(timeoutMs = 300000) {
    // Wait for results section to appear
    await expect(this.resultsSection).toBeVisible({ timeout: timeoutMs });
    
    // Ensure progress section is no longer visible
    await expect(this.progressSection).not.toBeVisible();
  }

  /**
   * Get scan results summary statistics
   * @returns {Promise<Object>} Statistics object with total, critical, high, etc.
   */
  async getScanResultsStats() {
    await expect(this.summaryStats).toBeVisible();
    
    const stats = {};
    const statElements = await this.summaryStats.locator('.text-center').all();
    
    for (const element of statElements) {
      const number = await element.locator('.text-3xl').textContent();
      const label = await element.locator('.text-sm').textContent();
      
      stats[label.toLowerCase().replace(/\s+/g, '')] = parseInt(number) || 0;
    }
    
    return stats;
  }

  /**
   * Filter results by severity
   * @param {string} severity - Severity level (ALL, CRITICAL, HIGH, MEDIUM, LOW, INFO)
   */
  async filterBySeverity(severity) {
    await this.severityFilter.selectOption(severity);
    
    // Wait for filter to apply
    await this.page.waitForTimeout(1000);
  }

  /**
   * Switch to a specific results tab
   * @param {string} tab - Tab name (overview, semgrep, trivy)
   */
  async switchToTab(tab) {
    const tabMap = {
      overview: this.overviewTab,
      semgrep: this.semgrepTab,
      trivy: this.trivyTab
    };
    
    const tabElement = tabMap[tab.toLowerCase()];
    if (tabElement) {
      await tabElement.click();
      await this.page.waitForTimeout(500);
    } else {
      throw new Error(`Unknown tab: ${tab}`);
    }
  }

  /**
   * Download scan report
   * @param {string} format - Report format (json or pdf)
   */
  async downloadReport(format) {
    const downloadPromise = this.page.waitForDownload();
    
    if (format.toLowerCase() === 'json') {
      await this.downloadJsonButton.click();
    } else if (format.toLowerCase() === 'pdf') {
      await this.downloadPdfButton.click();
    } else {
      throw new Error(`Unknown format: ${format}`);
    }
    
    const download = await downloadPromise;
    return download;
  }

  /**
   * Get the number of result cards displayed
   * @returns {Promise<number>} Number of result cards
   */
  async getResultsCount() {
    await this.page.waitForTimeout(1000);
    const cards = await this.resultCards.all();
    return cards.length;
  }

  /**
   * Click on a result card to expand it
   * @param {number} index - Index of the result card (0-based)
   */
  async expandResultCard(index) {
    const cards = await this.resultCards.all();
    if (index < cards.length) {
      await cards[index].click();
      await this.page.waitForTimeout(500);
    } else {
      throw new Error(`Result card index ${index} not found`);
    }
  }

  /**
   * Start a new scan (reset application state)
   */
  async startNewScan() {
    await this.newScanButton.click();
    
    // Wait for upload section to be visible
    await expect(this.dropzone.or(this.repositoryUrlInput)).toBeVisible();
  }

  /**
   * Wait for and verify a toast notification
   * @param {string} message - Expected message text
   * @param {string} type - Toast type (success, error, loading)
   */
  async waitForToast(message, type = 'success') {
    // Multiple strategies to find react-hot-toast notifications
    const toastLocator = this.page.locator(`text=${message}`).or(
      this.page.locator(`div:has-text("${message}")`).or(
        this.page.locator(`[data-hot-toast]:has-text("${message}")`).or(
          this.page.locator(`[role="status"]:has-text("${message}")`).or(
            this.toastNotifications.filter({ hasText: message })
          )
        )
      )
    );
    
    await expect(toastLocator).toBeVisible({ timeout: 15000 });
    
    if (type !== 'loading') {
      // For success/error toasts, wait a bit then check if they disappear
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Verify application is in initial state
   */
  async verifyInitialState() {
    await expect(this.appTitle).toBeVisible();
    await expect(this.dropzone.or(this.repositoryUrlInput)).toBeVisible();
    await expect(this.page.locator('h2', { hasText: 'Upload a Plugin or Repository' })).toBeVisible();
  }

  /**
   * Verify scanner selection state
   * @param {string} filename - Name of uploaded file or repository
   */
  async verifyScannerSelectionState(filename) {
    await expect(this.page.locator('h2', { hasText: 'Select Security Scanners' })).toBeVisible();
    await expect(this.page.locator(`text=${filename}`)).toBeVisible();
    await expect(this.startScanButton).toBeVisible();
  }

  /**
   * Verify scan progress state
   */
  async verifyScanProgressState() {
    await expect(this.progressSection).toBeVisible();
    await expect(this.currentToolIndicator.or(this.progressBar)).toBeVisible();
  }

  /**
   * Verify scan results state
   */
  async verifyScanResultsState() {
    await expect(this.resultsSection).toBeVisible();
    await expect(this.summaryStats).toBeVisible();
    await expect(this.downloadJsonButton).toBeVisible();
    await expect(this.downloadPdfButton).toBeVisible();
  }
}
