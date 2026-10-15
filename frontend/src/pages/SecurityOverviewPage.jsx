import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGetOverview } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Server,
  Activity,
  ShieldAlert,
  Link2,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Radio,
} from 'lucide-react';

export default function SecurityOverviewPage() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const fetchOverview = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await apiGetOverview();
      setData(res);
      setError(null);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load security overview telemetry.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 20000); // 20s auto-refresh
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const getHealthBadge = (health) => {
    switch (health) {
      case 'ONLINE':
        return (
          <Badge variant="success" className="font-mono text-xs gap-1.5 font-bold py-1 px-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </Badge>
        );
      case 'STALE':
        return (
          <Badge variant="warning" className="font-mono text-xs gap-1.5 font-bold py-1 px-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            STALE
          </Badge>
        );
      case 'OFFLINE':
        return (
          <Badge variant="destructive" className="font-mono text-xs gap-1.5 font-bold py-1 px-2.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            OFFLINE
          </Badge>
        );
      case 'DISABLED':
        return (
          <Badge variant="outline" className="font-mono text-xs text-zinc-300 border-zinc-700 py-1 px-2.5 font-semibold">
            DISABLED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs text-zinc-300 border-zinc-700 py-1 px-2.5 font-semibold">
            UNKNOWN
          </Badge>
        );
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="font-mono text-xs font-bold py-1 px-2.5">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="warning" className="font-mono text-xs font-bold py-1 px-2.5 bg-amber-950/80 text-amber-300 border-amber-800">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning" className="font-mono text-xs font-bold py-1 px-2.5">MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="outline" className="font-mono text-xs text-zinc-200 border-zinc-700 py-1 px-2.5 font-semibold">LOW</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-xs text-zinc-300 border-zinc-700 py-1 px-2.5 font-semibold">INFO</Badge>;
    }
  };

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* ========================================================
          PAGE HEADER (SERENE, READABLE, MINIMAL CLUTTER)
          ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Security Operations Center
            </h1>
            <Badge variant="success" className="text-xs font-mono font-bold py-0.5 px-2 gap-1.5 hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 font-normal leading-relaxed">
            Real-time server telemetry, cryptographic hash-chain monitoring, and on-chain Ethereum commitments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs font-mono text-zinc-400 hidden lg:inline">
              Refreshed {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={isRefreshing}
            className="text-xs h-9 px-3.5 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 hover:text-white cursor-pointer gap-2 font-semibold shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-zinc-300'}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-900/60 bg-red-950/40 text-red-200">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-xs font-bold">Telemetry Synchronization Warning</AlertTitle>
          <AlertDescription className="text-xs text-red-300 mt-0.5">{error}</AlertDescription>
        </Alert>
      )}

      {/* ========================================================
          PRIMARY KPI METRICS (4 CLEAN, CALM CARDS)
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-metrics-grid">
        {/* Card 1: Collector Daemons */}
        <Card
          className="border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-zinc-700 transition-all cursor-pointer shadow-sm rounded-xl"
          onClick={() => navigate('/servers')}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-bold uppercase tracking-wider">
              <span>Collector Fleet</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-zinc-800" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight flex items-baseline gap-2">
                <span>{metrics.onlineCollectors || 0}</span>
                <span className="text-xs sm:text-sm font-normal text-zinc-400 font-sans">
                  / {metrics.totalServers || 0} Online
                </span>
              </div>
            )}
            <div className="text-xs font-mono text-zinc-300 pt-0.5">
              {metrics.offlineCollectors > 0 ? (
                <span className="text-red-400 font-medium">{metrics.offlineCollectors} node(s) offline</span>
              ) : (
                <span className="text-emerald-400 font-medium">All nodes nominal</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Alerts */}
        <Card
          className="border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-zinc-700 transition-all cursor-pointer shadow-sm rounded-xl"
          onClick={() => navigate('/alerts')}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-bold uppercase tracking-wider">
              <span>Active Incidents</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-zinc-800" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight flex items-center gap-2">
                <span>{metrics.openAlerts || 0}</span>
                {metrics.alertsBySeverity?.CRITICAL > 0 && (
                  <Badge variant="destructive" className="font-mono text-xs py-0.5 px-2 font-bold">
                    {metrics.alertsBySeverity.CRITICAL} Critical
                  </Badge>
                )}
              </div>
            )}
            <div className="text-xs text-zinc-300 pt-0.5 font-medium">
              {metrics.openAlerts === 0 ? (
                <span className="text-emerald-400">Zero active threats</span>
              ) : (
                <span className="text-zinc-300">{metrics.alertsBySeverity?.HIGH || 0} High priority</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Ingested & Sealed Log Events */}
        <Card
          className="border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-zinc-700 transition-all cursor-pointer shadow-sm rounded-xl"
          onClick={() => navigate('/logs')}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-bold uppercase tracking-wider">
              <span>Sealed Log Events</span>
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-zinc-800" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                {metrics.totalEvents || 0}
              </div>
            )}
            <div className="text-xs text-zinc-300 pt-0.5 font-mono">
              <span className="text-emerald-400 font-semibold">+{metrics.events24h || 0}</span> in last 24h
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Blockchain Anchors */}
        <Card
          className="border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-zinc-700 transition-all cursor-pointer shadow-sm rounded-xl"
          onClick={() => navigate('/checkpoints')}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-bold uppercase tracking-wider">
              <span>Blockchain Ledger</span>
              <Link2 className="w-4 h-4 text-cyan-400" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 bg-zinc-800" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight flex items-center gap-2">
                <span>{metrics.confirmedCheckpoints || 0}</span>
                <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                  Sepolia
                </span>
              </div>
            )}
            <div className="text-xs text-zinc-300 pt-0.5 font-mono">
              <span>{metrics.totalCheckpoints || 0} total checkpoint(s)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================
          FLEET TELEMETRY & VERIFICATION STATUS TABLE
          ======================================================== */}
      <Card className="border-zinc-800 bg-zinc-900/80 shadow-md rounded-xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Fleet Telemetry &amp; Verification Status
            </CardTitle>
            <CardDescription className="text-xs text-zinc-300 mt-0.5">
              Live collector health, hash chain progression, and cryptographic audit states.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/servers')}
            className="text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1 p-2 h-auto cursor-pointer font-semibold"
          >
            Fleet Inventory
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-2.5">
              <Skeleton className="h-9 w-full bg-zinc-800" />
              <Skeleton className="h-9 w-full bg-zinc-800" />
            </div>
          ) : (data?.serverHealthList || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 font-medium">
              No servers enrolled yet. Register your first server in Server Fleet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader className="bg-zinc-950/80 border-b border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-200 font-bold uppercase tracking-wider text-xs py-3 px-4">Server / Host</TableHead>
                    <TableHead className="text-zinc-200 font-bold uppercase tracking-wider text-xs py-3 px-4">Collector</TableHead>
                    <TableHead className="text-zinc-200 font-bold uppercase tracking-wider text-xs py-3 px-4">Last Heartbeat</TableHead>
                    <TableHead className="text-zinc-200 font-bold uppercase tracking-wider text-xs py-3 px-4">Chain Head</TableHead>
                    <TableHead className="text-zinc-200 font-bold uppercase tracking-wider text-xs py-3 px-4">Integrity</TableHead>
                    <TableHead className="text-right text-zinc-200 font-bold uppercase tracking-wider text-xs py-3 px-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-800/60">
                  {data.serverHealthList.map((srv) => (
                    <TableRow key={srv.serverId} className="border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="py-3 px-4">
                        <div className="font-bold text-white text-xs sm:text-sm">{srv.serverName}</div>
                        <div className="text-xs font-mono text-zinc-300">{srv.hostname} ({srv.environment})</div>
                      </TableCell>
                      <TableCell className="py-3 px-4">{getHealthBadge(srv.collectorHealth)}</TableCell>
                      <TableCell className="py-3 px-4 font-mono text-zinc-200 text-xs font-medium">
                        {srv.lastHeartbeatAgeSeconds !== null ? (
                          <span>{srv.lastHeartbeatAgeSeconds}s ago</span>
                        ) : (
                          <span className="text-zinc-500">None</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 font-mono text-emerald-400 font-bold text-xs sm:text-sm">
                        #{srv.chainHeadSequence}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <Badge
                          variant={
                            srv.lastVerificationStatus === 'VERIFIED'
                              ? 'success'
                              : srv.lastVerificationStatus === 'TAMPERED'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="font-mono text-xs font-bold py-0.5 px-2"
                        >
                          {srv.lastVerificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/servers/${srv.serverId}`)}
                          className="h-7 px-3 text-xs text-zinc-100 hover:text-white bg-zinc-900 border-zinc-700 hover:bg-zinc-800 cursor-pointer font-semibold rounded-md shadow-xs"
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          RECENT SECURITY FINDINGS & INCIDENTS (CLEAN FULL WIDTH)
          - "Latest Verified Chain & Ledger" section is completely removed
          ======================================================== */}
      <Card className="border-zinc-800 bg-zinc-900/80 shadow-md rounded-xl">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Recent Security Findings &amp; Incidents
            </CardTitle>
            <CardDescription className="text-xs text-zinc-300 mt-0.5">
              Cryptographic chain anomalies, collector status warnings, and integrity events.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/alerts')}
            className="text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1 p-2 h-auto cursor-pointer font-semibold"
          >
            All Alerts
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-12 w-full bg-zinc-800" />
              <Skeleton className="h-12 w-full bg-zinc-800" />
            </div>
          ) : (data?.recentAlerts || []).length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-white text-sm block">Zero Active Security Incidents</span>
                <span className="text-zinc-300 text-xs">All collector heartbeats and cryptographic chains are completely nominal.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.recentAlerts.map((alt) => (
                <div
                  key={alt.alertId}
                  onClick={() => navigate('/alerts')}
                  className="p-3.5 rounded-lg bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getSeverityBadge(alt.severity)}</div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs sm:text-sm text-white">{alt.title}</div>
                      <div className="text-xs text-zinc-200 line-clamp-1 leading-relaxed">{alt.description}</div>
                      <div className="text-xs font-mono text-zinc-400 pt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-zinc-300">Asset: {alt.serverName || alt.serverId || 'Global'}</span>
                        <span>•</span>
                        <span>{new Date(alt.detectedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={alt.status === 'OPEN' ? 'warning' : 'outline'}
                    className="font-mono text-xs uppercase shrink-0 font-bold py-0.5 px-2"
                  >
                    {alt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
