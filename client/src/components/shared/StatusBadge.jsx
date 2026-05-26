import React from 'react';
import { cn } from '../../lib/utils';
import { useLanguageStore } from '../../lib/languageStore';

export default function StatusBadge({ status, className = '' }) {
  const { t } = useLanguageStore();

  const getStatusConfig = (statusStr) => {
    const s = String(statusStr).toLowerCase();
    switch (s) {
      case 'forming':
        return {
          label: t.common?.status?.forming || 'Forming',
          classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700',
        };
      case 'active':
      case 'approved':
        return {
          label: t.common?.status?.active || t.common?.status?.approved || (s === 'active' ? 'Active' : 'Approved'),
          classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-150 dark:border-emerald-900/40',
        };
      case 'completed':
      case 'paid':
      case 'settled':
        return {
          label: t.common?.status?.completed || t.common?.status?.paid || t.common?.status?.settled || (s === 'completed' ? 'Completed' : s === 'paid' ? 'Paid' : 'Settled'),
          classes: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-150 dark:border-sky-900/40',
        };
      case 'auction':
      case 'bidding':
      case 'pending':
        return {
          label: t.common?.status?.auction || t.common?.status?.bidding || t.common?.status?.pending || (s === 'auction' ? 'Auction Live' : s === 'bidding' ? 'Bidding' : 'Pending'),
          classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-150 dark:border-amber-900/40 animate-pulse',
        };
      case 'cancelled':
      case 'rejected':
      case 'failed':
        return {
          label: t.common?.status?.cancelled || t.common?.status?.rejected || t.common?.status?.failed || (s === 'cancelled' ? 'Cancelled' : s === 'rejected' ? 'Rejected' : 'Failed'),
          classes: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-150 dark:border-rose-900/40',
        };
      default:
        return {
          label: statusStr,
          classes: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all duration-200 shadow-sm",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
