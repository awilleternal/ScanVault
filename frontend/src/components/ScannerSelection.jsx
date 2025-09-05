import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * Component for selecting security scanning tools
 * @param {Object} props
 * @param {string[]} props.availableTools - List of available security tools
 * @param {string[]} props.selectedTools - Currently selected tools
 * @param {Function} props.onStart - Callback to start scanning
 * @returns {JSX.Element}
 */
function ScannerSelection({
  availableTools,
  selectedTools: initialSelected,
  onStart,
}) {
  const [selectedTools, setSelectedTools] = useState(initialSelected);

  // Tool descriptions
  const toolInfo = {
    Semgrep: {
      description:
        'Static analysis tool for finding bugs, security issues, and anti-patterns',
      icon: '🔍',
      estimatedTime: '2-5 minutes',
      requirements: 'Requires WSL2 on Windows',
    },
    Trivy: {
      description:
        'Comprehensive vulnerability scanner for containers and other artifacts',
      icon: '🛡️',
      estimatedTime: '1-3 minutes',
      requirements: 'Requires WSL2 on Windows',
    },
    'OWASP Dependency Check': {
      description:
        'Identifies project dependencies and checks for known vulnerabilities',
      icon: '📦',
      estimatedTime: '3-7 minutes',
      requirements: 'Windows only (optional)',
    },
  };

  /**
   * Toggle tool selection
   * @param {string} tool - Tool name to toggle
   */
  const toggleTool = (tool) => {
    setSelectedTools((prev) => {
      if (prev.includes(tool)) {
        return prev.filter((t) => t !== tool);
      }
      return [...prev, tool];
    });
  };

  /**
   * Start the security scan
   */
  const handleStartScan = () => {
    if (selectedTools.length === 0) {
      toast.error('Please select at least one security tool');
      return;
    }
    onStart(selectedTools);
  };

  /**
   * Select all tools
   */
  const selectAll = () => {
    setSelectedTools(availableTools);
  };

  /**
   * Deselect all tools
   */
  const deselectAll = () => {
    setSelectedTools([]);
  };

  return (
    <div>
      {/* Quick actions */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Available Security Tools
        </h3>
        <div className="space-x-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Select All
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Tool selection */}
      <div className="space-y-3 mb-6">
        {availableTools.map((tool) => {
          const info = toolInfo[tool];
          const isSelected = selectedTools.includes(tool);

          return (
            <div
              key={tool}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleTool(tool)}
            >
              <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTool(tool)}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-medium text-gray-900">
                      <span className="mr-2">{info.icon}</span>
                      {tool}
                    </h4>
                    <span className="text-sm text-gray-500">
                      ~{info.estimatedTime}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {info.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {info.requirements}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary and start button */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Selected tools: {selectedTools.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Estimated total time:{' '}
              {selectedTools.length === 0
                ? '0 minutes'
                : `${selectedTools.length * 2}-${selectedTools.length * 5} minutes`}
            </p>
          </div>
          <button
            onClick={handleStartScan}
            disabled={selectedTools.length === 0}
            className="btn btn-primary"
          >
            Start Security Scan
          </button>
        </div>

        {selectedTools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
              >
                {toolInfo[tool].icon} {tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScannerSelection;
