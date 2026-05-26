import React from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BlockchainBadge({ txHash, className = '' }) {
  if (!txHash) return null;

  const truncatedHash = `${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)}`;
  const explorerUrl = `https://mumbai.polygonscan.com/tx/${txHash}`;

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-all duration-200 shadow-sm hover:shadow-md",
        className
      )}
      title={`Transaction: ${txHash}`}
    >
      <Link2 size={12} className="text-indigo-500 animate-pulse group-hover:rotate-45 transition-transform duration-300" />
      <span>On Polygon</span>
      <span className="hidden sm:inline text-indigo-400 group-hover:text-indigo-600 font-mono text-[10px] ml-0.5">
        ({truncatedHash})
      </span>
      <ExternalLink size={10} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-255" />
    </a>
  );
}
