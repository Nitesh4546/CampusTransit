import React from 'react';
import { Bus } from 'lucide-react';

export default function LoadingSpinner({ fullscreen = false, size = 'md' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className={`${sizes[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-surface-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-600 animate-spin" />
      </div>
      {fullscreen && (
        <div className="flex items-center gap-2 text-surface-600 text-sm font-medium">
          <Bus className="w-4 h-4 text-primary-600" />
          <span>Loading campus transit...</span>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-surface-50/90 backdrop-blur-xs flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}
