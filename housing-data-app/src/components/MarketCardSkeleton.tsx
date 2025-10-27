/**
 * Skeleton loading component for MarketCard
 * Displays animated placeholder while market data is loading
 */

export const MarketCardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow p-4 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          {/* Market name skeleton */}
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
          {/* Property type skeleton */}
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        {/* Add button skeleton */}
        <div className="h-6 w-12 bg-gray-200 rounded"></div>
      </div>

      <div>
        {/* Price skeleton */}
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
        {/* Percentage change skeleton */}
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  );
};

/**
 * Grid of skeleton cards for loading state
 */
interface MarketCardSkeletonGridProps {
  count?: number;
}

export const MarketCardSkeletonGrid = ({ count = 5 }: MarketCardSkeletonGridProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <MarketCardSkeleton key={index} />
      ))}
    </>
  );
};
