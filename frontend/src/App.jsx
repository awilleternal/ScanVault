import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import UploadComponent from './components/UploadComponent';
import ScannerSelection from './components/ScannerSelection';
import ProgressMonitor from './components/ProgressMonitor';
import ResultsDashboard from './components/ResultsDashboard';
import LiveVulnerabilityFeed from './components/LiveVulnerabilityFeed';
import { WebSocketService } from './services/websocket';
import { startScan, getScanResults, downloadReport } from './services/api';

/**
 * ScanVault - Advanced Security Intelligence Platform
 * Main application component for comprehensive vulnerability scanning
 * @returns {JSX.Element} The main app component
 */
function App() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, selecting, scanning, completed
  const [scanResults, setScanResults] = useState(null);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [scanProgress, setScanProgress] = useState({
    currentTool: '',
    progressPercent: 0,
    logs: [],
  });

  // New state for real-time vulnerability discovery
  const [discoveredVulnerabilities, setDiscoveredVulnerabilities] = useState([]);
  const [latestVulnerability, setLatestVulnerability] = useState(null);

  /**
   * Handle file upload
   * @param {Object} fileData - The uploaded file data
   */
  const handleFileUploaded = (fileData) => {
    setUploadedFile(fileData);
    setScanStatus('selecting');
  };

  /**
   * Start the security scan
   * @param {string[]} selectedTools - Array of selected security tools
   */
  const handleStartScan = async (selectedTools) => {
    try {
      setScanStatus('scanning');
      
      // Reset vulnerability state for new scan
      setDiscoveredVulnerabilities([]);
      setLatestVulnerability(null);
      
      // Start the scan
      const scanResponse = await startScan(uploadedFile.id, selectedTools);
      setCurrentScanId(scanResponse.scanId);
      
      // Connect to WebSocket for progress updates
      const wsService = new WebSocketService();
      
      // Fallback simulation if WebSocket fails
      let fallbackTimeout;
      const simulateProgress = () => {
        let progress = 0;
        const tools = selectedTools;
        let currentToolIndex = 0;
        
        const interval = setInterval(() => {
          progress += 15;
          const currentTool = tools[currentToolIndex] || 'Scanning';
          
          setScanProgress({
            currentTool,
            progressPercent: Math.min(progress, 100),
            logs: [...scanProgress.logs, `${currentTool} scanning... ${Math.min(progress, 100)}%`],
          });
          
          if (progress >= 50 && currentToolIndex < tools.length - 1) {
            currentToolIndex++;
            progress = 50;
          }
          
          if (progress >= 100) {
            clearInterval(interval);
            // Wait for actual results from backend, then fetch them automatically
            setTimeout(async () => {
              try {
                console.log('Fallback: Fetching scan results after completion');
                const results = await getScanResults(scanResponse.scanId);
                setScanResults(results.results);
                setScanStatus('completed');
              } catch (error) {
                console.error('Fallback: Failed to get scan results:', error);
                setScanStatus('error');
              }
            }, 2000);
          }
        }, 800);
        
        return interval;
      };
      
      wsService.connect(scanResponse.scanId, {
        onProgress: (data) => {
          if (fallbackTimeout) {
            clearInterval(fallbackTimeout);
            fallbackTimeout = null;
          }
          setScanProgress({
            currentTool: data.currentTool,
            progressPercent: data.progressPercent,
            logs: [...scanProgress.logs, data.message],
          });
        },
        
        // NEW: Handle real-time vulnerability discovery
        onVulnerability: (data) => {
          console.log('New vulnerability discovered:', data.vulnerability);
          
          // Add to discovered vulnerabilities list
          setDiscoveredVulnerabilities(prev => [...prev, data.vulnerability]);
          
          // Set as latest for animation
          setLatestVulnerability(data.vulnerability);
          
          // Update logs with vulnerability discovery
          setScanProgress(prev => ({
            ...prev,
            logs: [...prev.logs, `🚨 Found ${data.vulnerability.severity} vulnerability: ${data.vulnerability.type} in ${data.vulnerability.file}`],
          }));
        },
        
        onComplete: async () => {
          // Get final results
          try {
            const results = await getScanResults(scanResponse.scanId);
            setScanResults(results.results);
            setScanStatus('completed');
          } catch (error) {
            console.error('Failed to get scan results:', error);
            // Show error state instead of mocked results
            setScanStatus('error');
          }
          wsService.disconnect();
        },
        onError: (error) => {
          console.error('WebSocket error, using fallback:', error);
          // Start fallback simulation
          fallbackTimeout = simulateProgress();
        },
        onClose: () => {
          console.log('WebSocket closed, using fallback');
          // Start fallback simulation if not already running
          if (!fallbackTimeout) {
            fallbackTimeout = simulateProgress();
          }
        },
      });
      
    } catch (error) {
      console.error('Failed to start scan:', error);
      setScanStatus('selecting');
    }
  };

  /**
   * Reset the application to start a new scan
   */
  const handleNewScan = () => {
    setUploadedFile(null);
    setScanStatus('idle');
    setScanResults(null);
    setCurrentScanId(null);
    setScanProgress({
      currentTool: '',
      progressPercent: 0,
      logs: [],
    });
    setDiscoveredVulnerabilities([]);
    setLatestVulnerability(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <svg className="w-8 h-8 text-primary-600 mr-3" fill="currentColor" viewBox="0 0 32 32">
                  <defs>
                    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor: 'currentColor', stopOpacity: 1}} />
                      <stop offset="100%" style={{stopColor: 'currentColor', stopOpacity: 0.8}} />
                    </linearGradient>
                  </defs>
                  <path d="M16 2l-12 4v8c0 8 12 16 12 16s12-8 12-16V6l-12-4z" fill="url(#headerGrad)"/>
                  <circle cx="16" cy="16" r="4" fill="none" stroke="white" strokeWidth="1.5"/>
                  <path d="M14 16l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">ScanVault</h1>
                  <p className="text-xs text-primary-600 font-medium -mt-1">Security Intelligence Platform</p>
                </div>
              </div>
            </div>
            {scanStatus !== 'idle' && (
              <button
                onClick={handleNewScan}
                className="btn btn-secondary"
              >
                New Scan
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {scanStatus === 'idle' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Advanced Security Scanning
              </h2>
              <p className="text-lg text-gray-600">
                Upload plugins, repositories, or applications for comprehensive vulnerability analysis
              </p>
            </div>
            <UploadComponent
              onFileSelect={handleFileUploaded}
              onUrlSubmit={handleFileUploaded}
              isLoading={false}
            />
          </div>
        )}

        {scanStatus === 'selecting' && uploadedFile && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Select Security Scanners</h2>
              <p className="text-gray-600">
                Choose which security tools to run on: <span className="font-medium">{uploadedFile.fileName || uploadedFile.repositoryUrl}</span>
              </p>
            </div>
            <ScannerSelection
              availableTools={['Semgrep', 'Trivy', 'OWASP Dependency Check']}
              selectedTools={[]}
              onStart={handleStartScan}
            />
          </div>
        )}

        {scanStatus === 'scanning' && (
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <ProgressMonitor
                  currentTool={scanProgress.currentTool}
                  progressPercent={scanProgress.progressPercent}
                  logs={scanProgress.logs}
                  discoveredCount={discoveredVulnerabilities.length}
                />
              </div>
              <div>
                <LiveVulnerabilityFeed
                  discoveredVulnerabilities={discoveredVulnerabilities}
                  latestVulnerability={latestVulnerability}
                />
              </div>
            </div>
          </div>
        )}

        {scanStatus === 'completed' && scanResults && (
          <ResultsDashboard
            scanResults={scanResults}
            onDownload={async (format) => {
              try {
                if (currentScanId) {
                  await downloadReport(currentScanId, format);
                  // Could add a success toast here if desired
                } else {
                  console.error('No scan ID available for download');
                  alert('Error: No scan ID available for download');
                }
              } catch (error) {
                console.error('Download failed:', error);
                // Show user-friendly error message
                alert(`Download failed: ${error.message}`);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
