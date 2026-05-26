import React from 'react';

const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

export const CardSkeleton = ({ lines = 3 }) => (
  <div className="premium-card p-5 space-y-3">
    <div className="flex items-center gap-3">
      <SkeletonBlock className="w-10 h-10 rounded-xl" />
      <SkeletonBlock className="flex-1 h-4" />
    </div>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBlock key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);

export const TableRowSkeleton = ({ cols = 4 }) => (
  <tr className="border-b border-slate-100">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <SkeletonBlock className="h-3 w-full animate-pulse" />
      </td>
    ))}
  </tr>
);

export const StatCardSkeleton = () => (
  <div className="premium-card p-5 animate-pulse">
    <div className="flex items-center justify-between mb-3">
      <SkeletonBlock className="w-10 h-10 rounded-xl" />
      <SkeletonBlock className="w-12 h-4" />
    </div>
    <SkeletonBlock className="w-24 h-7 mb-1.5" />
    <SkeletonBlock className="w-16 h-3" />
  </div>
);

export const PageSkeleton = () => (
  <div className="space-y-6">
    <div className="flex gap-3 mb-6">
      {[1, 2, 3].map(i => <StatCardSkeleton key={i} />)}
    </div>
    <CardSkeleton lines={4} />
    <CardSkeleton lines={2} />
  </div>
);

const LoadingSkeleton = ({ type = 'card', count = 1, cols }) => {
  const components = { card: CardSkeleton, stat: StatCardSkeleton, page: PageSkeleton };
  const Comp = components[type] || CardSkeleton;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Comp key={i} cols={cols} />
      ))}
    </>
  );
};

export default LoadingSkeleton;
