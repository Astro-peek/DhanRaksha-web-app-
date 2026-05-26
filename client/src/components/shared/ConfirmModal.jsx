import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', loading }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const btnClass = variant === 'danger'
    ? 'bg-brand-error hover:bg-red-700 focus:ring-brand-error/30'
    : 'gradient-primary focus:ring-brand-primary/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-brand-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-brand-textMuted hover:text-brand-textPrimary" aria-label="Close">
          <X className="w-4 h-4" />
        </button>

        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-red-50' : 'bg-brand-primary/10'}`}>
          <AlertTriangle className={`w-6 h-6 ${variant === 'danger' ? 'text-brand-error' : 'text-brand-primary'}`} />
        </div>

        <h2 id="confirm-title" className="text-base font-bold text-brand-textPrimary mb-1">{title}</h2>
        {message && <p className="text-sm text-brand-textMuted mb-6 leading-relaxed">{message}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-brand-textMuted bg-slate-100 hover:bg-slate-200 rounded-input transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-input transition-all shadow-sm focus:outline-none focus:ring-4 ${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
