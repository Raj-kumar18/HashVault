import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Server,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function InvestigationStart({
  servers = [],
  selectedServerId = null,
  onSelectServer,
  loadingServers = false,
  onStartInvestigation,
  isInvestigating = false,
}) {
  const navigate = useNavigate();
  const hasServers = servers.length > 0;
  const currentServer = servers.find((s) => s.serverId === selectedServerId) || servers[0];

  return (
    <div className="py-10 sm:py-16 px-4 flex flex-col items-center text-center">
      <div className="max-w-2xl mx-auto space-y-7 w-full">
        {/* Fleet Context Pill */}
        <div className="flex justify-center">
          {hasServers ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{servers.length} Workstation{servers.length > 1 ? 's' : ''} in Fleet</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-amber-400 font-mono">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>No Servers Enrolled</span>
            </div>
          )}
        </div>

        {/* Headline & Description */}
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Your security, investigated.
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-lg mx-auto">
            VaultAI analyzes your available security telemetry, verifies cryptographic integrity, and identifies risks across your authorized fleet.
          </p>
        </div>

        {/* Target Server Selection Cards (Clean, Quiet, Minimal) */}
        {hasServers && (
          <div className="w-full text-left space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-mono text-zinc-400 uppercase tracking-wider text-[11px] font-medium">
                Target Workstation
              </span>
              <span className="text-zinc-500 font-mono text-[11px]">
                Click to switch target
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {servers.map((srv) => {
                const isSelected = srv.serverId === (currentServer?.serverId || selectedServerId);
                const isOnline = srv.connectionStatus === 'ONLINE';

                return (
                  <div
                    key={srv.serverId}
                    onClick={() => onSelectServer && onSelectServer(srv.serverId)}
                    className={`p-3.5 rounded-lg border transition-colors cursor-pointer text-left select-none ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-600 text-white'
                        : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-white truncate">
                            {srv.serverName}
                          </h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                            {srv.environment || 'Production'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-zinc-400 truncate">
                          {srv.hostname}
                        </p>
                      </div>

                      <div className="shrink-0 mt-0.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-white bg-white text-black'
                              : 'border-zinc-700 bg-transparent text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                          }`}
                        />
                        <span>{isOnline ? 'Online' : 'Offline / Registered'}</span>
                      </div>
                      <span>{srv.chainHeadSequence ? `Seq #${srv.chainHeadSequence}` : srv.os || 'Linux'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div className="pt-2 flex flex-col items-center space-y-3">
          {hasServers ? (
            <>
              <Button
                size="lg"
                disabled={isInvestigating || loadingServers}
                onClick={onStartInvestigation}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm h-11 px-7 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-2"
                id="btn-investigate-fleet"
              >
                <span>
                  {isInvestigating
                    ? 'Investigating...'
                    : `Investigate ${currentServer?.serverName || 'My Fleet'} →`}
                </span>
              </Button>

              <p className="text-xs text-zinc-400 font-mono">
                Automatic analysis · Evidence-backed findings · Downloadable report
              </p>
            </>
          ) : (
            <div className="p-5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2.5 max-w-md text-left">
              <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                <Server className="w-4 h-4" />
                <span>No Registered Workstations Found</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                VaultAI requires at least one registered server in your inventory to collect logs and verify cryptographic chain continuity.
              </p>
              <Button
                size="sm"
                onClick={() => navigate('/servers')}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs h-8 px-3 rounded cursor-pointer"
              >
                Enroll Server in Fleet Inventory <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
