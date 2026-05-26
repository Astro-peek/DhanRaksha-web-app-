import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function CopyButton({ text, className = '', iconSize = 16 }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={cn(
        "relative flex items-center justify-center p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all duration-200 active:scale-95",
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={iconSize} className="text-emerald-500 stroke-[2.5]" />
          <span className="absolute bottom-full mb-2 px-2 py-1 text-xs font-semibold text-white bg-slate-900 rounded shadow-md animate-fade-in z-50 whitespace-nowrap">
            Copied!
          </span>
        </>
      ) : (
        <Copy size={iconSize} />
      )}
    </button>
  );
}
