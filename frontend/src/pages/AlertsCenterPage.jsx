import React, { useState, useEffect, useCallback } from 'react';
import {
  apiGetAlerts,
  apiAcknowledgeAlert,
  apiResolveAlert,
} from '@/utils/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
} from 'lucide-react';

export default function AlertsCenterPage({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsFilterStatus, setAlertsFilterStatus] = useState('ALL');
  const [alertsFilterSeverity, setAlertsFilterSeverity] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await apiGetAlerts({
        status: alertsFilterStatus,
        severity: alertsFilterSeverity,
        search: searchQuery || undefined,
        limit: 50,
      });
      setAlerts(res?.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setAlertsLoading(false);
      setIsRefreshing(false);
    }
  }, [alertsFilterStatus, alertsFilterSeverity, searchQuery]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      // Instantly dispatch event to close any visible real-time notification
      window.dispatchEvent(new CustomEvent('hashvault:alert-action', { detail: { alertId, action: 'ACKNOWLEDGE' } }));
      setAlerts((prev) =>
        prev.map((a) => (a.alertId === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a))
      );
      if (selectedAlert && selectedAlert.alertId === alertId) {
        setSelectedAlert((prev) => (prev ? { ...prev, status: 'ACKNOWLEDGED' } : null));
      }
      await apiAcknowledgeAlert(alertId);
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolveAlert = async (alertId) => {
    setIsResolving(true);
    try {
      // Instantly dispatch event to close any visible real-time notification
      window.dispatchEvent(new CustomEvent('hashvault:alert-action', { detail: { alertId, action: 'RESOLVE' } }));
      setAlerts((prev) =>
        prev.map((a) => (a.alertId === alertId ? { ...a, status: 'RESOLVED', resolutionNotes } : a))
      );
      await apiResolveAlert(alertId, { resolutionNotes });
      setResolutionNotes('');
      setSelectedAlert(null);
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/60 border border-red-700/60 text-red-200">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 border border-amber-700/60 text-amber-200">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-800 border border-zinc-700 text-zinc-200">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
            {severity}
          </span>
        );
    }
  };

  const totalOpen = alerts.filter((a) => a.status === 'OPEN').length;
  const totalCritical = alerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'OPEN').length;
  const totalHigh = alerts.filter((a) => a.severity === 'HIGH' && a.status === 'OPEN').length;
  const totalAck = alerts.filter((a) => a.status === 'ACKNOWLEDGED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-400 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            Security Alerts Center
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-3xl leading-relaxed">
            Real-time incident triage, cryptographic tampering alerts, sequence gaps, and alert lifecycle management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAlerts}
            disabled={isRefreshing}
            className="text-xs bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer gap-1.5 h-9 px-3 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Alerts'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/90 border-zinc-800/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Open Incidents</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-white">{totalOpen}</div>
            <p className="text-xs text-zinc-400 mt-1">Awaiting review or triage</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/90 border-zinc-800/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Critical Incidents</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-red-400">{totalCritical}</div>
            <p className="text-xs text-zinc-400 mt-1">Immediate action required</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/90 border-zinc-800/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>High Severity</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-amber-400">{totalHigh}</div>
            <p className="text-xs text-zinc-400 mt-1">Elevated risk anomalies</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/90 border-zinc-800/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Acknowledged</span>
              <Clock className="w-4 h-4 text-zinc-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-zinc-200">{totalAck}</div>
            <p className="text-xs text-zinc-400 mt-1">Under active analyst investigation</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Status:</span>
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              {['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setAlertsFilterStatus(st)}
                  className={`px-3 py-1 rounded-md text-xs font-mono cursor-pointer transition-colors ${
                    alertsFilterStatus === st
                      ? 'bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Severity:</span>
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setAlertsFilterSeverity(sev)}
                  className={`px-3 py-1 rounded-md text-xs font-mono cursor-pointer transition-colors ${
                    alertsFilterSeverity === sev
                      ? 'bg-zinc-800 text-white font-semibold border border-zinc-700 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search alerts or assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Alerts Table */}
      <Card className="bg-zinc-900/90 border-zinc-800/80 shadow-sm">
        <CardContent className="p-0">
          {alertsLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full bg-zinc-800/60" />
              <Skeleton className="h-10 w-full bg-zinc-800/60" />
              <Skeleton className="h-10 w-full bg-zinc-800/60" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-16 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span className="font-bold text-zinc-100 text-sm">Zero Active Security Incidents</span>
              <span className="text-zinc-400">All collector heartbeats and cryptographic chains are nominal.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-zinc-950 border-b border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-24 text-zinc-400 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Severity</TableHead>
                    <TableHead className="min-w-[240px] text-zinc-400 font-semibold uppercase tracking-wider text-xs">Alert / Condition</TableHead>
                    <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Affected Asset</TableHead>
                    <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Occurrences</TableHead>
                    <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Detected At</TableHead>
                    <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right text-zinc-400 font-semibold uppercase tracking-wider text-xs w-[170px] min-w-[170px] whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-800/40">
                  {alerts.map((alt) => (
                    <TableRow key={alt.alertId} className="border-zinc-800/50 hover:bg-zinc-850/50">
                      <TableCell className="whitespace-nowrap">{getSeverityBadge(alt.severity)}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-white">{alt.title}</div>
                        <div className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{alt.description}</div>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-300 whitespace-nowrap">
                        {alt.serverName || alt.serverId || 'Global System'}
                      </TableCell>
                      <TableCell className="font-mono text-zinc-200 font-semibold whitespace-nowrap">
                        {alt.occurrenceCount}x
                      </TableCell>
                      <TableCell className="font-mono text-zinc-400 text-xs whitespace-nowrap">
                        {new Date(alt.detectedAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={
                            alt.status === 'OPEN'
                              ? 'warning'
                              : alt.status === 'ACKNOWLEDGED'
                              ? 'outline'
                              : 'success'
                          }
                          className="font-mono text-[10px] font-semibold"
                        >
                          {alt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap py-3">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAlert(alt)}
                            className="h-7 px-2.5 text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white cursor-pointer font-medium whitespace-nowrap shrink-0"
                          >
                            Investigate
                          </Button>
                          {alt.status === 'OPEN' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledgeAlert(alt.alertId)}
                              className="h-7 px-2.5 text-xs border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 cursor-pointer font-medium whitespace-nowrap shrink-0"
                            >
                              Ack
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Investigation Dialog */}
      {selectedAlert && (
        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                {getSeverityBadge(selectedAlert.severity)}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {selectedAlert.status}
                </Badge>
              </div>
              <DialogTitle className="text-base font-bold text-white">
                {selectedAlert.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Alert ID: <span className="font-mono text-zinc-300">{selectedAlert.alertId}</span> • Detected at{' '}
                {new Date(selectedAlert.detectedAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800 font-mono text-xs">
                <div>
                  <span className="text-zinc-500">Target Asset:</span>
                  <div className="text-zinc-200 font-bold mt-0.5">
                    {selectedAlert.serverName || selectedAlert.serverId || 'Global'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Occurrences:</span>
                  <div className="text-zinc-200 font-bold mt-0.5">{selectedAlert.occurrenceCount}x</div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-zinc-300">Detailed Description:</span>
                <p className="mt-1 text-zinc-200 text-xs leading-relaxed bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                  {selectedAlert.description}
                </p>
              </div>

              {selectedAlert.evidenceMetadata && (
                <div>
                  <span className="text-xs font-semibold text-zinc-300">Cryptographic Evidence Metadata:</span>
                  <pre className="mt-1.5 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 max-h-48 overflow-y-auto leading-relaxed">
                    {JSON.stringify(selectedAlert.evidenceMetadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAlert.status !== 'RESOLVED' && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-300">Resolution Notes:</span>
                  <Input
                    placeholder="Enter resolution notes or root cause diagnosis..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-xs h-9 text-white focus:border-white"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAlert(null)}
                className="text-xs bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                Close
              </Button>
              {selectedAlert.status === 'OPEN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAcknowledgeAlert(selectedAlert.alertId)}
                  className="text-xs border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 cursor-pointer font-medium"
                >
                  Acknowledge
                </Button>
              )}
              {selectedAlert.status !== 'RESOLVED' && (
                <Button
                  size="sm"
                  onClick={() => handleResolveAlert(selectedAlert.alertId)}
                  disabled={isResolving}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {isResolving ? 'Resolving...' : 'Mark Resolved'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
