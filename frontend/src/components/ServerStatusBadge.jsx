import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock, Ban, WifiOff, HelpCircle } from 'lucide-react';

export function EnrollmentBadge({ status }) {
  switch (status) {
    case 'ENROLLED':
      return (
        <Badge variant="success" className="gap-1.5 font-mono text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ENROLLED
        </Badge>
      );
    case 'PENDING_ENROLLMENT':
      return (
        <Badge variant="warning" className="gap-1.5 font-mono text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          PENDING
        </Badge>
      );
    case 'DISABLED':
      return (
        <Badge variant="destructive" className="gap-1.5 font-mono text-xs font-semibold">
          <Ban className="w-3.5 h-3.5 text-red-400" />
          DISABLED
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1.5 font-mono text-xs font-semibold">
          {status || 'UNKNOWN'}
        </Badge>
      );
  }
}

export function ConnectionBadge({ status }) {
  switch (status) {
    case 'ONLINE':
      return (
        <Badge variant="success" className="gap-1.5 font-mono text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          ONLINE
        </Badge>
      );
    case 'STALE':
      return (
        <Badge variant="warning" className="gap-1.5 font-mono text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          STALE
        </Badge>
      );
    case 'OFFLINE':
      return (
        <Badge variant="destructive" className="gap-1.5 font-mono text-xs font-semibold">
          <WifiOff className="w-3.5 h-3.5 text-red-400" />
          OFFLINE
        </Badge>
      );
    case 'UNKNOWN':
    default:
      return (
        <Badge variant="outline" className="gap-1.5 font-mono text-xs text-zinc-400 border-zinc-700">
          <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
          NO HEARTBEAT
        </Badge>
      );
  }
}
