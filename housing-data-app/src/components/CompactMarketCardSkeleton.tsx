/**
 * Loading skeleton for CompactMarketCard
 */
export const CompactMarketCardSkeleton = () => {
  return (
    <div className="flex-shrink-0 w-36 h-28 rounded-lg p-3 bg-white border border-gray-200 animate-pulse">
      <div className="flex flex-col h-full">
        {/* Market name skeleton */}
        <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>

        {/* Price skeleton */}
        <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>

        {/* Change skeleton */}
        <div className="h-3 w-12 bg-gray-200 rounded mb-2"></div>

        {/* Chart skeleton */}
        <div className="flex-1 flex items-end gap-0.5">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-200 rounded-t"
              style={{ height: `${Math.random() * 60 + 40}%` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Multiple skeleton cards for carousel
 */
export const CompactMarketCardSkeletonRow = ({ count = 5 }: { count?: number }) => {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <CompactMarketCardSkeleton key={i} />
      ))}
    </>
  );
};
