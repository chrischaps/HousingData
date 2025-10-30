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
                ? 'px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors bg-blue-600 dark:bg-blue-500 text-white'
                : 'px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 active:bg-gray-400 dark:active:bg-slate-500'
            }
          >
            {range}
          </button>
        );
      })}
    </div>
  );
};
