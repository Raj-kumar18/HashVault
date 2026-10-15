import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SEVERITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

export default function FindingList({ findings = [], serverName = 'Fleet' }) {
  const [expandedId, setExpandedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Sort by priority descending
  const sortedFindings = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)
  );

  const displayedFindings = showAll ? sortedFindings : sortedFindings.slice(0, 4);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="font-mono text-[10px] font-semibold py-0.5 px-2 rounded bg-red-950/40 text-red-400 border border-red-800/60">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="font-mono text-[10px] font-semibold py-0.5 px-2 rounded bg-orange-950/40 text-orange-400 border border-orange-800/60">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="font-mono text-[10px] font-semibold py-0.5 px-2 rounded bg-amber-950/40 text-amber-400 border border-amber-800/60">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="font-mono text-[10px] font-semibold py-0.5 px-2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
            LOW
          </span>
        );
      default:
        return (
          <span className="font-mono text-[10px] font-semibold py-0.5 px-2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            INFO
          </span>
        );
    }
  };

  return (
    <Card className="border border-zinc-800 bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
      <CardHeader className="p-5 pb-4 border-b border-zinc-800 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-zinc-300" />
            What Needs Attention
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-0.5">
            Prioritized findings with verifiable evidence references.
          </CardDescription>
        </div>
        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
          {findings.length} {findings.length === 1 ? 'Finding' : 'Findings'}
        </span>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {findings.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-white text-sm block">No Actionable Threats Detected</span>
              <span className="text-zinc-400 text-xs">All analyzed events and cryptographic hashes are in nominal state.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedFindings.map((finding, idx) => {
              const isExpanded = expandedId === (finding.id || idx);
              const oneSentenceExplanation =
                finding.interpretation ||
                (finding.observedFacts && finding.observedFacts[0]) ||
                finding.recommendedNextStep ||
                'Suspicious sequence requiring investigation.';

              return (
                <div
                  key={finding.id || idx}
                  className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-colors overflow-hidden"
                >
                  <div
                    onClick={() => toggleExpand(finding.id || idx)}
                    className="p-3.5 sm:p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">{getSeverityBadge(finding.severity)}</div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-sm text-white tracking-tight">
                            {finding.title}
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded">
                            {serverName}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                          {oneSentenceExplanation}
                        </p>

                        {finding.supportingEvidenceRefs?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-mono text-zinc-500">Evidence:</span>
                            {finding.supportingEvidenceRefs.map((ref, rIdx) => (
                              <span
                                key={rIdx}
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-300 border border-zinc-800"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-7 w-7 text-zinc-400 hover:text-white shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  </div>

                  {/* Expandable Technical Details Drawer */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-zinc-800/70 bg-zinc-900/40 text-xs space-y-3">
                      {finding.observedFacts?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                            Observed Facts:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-zinc-300 font-mono text-xs">
                            {finding.observedFacts.map((fact, fIdx) => (
                              <li key={fIdx}>{fact}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {finding.alternativeExplanations && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                            Alternative Explanations:
                          </span>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {finding.alternativeExplanations}
                          </p>
                        </div>
                      )}

                      {finding.recommendedNextStep && (
                        <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold block mb-0.5">
                            Recommended Next Step:
                          </span>
                          <p className="text-xs text-zinc-200">
                            {finding.recommendedNextStep}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {sortedFindings.length > 4 && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  {showAll ? 'Show Fewer Findings' : `Show All ${sortedFindings.length} Findings`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
