import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map, CheckCircle2, Clock } from 'lucide-react';

export default function PhaseRoadmap() {
  const phases = [
    {
      phase: 'Phase 0',
      title: 'Project Foundation',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Monorepo skeleton, React + Vite shell, Express backend, Mongoose lifecycle, health endpoints, centralized errors.',
      items: [
        'GET /api/health and /api/health/db endpoints',
        'Frontend connection state polling',
        'Directory structure and environments',
      ],
    },
    {
      phase: 'Phase 1',
      title: 'Auth & RBAC',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Secure authentication, Bcrypt password hashing, MongoDB session management, CSRF tokens, RBAC middleware.',
      items: [
        'POST /api/auth/signup & login & logout',
        'Role tiers: Admin & Security Analyst',
        'Protected dashboard & route guards',
      ],
    },
    {
      phase: 'Phase 2',
      title: 'Server Fleet & Enrollment',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Server management, cryptographic single-use enrollment tokens, atomic token exchange, credential rotation.',
      items: [
        'CRUD /api/servers with role restrictions',
        'Single-use 15-min enrollment tokens',
        'Atomic exchange for collector credentials',
      ],
    },
    {
      phase: 'Phase 3',
      title: 'Linux Collector Agent',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Background daemon agent in Node.js, tail tracking, bounded queue, retry backoff, systemd service, batch ingestion & heartbeats.',
      items: [
        'POST /api/collector/logs & /heartbeat',
        'Persistent offset & FIFO queue recovery',
        'tamper-agent.service unit & installer',
      ],
    },
    {
      phase: 'Phase 4',
      title: 'Tamper-Evident Engine',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Deterministic RFC 8785 canonical serialization, SHA-256 sequential hash chains, mutex queue, verification engine & explorer.',
      items: [
        'RFC 8785 deterministic sorting & SHA-256 chaining',
        'Append-only sequence & tamper detection engine',
        'Interactive Integrity Explorer UI & verification',
      ],
    },
    {
      phase: 'Phase 5',
      title: 'Blockchain Anchoring',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Smart contract checkpoint registry anchoring cryptographic commitments of hash chains with independent on-chain verification.',
      items: [
        'Hardhat + Solidity checkpoint registry contract',
        'Privacy-safe bytes32 commitments & idempotency',
        'Independent on-chain verification & tamper audit',
      ],
    },
    {
      phase: 'Phase 6',
      title: 'Monitoring, Alerts & Attack Simulator',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Continuous collector telemetry, ingestion gap detection, deduplicated security alerts, scheduler worker, and controlled attack simulator.',
      items: [
        'Real heartbeat state evaluation (Online, Stale, Offline, Disabled)',
        'Deduplicated alerts with open/acknowledged/resolved lifecycle',
        'Controlled red team simulator for integrity & checkpoint verification',
      ],
    },
    {
      phase: 'Phase 7',
      title: 'Premium SOC Dashboard & Visibility',
      status: 'Active (Current)',
      badgeVariant: 'default',
      description:
        'Unified security operations center, cross-server logs explorer, tabbed server inspection, and real-time persisted telemetry feeds.',
      items: [
        'Real-time SOC overview with 7 independent dimensions and activity timeline',
        'Universal Logs Explorer with full-text search and cryptographic proof preview',
        'Tabbed server inspection across Overview, Logs, Integrity, Blockchain, and Alerts',
      ],
    },
    {
      phase: 'Phase 8',
      title: 'VaultAI Security Intelligence Copilot',
      status: 'Implemented',
      badgeVariant: 'success',
      description:
        'Controlled LangGraph investigation workflow, evidence-linked findings, privacy redaction, and deterministic cryptographic anchoring.',
      items: [
        'LangGraph 9-node state graph workflow',
        'Zod structured output validation',
        'Cryptographic authority separation',
        'Timeline reconstruction & feedback',
      ],
    },
  ];

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
      <CardHeader className="p-6 pb-4 border-b border-zinc-800 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-white" />
            <CardTitle className="text-base font-bold text-white">
              HashVault Platform Architecture Roadmap
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400 mt-1">
            Engine status boundaries and verified production milestones
          </CardDescription>
        </div>

        <Badge variant="default" className="text-xs font-mono bg-white text-zinc-950 font-bold">
          Phase 8 Active
        </Badge>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {phases.map((p) => (
            <div
              key={p.phase}
              className={`rounded-xl p-4 border flex flex-col justify-between transition-all ${
                p.status.includes('Active')
                  ? 'bg-zinc-950 border-white/60 shadow-lg ring-1 ring-white/20'
                  : p.status === 'Implemented'
                  ? 'bg-zinc-950/90 border-zinc-800'
                  : 'bg-zinc-950/40 border-zinc-800/60 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-white">
                    {p.phase}
                  </span>
                  <Badge variant={p.badgeVariant} className="text-[10px] font-mono py-0 font-semibold">
                    {p.status}
                  </Badge>
                </div>
                <h3 className="text-xs font-bold text-zinc-100 mb-1">
                  {p.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                  {p.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-xs space-y-1.5 text-zinc-300 font-mono">
                {p.items.map((it, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-zinc-400 font-bold">•</span>
                    <span className="font-sans text-xs text-zinc-300">{it}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
