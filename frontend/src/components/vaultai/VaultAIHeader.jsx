import React from 'react';
import { Sparkles, Clock, Server, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function VaultAIHeader({
  aiStatus,
  onOpenHistory,
  historyCount = 0,
  servers = [],
  selectedServerId = null,
  onSelectServer = null,
}) {
  const isReady = aiStatus?.ready ?? true;
  const currentServer = servers.find((s) => s.serverId === selectedServerId) || servers[0];

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 shrink-0">
          <Sparkles className="w-4 h-4 text-zinc-300" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white">
              VaultAI
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
              <span>{isReady ? 'Active' : 'Standby'}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-400 mt-0.5">
            Your autonomous security analyst.
          </p>
        </div>
      </div>

      {/* Right Controls: Server Switcher Dropdown & Recent Reports */}
      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        {/* Quick Server Switcher Dropdown (If multiple servers exist) */}
        {servers.length > 0 && onSelectServer && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2.5 border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white cursor-pointer font-medium gap-1.5"
                id="btn-vaultai-server-selector"
              >
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                <span className="max-w-[140px] truncate">
                  {currentServer?.serverName || 'Select Server'}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 bg-zinc-950 border-zinc-800 p-1 text-zinc-200 shadow-xl rounded-lg"
            >
              <DropdownMenuLabel className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 px-2 py-1">
                Target Workstation ({servers.length})
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              {servers.map((srv) => {
                const isSelected = srv.serverId === (currentServer?.serverId || selectedServerId);
                return (
                  <DropdownMenuItem
                    key={srv.serverId}
                    onClick={() => onSelectServer(srv.serverId)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 text-white font-medium'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{srv.serverName}</span>
                      <span className="text-[10px] font-mono text-zinc-400 truncate">
                        {srv.hostname}
                      </span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Recent Reports Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenHistory}
          className="text-xs h-8 px-3 border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white cursor-pointer font-medium gap-1.5"
          id="btn-open-vaultai-history"
        >
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Recent Reports</span>
          {historyCount > 0 && (
            <span className="ml-1 text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {historyCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
