import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Shield, Server, Copy, Check } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export default function SystemDiagnosticsDialog({
  user,
  apiHealth,
  dbHealth,
  backendStatus,
  backendLatency,
}) {
  const [copied, setCopied] = React.useState(false);

  const copyDiagnostics = () => {
    const info = {
      user: { id: user?.id, role: user?.role, email: user?.email },
      backendStatus,
      backendLatency,
      apiEndpoint: API_BASE_URL,
      database: dbHealth?.data || 'N/A',
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 gap-1.5 cursor-pointer font-medium"
          id="btn-open-diagnostics"
        >
          <Activity className="w-3.5 h-3.5 text-zinc-300" />
          <span className="hidden sm:inline">Diagnostics</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white">
                System Telemetry &amp; Diagnostics
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                Internal runtime telemetry, session state, and database connectivity.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* API Health */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                Backend API Gateway
              </span>
              <Badge variant={backendStatus === 'connected' ? 'success' : 'destructive'} className="text-[10px]">
                {backendStatus === 'connected' ? 'Connected (200 OK)' : 'Offline'}
              </Badge>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Endpoint:</span>
              <span className="font-mono text-zinc-200 font-medium">{API_BASE_URL}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Latency:</span>
              <span className="font-mono text-zinc-200 font-medium">{backendLatency ? `${backendLatency}ms` : 'N/A'}</span>
            </div>
          </div>

          {/* Database Health */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Database Engine
              </span>
              <Badge variant={dbHealth?.connected ? 'success' : 'destructive'} className="text-[10px]">
                {dbHealth?.connected ? 'Mongoose Active' : 'Disconnected'}
              </Badge>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>ReadyState:</span>
              <span className="font-mono text-zinc-200 font-medium">
                {dbHealth?.data?.readyState !== undefined ? `${dbHealth.data.readyState} (${dbHealth.data.database})` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Status:</span>
              <span className="text-zinc-200 truncate max-w-[200px] font-medium" title={dbHealth?.message}>
                {dbHealth?.message || 'N/A'}
              </span>
            </div>
          </div>

          {/* Session Profile */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                <Shield className="w-3.5 h-3.5 text-zinc-300" />
                Active Session
              </span>
              <Badge variant="default" className="text-[10px] bg-white text-zinc-950 font-bold">
                {user?.role}
              </Badge>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>User ID:</span>
              <span className="font-mono text-zinc-200 font-medium">{user?.id || 'Anonymous'}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Security Cookie:</span>
              <span className="font-mono text-emerald-400 font-medium">logsentinel.sid (HttpOnly)</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyDiagnostics}
            className="text-xs gap-1.5 border-zinc-700 hover:bg-zinc-800 text-zinc-200 cursor-pointer font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard' : 'Copy JSON Telemetry'}
          </Button>
          <span className="text-[11px] text-zinc-400 font-mono">Phase 1 Engine</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
