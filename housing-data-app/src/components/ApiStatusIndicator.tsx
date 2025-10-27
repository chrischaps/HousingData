import { createProvider, getProviderType } from '../services/providers';

interface ApiStatusIndicatorProps {
  hasError: boolean;
  dataSource: 'api' | 'mock' | 'partial';
}

export const ApiStatusIndicator = ({ hasError, dataSource }: ApiStatusIndicatorProps) => {
  const provider = createProvider();
  const providerType = getProviderType();
  const isConfigured = provider.isConfigured();

  // Determine status based on configuration and data source
  let status: 'live' | 'mock' | 'error' | 'partial';
  let icon: string;
  let label: string;
  let colorClasses: string;

  if (hasError) {
    status = 'error';
    icon = '🔴';
    label = 'API Error';
    colorClasses = 'bg-red-100 text-red-800 border-red-300';
  } else if (providerType === 'mock') {
    status = 'mock';
    icon = provider.info.icon;
    label = provider.info.name;
    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else if (!isConfigured) {
    status = 'mock';
    icon = '🟡';
    label = 'Not Configured';
    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else if (dataSource === 'partial') {
    status = 'partial';
    icon = '🟠';
    label = `Partial ${provider.info.name}`;
    colorClasses = 'bg-orange-100 text-orange-800 border-orange-300';
  } else if (dataSource === 'api') {
    status = 'live';
    icon = provider.info.icon;
    label = provider.info.name;
    colorClasses = 'bg-green-100 text-green-800 border-green-300';
  } else {
    status = 'mock';
    icon = provider.info.icon;
    label = provider.info.name;
    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${colorClasses}`}
      title={getTooltipText(status, provider.info, isConfigured)}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
};

function getTooltipText(
  status: 'live' | 'mock' | 'error' | 'partial',
  providerInfo: { name: string; description: string },
  isConfigured: boolean
): string {
  switch (status) {
    case 'live':
      return `Connected to ${providerInfo.name} - ${providerInfo.description}`;
    case 'mock':
      return isConfigured
        ? `${providerInfo.name} configured but using mock data as fallback`
        : `${providerInfo.name} not configured - Check .env file`;
    case 'error':
      return 'API request failed - Showing cached/mock data';
    case 'partial':
      return `Some ${providerInfo.name} calls succeeded - Using mix of real and mock data`;
    default:
      return 'Data source unknown';
  }
}
