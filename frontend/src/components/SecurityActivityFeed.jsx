import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Shield, RefreshCw } from 'lucide-react';

export default function SecurityActivityFeed() {
  const events = [
    {
      id: 'EVT-9042',
      time: '10s ago',
      type: 'AUTH_SESSION_ESTABLISHED',
      source: 'api-gateway:5001',
      severity: 'success',
      desc: 'HttpOnly session token issued with active CSRF synchronizer protection.',
    },
    {
      id: 'EVT-9041',
      time: '1m ago',
      type: 'DB_HEALTH_CHECK',
      source: 'mongoose:database',
      severity: 'success',
      desc: 'MongoDB database connection state evaluated readyState=1 (connected).',
    },
    {
      id: 'EVT-9040',
      time: '3m ago',
      type: 'TELEMETRY_HEARTBEAT_POLL',
      source: 'collector-daemon:us-east-1',
      severity: 'secondary',
      desc: 'Heartbeat received from fleet node node-04-prod. Status: Nominal.',
    },
    {
      id: 'EVT-9039',
      time: '7m ago',
      type: 'RBAC_PERMISSION_PROBE',
      source: 'auth-middleware',
      severity: 'default',
      desc: 'Access control verified against role matrix. Capability checks enforced.',
    },
    {
      id: 'EVT-9038',
      time: '12m ago',
      type: 'HASH_CHAIN_EPOCH_ANCHOR',
      source: 'ledger-anchor:preview',
      severity: 'warning',
      desc: 'Periodic SHA-256 block accumulation confirmed. Epoch 428 in ledger.',
    },
  ];

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'success':
        return <Badge variant="success" className="text-[10px] font-mono py-0 font-semibold">AUTH_OK</Badge>;
      case 'warning':
        return <Badge variant="warning" className="text-[10px] font-mono py-0 font-semibold">ANCHOR</Badge>;
      case 'default':
        return <Badge variant="default" className="text-[10px] font-mono py-0 font-semibold">RBAC</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-mono py-0 font-semibold">TELEMETRY</Badge>;
    }
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-300" />
            <CardTitle className="text-sm font-bold text-white">
              Platform Security Activity Feed
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400 mt-0.5">
            Real-time visual demonstration of collector and ledger telemetry stream
          </CardDescription>
        </div>

        <Badge variant="outline" className="text-[10px] font-mono uppercase font-semibold text-zinc-300 border-zinc-700">
          Telemetry Stream
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-zinc-800/80 font-mono text-xs">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-zinc-800/40 transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3">
                <span className="text-xs text-zinc-400 min-w-[70px] font-semibold">
                  {evt.id}
                </span>
                {getSeverityBadge(evt.severity)}
                <span className="text-zinc-200 font-sans text-xs font-medium">
                  {evt.desc}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400 self-end sm:self-auto shrink-0 font-sans">
                <span className="font-mono text-xs text-zinc-300 font-medium">{evt.source}</span>
                <span>•</span>
                <span className="text-zinc-400">{evt.time}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
