import React from 'react';
import { Button } from './ui/button';

export const FieldError: React.FC<{ message: string | null | undefined }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="text-xs text-danger font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in-50 slide-in-from-top-1 duration-150">
      <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0"></span>
      <span>{message}</span>
    </div>
  );
};

export const FullPageError: React.FC<{
  title?: string;
  description: string | null | undefined;
  onRetry?: () => void;
}> = ({ title = "Error Loading Data", description, onRetry }) => {
  if (!description) return null;
  return (
    <div className="p-8 text-center rounded-xl border border-danger/20 bg-danger/5 flex flex-col items-center justify-center gap-4 max-w-xl mx-auto my-6 animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h3 className="text-base font-bold text-text-primary tracking-tight">{title}</h3>
        <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
      </div>
      {onRetry && (
        <Button 
          variant="outline" 
          onClick={onRetry} 
          className="h-9 px-4 text-xs font-semibold border-danger/30 text-danger hover:bg-danger/10"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
