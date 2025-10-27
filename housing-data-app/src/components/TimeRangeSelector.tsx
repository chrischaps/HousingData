import type { TimeRangeSelectorProps } from '../types';
import { TIME_RANGES } from '../utils/constants';

export const TimeRangeSelector = ({ selected, onChange }: TimeRangeSelectorProps) => {
  console.log('[TimeRangeSelector] Selected range:', selected);

  return (
    <div className="flex gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
      {TIME_RANGES.map((range) => {
        const isSelected = selected === range;
        console.log(`[TimeRangeSelector] Range ${range}:`, { isSelected });

        return (
          <button
            key={range}
            onClick={() => onChange(range)}
            className={
              isSelected
                ? 'px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors bg-blue-600 text-white'
                : 'px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
            }
          >
            {range}
          </button>
        );
      })}
    </div>
  );
};
