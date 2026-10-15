import React from 'react';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvestigationProgress({
  currentMessage,
  stepIndex = 0,
  error = null,
  onRetry = null,
}) {
  const steps = [
    'Collecting available security evidence...',
    'Verifying cryptographic integrity...',
    'Analyzing suspicious activity...',
    'Correlating related events...',
    'Preparing your security report...',
  ];

  if (error) {
    return (
      <div className="py-16 sm:py-24 px-4 text-center max-w-md mx-auto space-y-4">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-400 mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white tracking-tight">
            Investigation Interrupted
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {error}
          </p>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            className="bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs h-9 px-4 rounded-md cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Investigation
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="py-20 sm:py-28 px-4 text-center max-w-sm mx-auto space-y-6">
      {/* Restrained Minimalist Spinner */}
      <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-white animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-zinc-400" />
        </div>
      </div>

      {/* Dynamic Status Text */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-white tracking-tight">
          Investigating Fleet Telemetry
        </h3>
        <p className="text-xs text-zinc-300 font-mono min-h-[20px]">
          {currentMessage || steps[stepIndex % steps.length]}
        </p>
        <p className="text-[11px] text-zinc-500">
          Correlating telemetry and mathematical proofs.
        </p>
      </div>
    </div>
  );
}
