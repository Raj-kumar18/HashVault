import React, { useState } from 'react';
import { Check, Copy, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RecommendedActions({ steps = [], findings = [] }) {
  const [copied, setCopied] = useState(false);

  const actionItems = steps.length > 0 ? steps : [
    'Continue continuous daemon log tailing and cryptographic verification on enrolled servers.',
    'Review any offline node heartbeats to ensure uninterrupted telemetry collection.',
    'Monitor next scheduled Ethereum Sepolia Merkle root commitment.',
  ];

  const handleCopy = () => {
    const text = `--- HashVault VaultAI Remediation Plan ---\n\n` +
      actionItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n') +
      `\n\nGenerated automatically from verified security evidence. Non-destructive; requires human authorization.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-zinc-800 bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
      <CardHeader className="p-5 pb-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-300" />
            Recommended Actions
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-0.5">
            Prioritized operational next steps derived from authoritative findings.
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="text-xs h-8 px-3 border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white cursor-pointer font-medium gap-1.5 self-start sm:self-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          <span>{copied ? 'Copied Plan' : 'Copy Remediation Plan'}</span>
        </Button>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-2.5">
        {actionItems.map((action, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex items-start gap-3"
          >
            <div className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
              {idx + 1}
            </div>

            <div className="space-y-0.5 flex-1">
              <p className="text-xs sm:text-sm font-medium text-white leading-relaxed">
                {action}
              </p>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Non-destructive recommendation. Requires analyst authorization before applying infrastructure modifications.
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
