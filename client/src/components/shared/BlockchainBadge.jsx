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
        "group inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap",
        className
      )}
      title={`Transaction: ${txHash}`}
    >
      <Link2 size={12} className="animate-pulse group-hover:rotate-45 transition-transform duration-300" />
      <span className="whitespace-nowrap md:hidden">Polygon</span>
      <span className="hidden whitespace-nowrap md:inline">On Polygon</span>
      <span className="hidden lg:inline font-mono text-[10px] ml-0.5 opacity-80 group-hover:opacity-95">
        ({truncatedHash})
      </span>
      <ExternalLink size={10} className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-255" />
    </a>
  );
}
