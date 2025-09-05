# Design Document

## Overview

A minimal web app that scans uploaded ZIP plugins or repository URLs using Semgrep and Trivy (via WSL2). ODC (OWASP Dependency Check) is optional and only enabled on Windows. The app provides upload, tool selection, real-time progress, results grouped by severity, and downloadable reports. No auth, no long-term storage, no complex infrastructure.

## Architecture

### High-Level Architecture

```
Frontend (React + TypeScript)  <-->  Backend (Node + Express)
frontend: upload, scanner UI, progress, results, downloads
backend: upload handling, scan orchestrator, WSL2 bridge, report generator
Tools: Semgrep CLI, Trivy CLI (run via WSL2)
```

### Technology Stack

**Frontend:**

- React + TypeScript (Vite)
- Tailwind CSS (optional but helpful)
- React Hook Form (simple forms)

**Backend:**

- Node.js + Express (TypeScript)
- Multer (file uploads)
- node-stream-zip (ZIP extraction)
- child_process (spawn/execFile) to invoke WSL
- ws (WebSocket) for progress updates

**Testing:**

- Vitest (unit)
- React Testing Library (components)
- Playwright (E2E; mocked by default)

**Reports:**

- JSON (native)
- PDF (generate from HTML or lightweight library)

## Core Frontend Components (Essential Props)

#### UploadComponent

```typescript
interface UploadComponentProps {
  onFileSelect: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  isLoading: boolean;
}
```

- Validates ZIP and basic URL format

#### ScannerSelection

```typescript
interface ScannerSelectionProps {
  availableTools: string[];
  selectedTools: string[];
  onStart: () => void;
}
```

- Ensures at least one tool selected

#### ProgressMonitor

```typescript
interface ProgressMonitorProps {
  currentTool: string;
  progressPercent: number;
  logs: string[];
}
```

- Receives updates over WebSocket

#### ResultsDashboard

```typescript
interface ResultsDashboardProps {
  scanResults: ScanResult[];
  onDownload: (format: 'json' | 'pdf') => void;
}
```

- Groups by severity, expandable items

## Essential Backend APIs

```typescript
POST /api/upload — multipart/form-data
Response: { id, fileName, extractedPath }

POST /api/clone — { repositoryUrl }
Response: { id, repositoryName, extractedPath }

POST /api/scan — { targetId, selectedTools[] }
Response: { scanId, websocketUrl }

GET /api/scan/:scanId/results — returns aggregated results (JSON)

GET /api/scan/:scanId/report/:format — format = json | pdf (download)
```

## Essential Backend Services (Signatures Only)

#### FileHandler

```typescript
handleUpload(file): { id, path }
extractZip(path): extractedPath
cloneRepository(url): extractedPath
cleanup(path)
```

#### WSL2Bridge

```typescript
runSemgrep(targetPath): SemgrepResult
runTrivy(targetPath): TrivyResult
isAvailable(): boolean
// Support mocked mode via env var for CI/dev
```

#### ScanOrchestrator

```typescript
startScan(targetPath, tools[]): scanId
// Reports progress via WebSocket
// Aggregates and deduplicates results
// Enforces per-tool timeouts
```

#### ReportGenerator

```typescript
generateJSON(scanId);
generatePDF(scanId); // Simple HTML->PDF
```

## Data Handling (Minimal)

Keep state in memory during a scan (per-scan temp folder + in-memory scan object).
Persisting scans is optional; default mode: ephemeral (temp dirs + memory).
If persistence is later required, add SQLite as a separate milestone.

### Minimal ScanSession Shape

```typescript
{
  id: string,
  targetPath: string,
  selectedTools: string[],
  status: 'running'|'completed'|'failed',
  results: ToolResult[],
  startTime: Date,
  endTime?: Date
}
```

## Security & Safety (Must-Have)

- Never pass user input into a shell string — use spawn/execFile with argument arrays
- Extract ZIPs into a temporary sandbox directory with strict permissions
- Validate file is ZIP and limit accepted file size
- Enforce tool timeouts and memory limits; capture exit codes and partial output
- Convert Windows paths to WSL paths with wslpath when invoking WSL
- If WSL2 unavailable, disable Semgrep/Trivy options and return friendly message

## Error Handling (Essential)

- Structured error responses with status codes
- If a tool fails, mark its result as error but continue other tools
- Provide meaningful client-facing messages for upload/URL/WSL issues

## Testing Strategy (Essential + Pragmatic)

### Unit (Vitest)

FileHandler, WSL2Bridge parsing, ScanOrchestrator logic (mock tool outputs)

### Component (RTL)

Upload + ScannerSelection + Results basic behaviors

### E2E (Playwright)

Full workflow using mocked tools (fast). Real-tool E2E only in manual/dev mode with WSL2 available

### Coverage Target

≥80% initially

## Minimal Dev Commands (package.json scripts)

```bash
npm install
npm run dev          # starts frontend + backend (concurrently)
npm run dev:frontend
npm run dev:backend
npm test             # vitest
npm run test:e2e     # playwright (mocked mode)
npm run build
```

## Env Examples

```bash
NODE_ENV=development
MOCK_WSL2=true       # default for CI/dev
ENABLE_ODC=false     # optional, Windows-only
```

## Incremental Milestones (Essential Path)

### M1 — Upload & ZIP validation

Upload UI + backend upload/extract
Unit tests for FileHandler

### M2 — Mocked scan flow

Scanner UI + orchestrator with mocked Semgrep/Trivy outputs
WebSocket progress updates
Component & unit tests

### M3 — WSL2 integration (real commands, feature-detected)

WSL2Bridge with MOCK_WSL2=false support
Real parsing of Semgrep/Trivy outputs
Add Playwright E2E (mocked) + optional manual E2E with WSL2

### M4 — Reports

JSON + PDF generation and download
