import React from 'react';
import { formatINR, cn } from '../../lib/utils';

export default function RupeeProgressBar({ current = 0, goal = 0, className = '', showLabels = true }) {
  const percentage = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;

  return (
    <div className={cn("w-full flex flex-col gap-1.5", className)}>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-brand-primary h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin="0"
          aria-valuemax={goal}
        />
      </div>
      
      {showLabels && (
        <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span>{formatINR(current)}</span>
          <span className="bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 px-1.5 py-0.5 rounded-md text-[10px]">
            {percentage}%
          </span>
          <span>{formatINR(goal)}</span>
        </div>
      )}
    </div>
  );
}
