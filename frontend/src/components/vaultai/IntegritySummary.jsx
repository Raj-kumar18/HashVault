import React, { useState } from 'react';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function IntegritySummary({ report }) {
  if (!report) return null;

  const [showDetails, setShowDetails] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  const integrity = report.integritySummary || {};
  const blockchain = report.blockchainSummary || {};
  const continuity = report.ingestionContinuity || {};
  const metadata = report.evidenceMetadata || {};

  const isHashChainValid = integrity.status === 'VERIFIED';
  const isHashChainTampered = integrity.status === 'TAMPERED';
  const isChainContinuous = continuity.isContinuous && !continuity.gapDetected;
  const isBlockchainAnchored = blockchain.status === 'VERIFIED' || (blockchain.checkpointCount > 0);

  return (
    <Card className="border border-zinc-800 bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
      <CardHeader className="p-5 pb-4 border-b border-zinc-800 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-300" />
            Evidence &amp; Cryptographic Integrity
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-0.5">
            Deterministic mathematical verification performed on active telemetry.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* 3 Quiet Verification Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pillar 1: SHA-256 Hash Chain */}
          <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-zinc-400">
                SHA-256 Hash Chain
              </span>
              {isHashChainValid ? (
                <span className="font-mono text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                  VERIFIED
                </span>
              ) : isHashChainTampered ? (
                <span className="font-mono text-[10px] font-semibold text-red-400 bg-red-950/30 border border-red-800/60 px-1.5 py-0.2 rounded">
                  FAILED
                </span>
              ) : (
                <span className="font-mono text-[10px] font-semibold text-amber-400 bg-amber-950/30 border border-amber-800/60 px-1.5 py-0.2 rounded">
                  INCONCLUSIVE
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-white">
              {integrity.recordsChecked || 0} Records Verified
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-normal">
              {isHashChainValid
                ? 'Canonical payloads cryptographically linked with zero hash gaps.'
                : isHashChainTampered
                ? 'Discontinuity detected: record modified retroactively.'
                : 'Limited record depth or empty chain in scope.'}
            </p>
          </div>

          {/* Pillar 2: Ingestion Continuity */}
          <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-zinc-400">
                Sequence Continuity
              </span>
              {isChainContinuous ? (
                <span className="font-mono text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                  VERIFIED
                </span>
              ) : (
                <span className="font-mono text-[10px] font-semibold text-red-400 bg-red-950/30 border border-red-800/60 px-1.5 py-0.2 rounded">
                  GAP DETECTED
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-white">
              {isChainContinuous ? 'Zero Log Dropped' : 'Sequence Gap Detected'}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-normal">
              {continuity.message || 'Continuous event sequence verified across ingested telemetry.'}
            </p>
          </div>

          {/* Pillar 3: Ethereum Sepolia Consensus */}
          <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-zinc-400">
                Ethereum Consensus
              </span>
              {isBlockchainAnchored ? (
                <span className="font-mono text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                  ON-CHAIN
                </span>
              ) : (
                <span className="font-mono text-[10px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 rounded">
                  PENDING
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-white">
              {blockchain.checkpointCount || 0} Sepolia Checkpoint(s)
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-normal">
              {isBlockchainAnchored
                ? 'Merkle commitments notarized into smart contract ledger.'
                : 'Batches queued for next scheduled blockchain rollup cycle.'}
            </p>
          </div>
        </div>

        {/* Coverage Strip */}
        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 uppercase">Coverage:</span>
            <span className="text-white font-medium">{metadata.logEventsCount || 0} Logs</span>
            <span>•</span>
            <span className="text-white font-medium">{metadata.alertsCount || 0} Alerts</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 uppercase">Sanitizer:</span>
            <span className="text-zinc-300">{metadata.redactedItemsCount || 0} secrets redacted in transit</span>
          </div>
        </div>

        {/* Expandable Technical Controls */}
        <div className="flex items-center gap-2 pt-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs h-7 text-zinc-400 hover:text-white"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
            {showDetails ? 'Hide Verification Details' : 'View Verification Details'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-xs h-7 text-zinc-400 hover:text-white"
          >
            {showEvidence ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
            {showEvidence ? 'Hide Evidence Refs' : 'View Evidence Refs'}
          </Button>
        </div>

        {/* Expanded Verification Details */}
        {showDetails && (
          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-2">
            <span className="text-zinc-400 font-semibold uppercase text-[10px] block">
              Deterministic Verification Trace
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300">
              <div>Verification Engine: <span className="text-white">RFC 8785 Canonical JSON + SHA-256</span></div>
              <div>Records Checked: <span className="text-white font-semibold">{integrity.recordsChecked || 0}</span></div>
              <div>Chain Head Hash: <span className="text-zinc-400 truncate block">{integrity.chainHeadHash || 'Nominal Commit'}</span></div>
              <div>Smart Contract State: <span className="text-white">{blockchain.message || 'Sepolia Connected'}</span></div>
            </div>
          </div>
        )}

        {/* Expanded Evidence Refs */}
        {showEvidence && (
          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-2">
            <span className="text-zinc-400 font-semibold uppercase text-[10px] block">
              Forensic Evidence Identifiers ({metadata.evidenceIds?.length || 0})
            </span>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {(metadata.evidenceIds || []).map((id, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
