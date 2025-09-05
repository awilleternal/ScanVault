import { useEffect, useRef } from 'react';

/**
 * Component for monitoring scan progress in real-time
 * @param {Object} props
 * @param {string} props.currentTool - Currently running tool
 * @param {number} props.progressPercent - Progress percentage (0-100)
 * @param {string[]} props.logs - Array of log messages
 * @param {number} [props.discoveredCount] - Number of vulnerabilities discovered so far
 * @returns {JSX.Element}
 */
function ProgressMonitor({
  currentTool,
  progressPercent,
  logs,
  discoveredCount = 0,
}) {
  const logsEndRef = useRef(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /**
   * Get status color based on progress
   */
  const getProgressColor = () => {
    if (progressPercent < 33) return 'bg-primary-400';
    if (progressPercent < 66) return 'bg-primary-500';
    return 'bg-primary-600';
  };

  /**
   * Format log message with timestamp
   * @param {string} log - Log message
   * @param {number} _index - Log index (unused)
   */
  const formatLog = (log, _index) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `[${timestamp}] ${log}`;
  };

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Security Scan in Progress
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {currentTool
                ? `Running ${currentTool}...`
                : 'Initializing scan...'}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <span className="text-2xl font-bold text-primary-600">
                  {progressPercent}%
                </span>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
              {discoveredCount > 0 && (
                <div className="text-center">
                  <span className="text-2xl font-bold text-red-600">
                    {discoveredCount}
                  </span>
                  <p className="text-xs text-gray-500">Found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`${getProgressColor()} h-full transition-all duration-500 ease-out relative`}
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent > 0 && (
                <div className="absolute inset-0 animate-scan" />
              )}
            </div>
          </div>
        </div>

        {/* Current tool indicator */}
        {currentTool && (
          <div className="mt-4 flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-700">
                Active Tool:
              </span>
            </div>
            <span className="text-sm text-gray-900 font-semibold">
              {currentTool}
            </span>
          </div>
        )}
      </div>

      {/* Live logs */}
      <div className="card">
        <h4 className="text-base font-medium text-gray-900 mb-3">
          Live Scan Output
        </h4>
        <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-400">Waiting for scan output...</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="text-gray-300 hover:bg-gray-800 px-2 py-0.5 rounded"
                >
                  {formatLog(log, index)}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Scan statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-900">
                Scan Started
              </p>
              <p className="text-2xl font-semibold text-primary-700">
                {new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <svg
              className="w-8 h-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <div className="card bg-gray-50 border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Files Scanned</p>
              <p className="text-2xl font-semibold text-gray-700">
                {Math.floor(progressPercent / 10) || '---'}
              </p>
            </div>
            <svg
              className="w-8 h-8 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </div>

        <div
          className={`card ${discoveredCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-medium ${discoveredCount > 0 ? 'text-red-900' : 'text-gray-900'}`}
              >
                Vulnerabilities Found
              </p>
              <p
                className={`text-2xl font-semibold ${discoveredCount > 0 ? 'text-red-700' : 'text-gray-700'}`}
              >
                {discoveredCount}
              </p>
            </div>
            <svg
              className="w-8 h-8 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProgressMonitor;
