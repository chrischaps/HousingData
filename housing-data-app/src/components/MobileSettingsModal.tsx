import { useState } from 'react';
import { CSVProvider, clearProviderCache } from '../services/providers';
import { IndexedDBCache } from '../utils/indexedDBCache';
import { ApiStatusIndicator } from './ApiStatusIndicator';

interface MobileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
}

/**
 * Mobile-optimized settings modal (full-screen overlay)
 * Contains the same settings as desktop SettingsPanel
 */
export const MobileSettingsModal = ({ isOpen, onClose, onDataChange }: MobileSettingsModalProps) => {
  const [provider] = useState(() => new CSVProvider());
  const [showDebug, setShowDebug] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const currentFile = provider.getFilename();
  const isConfigured = provider.isConfigured();
  const dataSource = provider.getDataSource();
  const isUsingDefault = provider.isUsingDefaultData();
  const totalMarkets = provider.getAllMarkets().length;

  const handleClearCache = async () => {
    const confirmed = window.confirm(
      'Clear all cached data?\n\n' +
      'This will:\n' +
      '• Delete all cached market data from IndexedDB\n' +
      '• Reload the default CSV on next page load\n' +
      '• This action cannot be undone\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setClearing(true);

    try {
      // Clear provider cache first
      clearProviderCache();

      // Clear IndexedDB cache
      await IndexedDBCache.clear();

      // Clear localStorage metadata
      localStorage.removeItem('csv-file-name');
      localStorage.removeItem('csv-data-source');

      console.log('%c[Settings] Cache cleared successfully', 'color: #10B981; font-weight: bold');

      // Reload the page to re-initialize
      window.location.reload();
    } catch (error) {
      console.error('%c[Settings] Failed to clear cache', 'color: #EF4444; font-weight: bold', error);
      alert('Failed to clear cache. Please try again or clear browser data manually.');
      setClearing(false);
    }
  };

  const handleResetToDefault = async () => {
    const confirmed = window.confirm(
      'Reset to default data?\n\n' +
      'This will:\n' +
      '• Clear current data\n' +
      '• Reload the default Zillow ZHVI dataset\n' +
      '• Refresh the page\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setResetting(true);

    try {
      await provider.resetToDefault();
      console.log('%c[Settings] Reset to default data', 'color: #10B981; font-weight: bold');

      if (onDataChange) {
        onDataChange();
      }

      // Reload to ensure fresh state
      window.location.reload();
    } catch (error) {
      console.error('%c[Settings] Failed to reset', 'color: #EF4444; font-weight: bold', error);
      alert('Failed to reset to default data. Please try again.');
      setResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
      {/* Modal */}
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-t-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Data Source Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Data Source</h3>
              <ApiStatusIndicator hasError={false} dataSource="mock" />
            </div>

            {isConfigured && currentFile ? (
              <div className={`border rounded-lg px-4 py-3 ${
                isUsingDefault
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`text-xl flex-shrink-0 ${
                    isUsingDefault ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {isUsingDefault ? '📊' : '✓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      isUsingDefault ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300'
                    }`}>
                      {isUsingDefault ? 'Default Zillow ZHVI data' : currentFile}
                    </p>
                    <p className={`text-xs mt-1 ${
                      isUsingDefault ? 'text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'
                    }`}>
                      {totalMarkets.toLocaleString()} markets loaded
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      isUsingDefault ? 'text-blue-600 dark:text-blue-500' : 'text-green-600 dark:text-green-500'
                    }`}>
                      Source: {dataSource === 'default' ? 'Default dataset' : 'Custom upload'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 bg-gray-50 dark:bg-slate-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">No data loaded</p>
              </div>
            )}
          </div>

          {/* Debug Information */}
          <div className="space-y-3">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              {showDebug ? 'Hide' : 'Show'} Debug Info
            </button>

            {showDebug && (
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Provider:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">CSV</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Markets loaded:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{totalMarkets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Data source:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{dataSource}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Filename:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100 truncate ml-2" title={currentFile || 'None'}>
                    {currentFile || 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Using default:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{isUsingDefault ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Configured:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{isConfigured ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actions</h3>

            <div className="space-y-3">
              {!isUsingDefault && (
                <button
                  onClick={handleResetToDefault}
                  disabled={resetting || clearing}
                  className="w-full px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetting ? 'Resetting...' : '↺ Reset to Default Data'}
                </button>
              )}

              <button
                onClick={handleClearCache}
                disabled={clearing || resetting}
                className="w-full px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? 'Clearing...' : '🗑️ Clear All Cache'}
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              💡 <strong>Tip:</strong> Clear cache if you see old data or want to reload the default dataset.
            </p>
          </div>
        </div>

        {/* Bottom padding for safe area */}
        <div className="h-8"></div>
      </div>
    </div>
  );
};
