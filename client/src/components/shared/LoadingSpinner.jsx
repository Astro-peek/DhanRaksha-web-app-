import React from 'react';

const LoadingSpinner = ({ size = 'md', label = 'Loading SafeKosh...' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative flex items-center justify-center">
        {/* Outer Pulsing Glow */}
        <div className={`absolute rounded-full animate-ping bg-brand-secondary/20 ${
          size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-20 h-20'
        }`} />
        
        {/* Core Spinning Ring */}
        <div
          className={`rounded-full animate-spin border-brand-primary/10 border-t-brand-primary ${sizeClasses[size]}`}
          style={{ borderStyle: 'solid' }}
        />
      </div>
      
      {label && (
        <span className="text-sm font-semibold tracking-wider uppercase text-brand-dark/70 animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
