import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Cpu, ShieldCheck, Link2, AlertTriangle, Activity } from 'lucide-react';

export default function MetricCard({
  title,
  value,
  subtext,
  badgeText,
  icon,
  phaseTag,
  badgeVariant = 'secondary',
  onClick,
}) {
  const renderIcon = (type) => {
    switch (type) {
      case 'server':
        return <Server className="w-4 h-4 text-zinc-200" />;
      case 'agent':
        return <Cpu className="w-4 h-4 text-zinc-200" />;
      case 'integrity':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'blockchain':
        return <Link2 className="w-4 h-4 text-zinc-200" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Activity className="w-4 h-4 text-zinc-300" />;
    }
  };

  return (
    <Card
      onClick={onClick}
      className={`border-zinc-800 bg-zinc-900/80 hover:bg-zinc-900 hover:border-zinc-700 transition-all shadow-md relative overflow-hidden flex flex-col justify-between group ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner group-hover:border-zinc-700 transition-colors">
              {renderIcon(icon)}
            </div>
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              {title}
            </span>
          </div>

          <Badge variant={badgeVariant} className="text-[10px] py-0.5 px-2 font-mono uppercase font-semibold">
            {badgeVariant === 'success' ? 'Live Telemetry' : badgeVariant === 'destructive' ? 'Attention' : 'Operational'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 pb-3">
        <div className="text-2xl font-bold text-white tracking-tight">
          {value}
        </div>
        <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed font-normal">
          {subtext}
        </p>
      </CardContent>

      <CardFooter className="p-3.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs bg-zinc-950/60">
        <span className="text-zinc-400 font-mono text-[11px] font-medium">{phaseTag}</span>
        <Badge variant={badgeVariant} className="text-[10px] font-mono py-0 text-zinc-200">
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${
              badgeVariant === 'success'
                ? 'bg-emerald-400 animate-pulse'
                : badgeVariant === 'destructive'
                ? 'bg-red-400'
                : badgeVariant === 'warning'
                ? 'bg-amber-400'
                : 'bg-zinc-400'
            }`}
          />
          {badgeText}
        </Badge>
      </CardFooter>
    </Card>
  );
}
