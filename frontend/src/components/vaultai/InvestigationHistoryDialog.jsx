import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight } from 'lucide-react';

export default function InvestigationHistoryDialog({
  open,
  onOpenChange,
  history = [],
  loading = false,
  onSelectReport,
}) {
  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'CRITICAL':
        return <span className="font-mono text-[10px] font-semibold px-2 py-0.2 rounded bg-red-950/40 text-red-400 border border-red-800/60">CRITICAL</span>;
      case 'HIGH':
        return <span className="font-mono text-[10px] font-semibold px-2 py-0.2 rounded bg-orange-950/40 text-orange-400 border border-orange-800/60">HIGH</span>;
      case 'MEDIUM':
        return <span className="font-mono text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-950/40 text-amber-400 border border-amber-800/60">MEDIUM</span>;
      case 'LOW':
        return <span className="font-mono text-[10px] font-semibold px-2 py-0.2 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/60">LOW</span>;
      default:
        return <span className="font-mono text-[10px] font-semibold px-2 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">INFO</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col p-5 rounded-xl">
        <DialogHeader className="pb-3 border-b border-zinc-800">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            Previous Investigations
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Historical investigation dossiers recorded in audit ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
          {loading ? (
            <div className="py-10 text-center text-xs text-zinc-500 font-mono">
              Loading historical investigation dossiers...
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-xs">
              No historical investigations found. Run your first fleet investigation to generate a dossier.
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.analysisId}
                onClick={() => {
                  onSelectReport(item.analysisId);
                  onOpenChange(false);
                }}
                className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">
                      {item.serverName || item.serverId || 'Fleet Wide'}
                    </span>
                    {getRiskBadge(item.overallRiskLevel)}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                    <span>ID: {item.analysisId}</span>
                    <span>•</span>
                    <span>{new Date(item.createdAt || item.completedAt).toLocaleString()}</span>
                  </div>
                  {item.findings?.length > 0 && (
                    <div className="text-xs text-zinc-300">
                      {item.findings.length} actionable {item.findings.length === 1 ? 'finding' : 'findings'}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-zinc-400 hover:text-white shrink-0 gap-1 font-medium"
                >
                  View <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
