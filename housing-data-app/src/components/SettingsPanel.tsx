import { useState } from 'react';
import { CSVProvider, clearProviderCache } from '../services/providers';
import { IndexedDBCache } from '../utils/indexedDBCache';
import { ApiStatusIndicator } from './ApiStatusIndicator';

interface SettingsPanelProps {
  onDataChange?: () => void;
}

export const SettingsPanel = ({ onDataChange }: SettingsPanelProps) => {
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
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Settings</h3>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {showDebug ? 'Hide' : 'Show'} Debug Info
        </button>
      </div>

      {/* Data Source Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Data Source</h4>
          <ApiStatusIndicator hasError={false} dataSource="mock" />
        </div>

        {isConfigured && currentFile ? (
          <div className={`border rounded-lg px-3 py-2 ${
            isUsingDefault
              ? 'bg-blue-50 border-blue-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className={`text-lg flex-shrink-0 ${
                  isUsingDefault ? 'text-blue-600' : 'text-green-600'
                }`}>
                  {isUsingDefault ? '📊' : '✓'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${
                    isUsingDefault ? 'text-blue-800' : 'text-green-800'
                  }`}>
                    {isUsingDefault ? 'Default Zillow ZHVI data' : currentFile}
                  </p>
                  <p className={`text-xs ${
                    isUsingDefault ? 'text-blue-700' : 'text-green-700'
                  }`}>
                    {totalMarkets.toLocaleString()} markets loaded
                  </p>
                  <p className={`text-xs ${
                    isUsingDefault ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    Source: {dataSource === 'default' ? 'Default dataset' : 'Custom upload'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
            <p className="text-sm text-gray-600">No data loaded</p>
          </div>
        )}
      </div>

      {/* Debug Information */}
      {showDebug && (
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">Debug Info</h4>
          <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Provider:</span>
              <span className="font-mono text-gray-900">CSV</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Markets loaded:</span>
              <span className="font-mono text-gray-900">{totalMarkets.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Data source:</span>
              <span className="font-mono text-gray-900">{dataSource}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Filename:</span>
              <span className="font-mono text-gray-900 truncate ml-2" title={currentFile || 'None'}>
                {currentFile || 'None'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Using default:</span>
              <span className="font-mono text-gray-900">{isUsingDefault ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Configured:</span>
              <span className="font-mono text-gray-900">{isConfigured ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-3 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">Actions</h4>

        <div className="space-y-2">
          {!isUsingDefault && (
            <button
              onClick={handleResetToDefault}
              disabled={resetting || clearing}
              className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? 'Resetting...' : '↺ Reset to Default Data'}
            </button>
          )}

          <button
            onClick={handleClearCache}
            disabled={clearing || resetting}
            className="w-full px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing...' : '🗑️ Clear All Cache'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          💡 <strong>Tip:</strong> Clear cache if you see old data or want to reload the default dataset.
        </p>
      </div>
    </div>
  );
};
