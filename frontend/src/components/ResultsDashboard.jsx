import { useState } from 'react';

/**
 * Component for displaying scan results with severity grouping
 * @param {Object} props
 * @param {Array} props.scanResults - Array of vulnerability findings
 * @param {Function} props.onDownload - Callback for downloading reports
 * @returns {JSX.Element}
 */
function ResultsDashboard({ scanResults, onDownload }) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [activeTab, setActiveTab] = useState('overview');

  // Separate results by tool
  const semgrepResults = scanResults.filter(
    (result) => result.tool === 'Semgrep'
  );
  const trivyResults = scanResults.filter((result) => result.tool === 'Trivy');
  const odcResults = scanResults.filter(
    (result) => result.tool === 'OWASP Dependency Check'
  );

  // Group results by severity for each tool
  const groupResultsBySeverity = (results) =>
    results.reduce((acc, result) => {
      const severity = result.severity || 'INFO';
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(result);
      return acc;
    }, {});

  const groupedResults = groupResultsBySeverity(scanResults);
  const semgrepGrouped = groupResultsBySeverity(semgrepResults);
  const trivyGrouped = groupResultsBySeverity(trivyResults);
  const odcGrouped = groupResultsBySeverity(odcResults);

  // Severity levels with styling
  const severityConfig = {
    CRITICAL: {
      color: 'text-red-800',
      bg: 'bg-red-100',
      border: 'border-red-200',
      icon: '🚨',
      description: 'Immediate action required',
    },
    HIGH: {
      color: 'text-orange-800',
      bg: 'bg-orange-100',
      border: 'border-orange-200',
      icon: '⚠️',
      description: 'Should be fixed soon',
    },
    MEDIUM: {
      color: 'text-yellow-800',
      bg: 'bg-yellow-100',
      border: 'border-yellow-200',
      icon: '⚡',
      description: 'Fix when possible',
    },
    LOW: {
      color: 'text-blue-800',
      bg: 'bg-blue-100',
      border: 'border-blue-200',
      icon: 'ℹ️',
      description: 'Minor issues',
    },
    INFO: {
      color: 'text-gray-800',
      bg: 'bg-gray-100',
      border: 'border-gray-200',
      icon: '💡',
      description: 'Informational',
    },
  };

  // Calculate statistics for each tool
  const calculateStats = (grouped) => ({
    total: Object.values(grouped).flat().length,
    critical: grouped.CRITICAL?.length || 0,
    high: grouped.HIGH?.length || 0,
    medium: grouped.MEDIUM?.length || 0,
    low: grouped.LOW?.length || 0,
    info: grouped.INFO?.length || 0,
  });

  const overallStats = calculateStats(groupedResults);
  const semgrepStats = calculateStats(semgrepGrouped);
  const trivyStats = calculateStats(trivyGrouped);
  const odcStats = calculateStats(odcGrouped);

  // Get current results based on active tab
  const getCurrentResults = () => {
    let currentResults;
    switch (activeTab) {
      case 'semgrep':
        currentResults = semgrepResults;
        break;
      case 'trivy':
        currentResults = trivyResults;
        break;
      case 'odc':
        currentResults = odcResults;
        break;
      default:
        currentResults = scanResults;
    }

    return filterSeverity === 'ALL'
      ? currentResults
      : currentResults.filter((r) => r.severity === filterSeverity);
  };

  const filteredResults = getCurrentResults();

  // Get current stats based on active tab
  const getCurrentStats = () => {
    switch (activeTab) {
      case 'semgrep':
        return semgrepStats;
      case 'trivy':
        return trivyStats;
      case 'odc':
        return odcStats;
      default:
        return overallStats;
    }
  };

  const currentStats = getCurrentStats();

  /**
   * Toggle expanded state of a result item
   */
  const toggleExpanded = (resultId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Security Scan Results Summary
        </h2>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview ({overallStats.total})
            </button>
            <button
              onClick={() => setActiveTab('semgrep')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'semgrep'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔍 Semgrep - Code Issues ({semgrepStats.total})
            </button>
            <button
              onClick={() => setActiveTab('trivy')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trivy'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📦 Trivy - Dependencies ({trivyStats.total})
            </button>
            <button
              onClick={() => setActiveTab('odc')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'odc'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🛡️ ODC - Known CVEs ({odcStats.total})
            </button>
          </nav>
        </div>

        {/* Tool-specific descriptions */}
        {activeTab === 'semgrep' && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Semgrep</span> finds security
                  vulnerabilities, bugs, and anti-patterns in your source code.
                  These issues are found in your application logic and require
                  code changes to fix.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trivy' && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Trivy</span> scans your
                  dependencies and container images for known security
                  vulnerabilities. These issues can be fixed by updating to
                  newer, patched versions of your dependencies.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'odc' && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-orange-700">
                  <span className="font-medium">OWASP Dependency Check</span>{' '}
                  identifies project dependencies and checks for known, publicly
                  disclosed vulnerabilities. These CVE vulnerabilities can be
                  fixed by updating to patched versions or removing vulnerable
                  dependencies.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">
              {currentStats.total}
            </p>
            <p className="text-sm text-gray-600">Total Issues</p>
          </div>
          {Object.entries(severityConfig).map(([severity, config]) => (
            <div key={severity} className="text-center">
              <p className={`text-3xl font-bold ${config.color}`}>
                {currentStats[severity.toLowerCase()]}
              </p>
              <p className="text-sm text-gray-600">{severity}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <label
              htmlFor="severity-filter"
              className="text-sm font-medium text-gray-700 mr-2"
            >
              Filter by severity:
            </label>
            <select
              id="severity-filter"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="input inline-block w-auto"
            >
              <option value="ALL">All Severities</option>
              {Object.keys(severityConfig).map((severity) => (
                <option key={severity} value={severity}>
                  {severity} ({currentStats[severity.toLowerCase()]})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onDownload('json')}
              className="btn btn-secondary"
            >
              <svg
                className="w-4 h-4 mr-2 inline"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Download JSON
            </button>
            <button
              onClick={() => onDownload('pdf')}
              className="btn btn-primary"
            >
              <svg
                className="w-4 h-4 mr-2 inline"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Download PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <div className="card text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg text-gray-600">
              {filterSeverity === 'ALL'
                ? 'No security issues found! Your code is clean.'
                : `No ${filterSeverity} severity issues found.`}
            </p>
          </div>
        ) : (
          filteredResults.map((result) => {
            const config =
              severityConfig[result.severity] || severityConfig.INFO;
            const isExpanded = expandedItems.has(result.id);

            // Add tool-specific styling
            const toolConfig = {
              Semgrep: {
                accent: 'border-blue-500',
                bgAccent: 'bg-blue-50',
                iconBg: 'bg-blue-100',
                icon: '🔍',
                label: 'Code Analysis',
              },
              Trivy: {
                accent: 'border-green-500',
                bgAccent: 'bg-green-50',
                iconBg: 'bg-green-100',
                icon: '📦',
                label: 'Dependency Scan',
              },
              'OWASP Dependency Check': {
                accent: 'border-orange-500',
                bgAccent: 'bg-orange-50',
                iconBg: 'bg-orange-100',
                icon: '🛡️',
                label: 'CVE Database',
              },
            };

            const currentToolConfig = toolConfig[result.tool] || {
              accent: 'border-gray-500',
              bgAccent: 'bg-gray-50',
              iconBg: 'bg-gray-100',
              icon: '🔧',
              label: 'Security Tool',
            };

            return (
              <div
                key={result.id}
                className={`card border-l-4 ${config.border} ${config.bg} relative`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => toggleExpanded(result.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{config.icon}</span>
                        <span className={`font-semibold ${config.color}`}>
                          {result.severity}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${currentToolConfig.bgAccent} ${currentToolConfig.accent.replace('border-', 'text-')}`}
                          >
                            <span className="mr-1">
                              {currentToolConfig.icon}
                            </span>
                            {result.tool}
                          </span>
                          <span className="text-xs text-gray-500">
                            {currentToolConfig.label}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-base font-medium text-gray-900">
                        {result.type}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {result.file}:{result.line}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">
                          Description
                        </h5>
                        <p className="text-sm text-gray-600 mt-1">
                          {result.description}
                        </p>
                      </div>

                      {result.fix && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700">
                            Suggested Fix
                          </h5>
                          <p className="text-sm text-gray-600 mt-1">
                            {result.fix}
                          </p>
                        </div>
                      )}

                      {result.references && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700">
                            References
                          </h5>
                          <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                            {result.references.map((ref, idx) => (
                              <li key={idx}>
                                <a
                                  href={ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:underline"
                                >
                                  {ref}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ResultsDashboard;
