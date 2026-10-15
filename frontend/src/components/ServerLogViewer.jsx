import React, { useState, useEffect, useCallback } from 'react';
import { apiGetServerLogs } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Copy,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function ServerLogViewer({ serverId, serverName }) {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedId, setCopiedId] = useState(null);
  const [inspectEvent, setInspectEvent] = useState(null);

  const fetchLogs = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setLoading(true);
      setError(null);
      try {
        const params = { page, limit: 50 };
        if (sourceFilter) params.source = sourceFilter;
        const res = await apiGetServerLogs(serverId, params);
        const rawLogs = res.logs || [];
        const seen = new Set();
        const uniqueLogs = rawLogs.filter((l) => {
          const id = l._id || l.eventId || `${serverId}-${l.sequenceNumber}`;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setLogs(uniqueLogs);
        setTotalCount(res.pagination?.total || uniqueLogs.length);
        setTotalPages(res.pagination?.totalPages || 1);
      } catch (err) {
        setError(err.message || 'Failed to load telemetry logs from backend.');
      } finally {
        if (showLoadingSpinner) setLoading(false);
      }
    },
    [serverId, page, sourceFilter]
  );

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Client-side search filtering
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.message?.toLowerCase().includes(q) ||
      log.source?.toLowerCase().includes(q) ||
      log.eventId?.toLowerCase().includes(q)
    );
  });

  // Extract unique sources for filter dropdown
  const uniqueSources = Array.from(new Set(logs.map((l) => l.source).filter(Boolean)));

  const formatTimestamp = (ts) => {
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hour12: false,
      });
    } catch {
      return ts;
    }
  };

  const getLogSeverityColor = (msg) => {
    const text = String(msg).toLowerCase();
    if (text.includes('error') || text.includes('fatal') || text.includes('critical') || text.includes('failed')) {
      return 'text-red-400 font-semibold';
    }
    if (text.includes('warn') || text.includes('warning') || text.includes('retry')) {
      return 'text-amber-400 font-medium';
    }
    if (text.includes('success') || text.includes('verified') || text.includes('connected') || text.includes('enrolled')) {
      return 'text-emerald-400';
    }
    return 'text-zinc-200';
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-700 text-white">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-white tracking-tight">
                  Live Telemetry &amp; Ingested Log Stream
                </CardTitle>
                <Badge variant="default" className="font-mono text-[10px] bg-white text-zinc-950 font-bold">
                  Collector Pipeline
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Verified logs ingested from background agent via{' '}
                <code className="text-zinc-300 font-mono text-xs">POST /api/collector/logs</code>
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`text-xs h-8 cursor-pointer gap-1.5 font-semibold ${
                autoRefresh
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              Auto-stream {autoRefresh ? 'ON' : 'OFF'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={loading}
              className="text-xs h-8 bg-zinc-950 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Search log messages, event ID, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-zinc-950 border-zinc-700 text-xs h-8 text-white placeholder:text-zinc-500"
            />
          </div>

          {uniqueSources.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="">All Sources ({totalCount})</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="p-4 m-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && logs.length === 0 ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-full bg-zinc-800/80" />
            <Skeleton className="h-6 w-5/6 bg-zinc-800/80" />
            <Skeleton className="h-6 w-4/6 bg-zinc-800/80" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Terminal className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-200">
                {logs.length === 0 ? 'No Ingested Logs Yet' : 'No Matching Log Events'}
              </h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed font-normal">
                {logs.length === 0
                  ? `Server ${serverName} has not delivered any telemetry batches yet. Start the background collector agent on your host using the instructions below.`
                  : 'Try adjusting your search query or clear the source filter.'}
              </p>
            </div>

            {logs.length === 0 && (
              <div className="pt-2 max-w-lg mx-auto text-left">
                <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-200">Quick Agent Start Command:</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 text-zinc-300">CLI</Badge>
                  </div>
                  <pre className="text-xs font-mono text-zinc-200 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto select-all">
                    {`node collector/src/index.js --server ${serverId} --enroll <YOUR_TOKEN>`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 font-mono text-xs overflow-x-auto">
            <div className="bg-zinc-950 px-4 py-2 flex items-center justify-between text-xs text-zinc-400 font-sans border-b border-zinc-800">
              <div className="flex items-center gap-4">
                <span>Showing {filteredLogs.length} of {totalCount} events</span>
                <span className="text-zinc-600">|</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Ingestion pipeline active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-zinc-400 font-mono font-medium">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="bg-zinc-950 max-h-[460px] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div
                  key={log._id || log.eventId || `${serverId}-${log.sequenceNumber}`}
                  className="px-4 py-2 hover:bg-zinc-900/60 transition-colors flex items-start justify-between gap-3 group border-b border-zinc-850 border-zinc-900"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-zinc-400">{formatTimestamp(log.observedAt || log.createdAt)}</span>
                      <Badge variant="outline" className="text-[10px] font-mono border-zinc-750 border-zinc-700 bg-zinc-900 text-zinc-200 px-1.5 py-0 font-medium">
                        {log.source || 'syslog'}
                      </Badge>
                      <span className="text-xs text-zinc-400 font-mono">
                        {log.eventId.slice(0, 12)}...
                      </span>
                    </div>
                    <div className={`text-xs break-all leading-relaxed ${getLogSeverityColor(log.message)}`}>
                      {log.message}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(log.message, log.eventId)}
                      title="Copy log message"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {copiedId === log.eventId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectEvent(log)}
                      title="Inspect envelope"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-300" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Inspect Canonical Event Envelope Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-3 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Canonical Log Event Envelope</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectEvent(null)}
                className="h-6 w-6 p-0 text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </Button>
            </div>
            <pre className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-200 max-h-80 overflow-y-auto select-all">
              {JSON.stringify(inspectEvent, null, 2)}
            </pre>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInspectEvent(null)}
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer font-semibold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
