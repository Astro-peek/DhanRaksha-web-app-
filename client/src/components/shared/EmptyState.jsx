import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({ icon: Icon = Inbox, title = 'Nothing here yet', subtitle, action, actionLabel = 'Get Started' }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-brand-textMuted" />
    </div>
    <h3 className="text-base font-bold text-brand-textPrimary mb-1">{title}</h3>
    {subtitle && <p className="text-sm text-brand-textMuted max-w-xs mb-4">{subtitle}</p>}
    {action && (
      <button
        onClick={action}
        className="px-5 py-2.5 gradient-primary text-white text-sm font-semibold rounded-input shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
