# Implementation Plan

## M1 — Upload & ZIP Validation

- [ ] 1. Set up minimal project structure
  - Create frontend and backend directories with package.json files
  - Configure TypeScript, React (Vite), Express with essential dependencies only
  - Set up basic npm scripts: dev, dev:frontend, dev:backend, test, build
  - Add Vitest for testing, ESLint and Prettier with minimal configuration
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 2. Create file upload component
  - Build UploadComponent with drag-and-drop for ZIP files
  - Add basic file validation (ZIP type, 100MB size limit)
  - Include repository URL input with simple URL validation
  - Add loading states and error display
  - Write component tests using React Testing Library
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3. Build file handler service
  - Create FileHandlerService with ZIP extraction using node-stream-zip
  - Implement secure path sanitization and temp directory management
  - Add repository cloning with simple-git
  - Include proper cleanup and error handling
  - Write unit tests using Vitest with mocked file system operations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.3_

- [ ] 4. Create upload API endpoint
  - Implement POST /api/upload with Multer for file handling
  - Add POST /api/clone for repository URLs
  - Return structured responses with upload/clone IDs
  - Include basic error handling and validation
  - Write integration tests for both endpoints
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## M2 — Mocked Scan Flow

- [x] 5. Build scanner selection UI



  - Create ScannerSelectionComponent with tool checkboxes
  - Add validation to ensure at least one tool is selected
  - Show tool availability status (available/unavailable)
  - Include estimated scan times for each tool
  - Write component tests for selection validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 6. Create scan orchestrator with mocked tools
  - Build ScanOrchestratorService with in-memory scan sessions
  - Implement mocked Semgrep and Trivy runners returning sample vulnerabilities
  - Add scan lifecycle management (running, completed, failed)
  - Include result aggregation and basic deduplication
  - Write unit tests using Vitest for orchestration logic
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 4.5_

- [ ] 7. Add WebSocket progress monitoring
  - Set up WebSocket server for real-time scan updates
  - Create ProgressMonitorComponent showing current tool and progress
  - Implement scan log streaming with timestamps
  - Add progress percentage calculation
  - Write integration tests for WebSocket communication
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 8. Create scan and results APIs
  - Implement POST /api/scan endpoint with tool selection
  - Add GET /api/scan/:scanId/results for retrieving scan results
  - Include scan status tracking and metadata
  - Integrate with ScanOrchestratorService
  - Write API integration tests with mocked results
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

## M3 — WSL2 Integration (Real Commands, Feature-Detected)

- [ ] 9. Build WSL2 bridge with feature detection
  - Create WSL2BridgeService with availability checking (wsl.exe --status)
  - Implement secure command execution using spawn with argument arrays
  - Add WSL path translation using wslpath utility
  - Include MOCK_WSL2 environment variable for CI/dev mode
  - Write unit tests using Vitest for command execution and mocked mode
  - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [ ] 10. Implement real Semgrep integration
  - Add Semgrep command execution with JSON output parsing
  - Create vulnerability mapping from Semgrep format to standard format
  - Implement timeout handling and error recovery
  - Include sample Semgrep output for testing
  - Write unit tests using Vitest for Semgrep result parsing
  - _Requirements: 9.1, 9.4_

- [ ] 11. Implement real Trivy integration
  - Add Trivy command execution with JSON output parsing
  - Create vulnerability mapping from Trivy format to standard format
  - Implement filesystem scanning mode
  - Include sample Trivy output for testing
  - Write unit tests using Vitest for Trivy result parsing
  - _Requirements: 9.2, 9.4_

- [ ] 12. Add ODC integration with Windows detection
  - Create ODCIntegrationService with platform detection
  - Implement ODC command execution and report parsing
  - Add ENABLE_ODC environment variable for feature flagging
  - Include Windows-only availability messaging in UI
  - Write unit tests using Vitest with conditional execution based on platform
  - _Requirements: 2.1, 2.2_

- [ ] 13. Integrate real tools with orchestrator
  - Update ScanOrchestratorService to use real tool services
  - Add tool availability detection and graceful fallback
  - Implement proper error handling for tool failures
  - Update UI to show actual tool availability status
  - Write integration tests with both mocked and real tool modes
  - _Requirements: 3.6, 9.1, 9.2, 9.4, 9.5_

- [ ] 14. Add Playwright E2E tests
  - Set up Playwright with mocked tool configuration
  - Write complete workflow test: upload → select tools → scan → results
  - Add test for repository URL workflow
  - Include error scenario testing (invalid files, no tools selected)
  - Create optional real-tool E2E test gated by environment variable
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

## M4 — Reports

- [ ] 15. Build results dashboard
  - Create ResultsDashboardComponent with severity grouping
  - Add expandable vulnerability details with file/line information
  - Implement basic filtering by severity level
  - Show vulnerability summary statistics
  - Write component tests for result display
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 16. Implement report generation
  - Create ReportGeneratorService for JSON and PDF formats
  - Add JSON report with complete scan metadata and findings
  - Implement simple PDF generation using HTML-to-PDF conversion
  - Include executive summary with vulnerability counts by severity
  - Write unit tests using Vitest for report generation logic
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 17. Add report download functionality
  - Create GET /api/scan/:scanId/report/:format endpoint
  - Add download buttons in ResultsDashboard for JSON and PDF
  - Implement proper Content-Type headers and file streaming
  - Include descriptive filenames with timestamps
  - Write integration tests for report download
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 18. Add suggested fixes display
  - Enhance vulnerability display with remediation suggestions
  - Include code examples and configuration recommendations
  - Add external reference links for vulnerability types
  - Show fix difficulty and effectiveness ratings
  - Write component tests for fix suggestion rendering
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
