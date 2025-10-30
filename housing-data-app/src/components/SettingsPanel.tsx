import { useState } from 'react';
import { CSVProvider, clearProviderCache } from '../services/providers';
import { IndexedDBCache } from '../utils/indexedDBCache';
import { ApiStatusIndicator } from './ApiStatusIndicator';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsPanelProps {
  onDataChange?: () => void;
}

export const SettingsPanel = ({ onDataChange }: SettingsPanelProps) => {
  const { theme, toggleTheme } = useTheme();
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Settings</h3>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          {showDebug ? 'Hide' : 'Show'} Debug Info
        </button>
      </div>

      {/* Dark Mode Toggle */}
      <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Appearance</h4>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Click to toggle
          </span>
        </button>
      </div>

      {/* Data Source Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Source</h4>
          <ApiStatusIndicator hasError={false} dataSource="mock" />
        </div>

        {isConfigured && currentFile ? (
          <div className={`border rounded-lg px-3 py-2 ${
            isUsingDefault
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className={`text-lg flex-shrink-0 ${
                  isUsingDefault ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {isUsingDefault ? '📊' : '✓'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${
                    isUsingDefault ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300'
                  }`}>
                    {isUsingDefault ? 'Default Zillow ZHVI data' : currentFile}
                  </p>
                  <p className={`text-xs ${
                    isUsingDefault ? 'text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'
                  }`}>
                    {totalMarkets.toLocaleString()} markets loaded
                  </p>
                  <p className={`text-xs ${
                    isUsingDefault ? 'text-blue-600 dark:text-blue-500' : 'text-green-600 dark:text-green-500'
                  }`}>
                    Source: {dataSource === 'default' ? 'Default dataset' : 'Custom upload'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-slate-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">No data loaded</p>
          </div>
        )}
      </div>

      {/* Debug Information */}
      {showDebug && (
        <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-slate-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Debug Info</h4>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Provider:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">CSV</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Markets loaded:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{totalMarkets.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Data source:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{dataSource}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Filename:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100 truncate ml-2" title={currentFile || 'None'}>
                {currentFile || 'None'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Using default:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{isUsingDefault ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Configured:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{isConfigured ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Actions</h4>

        <div className="space-y-2">
          {!isUsingDefault && (
            <button
              onClick={handleResetToDefault}
              disabled={resetting || clearing}
              className="w-full px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? 'Resetting...' : '↺ Reset to Default Data'}
            </button>
          )}

          <button
            onClick={handleClearCache}
            disabled={clearing || resetting}
            className="w-full px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing...' : '🗑️ Clear All Cache'}
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 <strong>Tip:</strong> Clear cache if you see old data or want to reload the default dataset.
        </p>
      </div>
    </div>
  );
};
