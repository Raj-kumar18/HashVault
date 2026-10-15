import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Clock, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ExecutiveConclusion({ report }) {
  if (!report) return null;

  const riskLevel = report.overallRiskLevel || 'LOW';
  const findingsCount = report.findings?.length || 0;
  const serverName = report.serverName || report.serverId || 'Fleet Wide';
  const completedAt = report.completedAt
    ? new Date(report.completedAt).toLocaleTimeString()
    : 'Just now';

  // Determine Title and Subtle Status Styling (strictly minimalist, no LED glow)
  let headline = 'No actionable threats detected in the analyzed evidence.';
  let badgeStyle = 'text-emerald-400 border-emerald-800/80 bg-emerald-950/30';
  let Icon = ShieldCheck;
  let iconColor = 'text-emerald-400';

  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    headline = 'High-risk activity detected across your fleet.';
    badgeStyle = 'text-red-400 border-red-800/80 bg-red-950/30';
    Icon = ShieldAlert;
    iconColor = 'text-red-400';
  } else if (riskLevel === 'MEDIUM') {
    headline = 'Elevated security anomalies requiring operational attention.';
    badgeStyle = 'text-amber-400 border-amber-800/80 bg-amber-950/30';
    Icon = AlertTriangle;
    iconColor = 'text-amber-400';
  }

  const executiveText =
    report.executiveSummary ||
    (riskLevel === 'LOW'
      ? 'All analyzed server logs verify continuous cryptographic SHA-256 hash chains with zero detected record modifications.'
      : 'Authoritative telemetry reveals potential integrity discontinuities or suspicious sequence anomalies.');

  return (
    <Card className="border border-zinc-800 bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
      <CardContent className="p-6 sm:p-7 space-y-5">
        {/* Header Row: Label & Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center shrink-0">
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-zinc-400 block">
                Executive Security Assessment
              </span>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono font-semibold self-start sm:self-auto uppercase ${badgeStyle}`}
          >
            <span>{riskLevel} RISK VERIFIED</span>
          </div>
        </div>

        {/* Primary Headline */}
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
          {headline}
        </h2>

        {/* Executive Summary Narrative */}
        <p className="text-sm text-zinc-300 leading-relaxed font-normal pt-1">
          {executiveText}
        </p>

        {/* 4 Clean Metric Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-800/80 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Workstation
            </span>
            <div className="font-semibold text-white truncate flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{serverName}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Highest Severity
            </span>
            <span className={`font-mono font-semibold block ${iconColor}`}>
              {riskLevel}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Actionable Findings
            </span>
            <span className="font-semibold text-white block">
              {findingsCount} {findingsCount === 1 ? 'Finding' : 'Findings'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              Investigation Time
            </span>
            <div className="font-mono text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{completedAt}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
