import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguageStore } from '../../lib/languageStore';
import { cn } from '../../lib/utils';

export default function LanguageToggle({ className = '' }) {
  const { lang, toggle } = useLanguageStore();

  return (
    <button
      onClick={toggle}
      type="button"
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-brand-primary dark:hover:border-brand-primary hover:text-brand-primary dark:hover:text-brand-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm active:scale-95 transition-all duration-200",
        className
      )}
      title="Switch Language / भाषा बदलें"
    >
      <Globe size={15} className="text-brand-primary animate-spin-slow" />
      <div className="flex items-center gap-1">
        <span className={cn(lang === 'hi' ? "text-brand-primary font-bold" : "text-gray-400")}>हिं</span>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className={cn(lang === 'en' ? "text-brand-primary font-bold" : "text-gray-400")}>EN</span>
      </div>
    </button>
  );
}
