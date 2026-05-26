import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, sub, trend, trendValue, colorClass = 'text-brand-primary', bgClass = 'bg-brand-primary/10', loading }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-brand-success' : trend === 'down' ? 'text-brand-error' : 'text-brand-textMuted';

  if (loading) {
    return (
      <div className="premium-card p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100" />
          <div className="w-12 h-4 rounded bg-slate-100" />
        </div>
        <div className="w-24 h-7 rounded bg-slate-100 mb-1.5" />
        <div className="w-16 h-3 rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="premium-card p-5 group cursor-default">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
          {Icon && <Icon className={`w-5 h-5 ${colorClass}`} />}
        </div>
        {trendValue !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {trendValue}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-brand-textPrimary tracking-tight">{value ?? '—'}</p>
      <p className="text-xs font-medium text-brand-textMuted mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-brand-textMuted mt-1 opacity-75">{sub}</p>}
    </div>
  );
};

export default StatCard;
