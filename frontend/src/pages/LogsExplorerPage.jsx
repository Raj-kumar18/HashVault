import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGetLogs, apiGetLogEvent } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Terminal,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  AlertCircle,
  Eye,
} from 'lucide-react';

export default function LogsExplorerPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Search & Filter State
  const queryParams = new URLSearchParams(location.search);
  const initialServer = queryParams.get('server') || 'all';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [selectedServer, setSelectedServer] = useState(initialServer);
  const [selectedSource, setSelectedSource] = useState('all');
  const [minSequence, setMinSequence] = useState('');
  const [maxSequence, setMaxSequence] = useState('');

  // Dropdown options from backend
  const [availableServers, setAvailableServers] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 });

  // Detail Modal State
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetLogs({
        page,
        limit,
        search,
        serverId: selectedServer,
        source: selectedSource,
        minSequence: minSequence ? parseInt(minSequence, 10) : undefined,
        maxSequence: maxSequence ? parseInt(maxSequence, 10) : undefined,
      });

      const rawLogs = res.logs || [];
      const seen = new Set();
      const uniqueLogs = rawLogs.filter((l) => {
        const id = l._id || l.eventId || `${l.serverId}-${l.sequenceNumber}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      setLogs(uniqueLogs);
      setPagination(res.pagination || { total: uniqueLogs.length, totalPages: 1, page: 1, limit: 25 });
      if (res.availableServers) setAvailableServers(res.availableServers);
      if (res.availableSources) setAvailableSources(res.availableSources);
    } catch (err) {
      setError(err.message || 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedServer, selectedSource, minSequence, maxSequence]);

  useEffect(() => {
    fetchLogs();

    // Silent background poll every 3 seconds for real-time streaming
    const interval = setInterval(() => {
      apiGetLogs({
        page,
        limit,
        search,
        serverId: selectedServer,
        source: selectedSource,
        minSequence: minSequence ? parseInt(minSequence, 10) : undefined,
        maxSequence: maxSequence ? parseInt(maxSequence, 10) : undefined,
      }).then((res) => {
        if (res?.logs) {
          const seen = new Set();
          const uniqueLogs = (res.logs || []).filter((l) => {
            const id = l._id || l.eventId || `${l.serverId}-${l.sequenceNumber}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setLogs(uniqueLogs);
          setPagination(res.pagination || { total: uniqueLogs.length, totalPages: 1, page: 1, limit: 25 });
        }
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchLogs, page, limit, search, selectedServer, selectedSource, minSequence, maxSequence]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedServer('all');
    setSelectedSource('all');
    setMinSequence('');
    setMaxSequence('');
    setPage(1);
  };

  // Inspect Event Details
  const handleInspectEvent = async (eventId) => {
    setSelectedEventId(eventId);
    setDetailLoading(true);
    try {
      const res = await apiGetLogEvent(eventId);
      setEventDetail(res.event);
    } catch (err) {
      console.error('Failed to load event forensic detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Universal Logs Explorer
                <Badge variant="default" className="font-mono text-xs bg-white text-zinc-950 font-bold">
                  Forensic Audit
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] border-emerald-800 bg-emerald-950/40 text-emerald-400 flex items-center gap-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Feed (3s)
                </Badge>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
                Search, filter, and inspect persisted event streams across all authorized servers with SHA-256 cryptographic proof linkage.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs h-9 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 cursor-pointer gap-2 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-white' : 'text-zinc-400'}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold">Query Error</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Filter & Search Bar */}
      <Card className="border-zinc-800 bg-zinc-900/80 shadow-md">
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Search Input */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Search Content</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Search message text or event ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 bg-zinc-950 border-zinc-700 text-xs h-9 text-white placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Server Selector */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Host Server</label>
              <select
                value={selectedServer}
                onChange={(e) => {
                  setSelectedServer(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-700 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="all">All Servers ({availableServers.length})</option>
                {availableServers.map((s) => (
                  <option key={s.serverId} value={s.serverId}>
                    {s.serverName} ({s.hostname})
                  </option>
                ))}
              </select>
            </div>

            {/* Source Selector */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Log Source</label>
              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-700 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="all">All Sources</option>
                {availableSources.map((src) => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>

            {/* Sequence Range */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Seq Range</label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minSequence}
                  onChange={(e) => setMinSequence(e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-xs h-9 text-white p-2"
                />
                <span className="text-zinc-500 font-mono">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxSequence}
                  onChange={(e) => setMaxSequence(e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-xs h-9 text-white p-2"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="md:col-span-1 flex items-center gap-1.5">
              <Button
                type="submit"
                size="sm"
                className="w-full text-xs h-9 bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer"
              >
                Filter
              </Button>
            </div>
          </form>

          {(search || selectedServer !== 'all' || selectedSource !== 'all' || minSequence || maxSequence) && (
            <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800 text-xs">
              <span className="text-zinc-400">
                Filtered records: <strong className="text-white font-mono font-bold">{pagination.total}</strong> events found
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-zinc-200 hover:text-white underline cursor-pointer font-medium"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-9 w-full bg-zinc-800/80" />
              <Skeleton className="h-9 w-full bg-zinc-800/80" />
              <Skeleton className="h-9 w-full bg-zinc-800/80" />
              <Skeleton className="h-9 w-full bg-zinc-800/80" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Terminal className="w-8 h-8 text-zinc-500 mx-auto" />
              <div className="text-sm font-bold text-zinc-200">No Log Events Found</div>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto font-normal">
                No events match the selected filters. Verify your search query or ensure collectors are actively dispatching logs.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:text-white cursor-pointer mt-2 font-medium"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-zinc-950/90 border-b border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-300 font-bold w-16">Seq #</TableHead>
                    <TableHead className="text-zinc-300 font-bold">Timestamp</TableHead>
                    <TableHead className="text-zinc-300 font-bold">Server / Host</TableHead>
                    <TableHead className="text-zinc-300 font-bold">Source</TableHead>
                    <TableHead className="text-zinc-300 font-bold">Message</TableHead>
                    <TableHead className="text-zinc-300 font-bold">Event Hash</TableHead>
                    <TableHead className="text-right text-zinc-300 font-bold">Inspect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-800/60">
                  {logs.map((log) => (
                    <TableRow key={log._id || log.eventId || `${log.serverId}-${log.sequenceNumber}`} className="border-zinc-800/60 hover:bg-zinc-800/40">
                      <TableCell className="font-mono text-white font-bold text-xs">
                        #{log.sequenceNumber ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-zinc-300 whitespace-nowrap text-xs">
                        <div>{new Date(log.observedAt).toLocaleTimeString()}</div>
                        <div className="text-[11px] text-zinc-400">{new Date(log.observedAt).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell className="font-medium text-white whitespace-nowrap">
                        <div className="font-bold text-zinc-100">{log.serverName}</div>
                        <div className="text-xs font-mono text-zinc-400">{log.hostname}</div>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-300 text-xs whitespace-nowrap">
                        <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-700">
                          {log.source}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-200 max-w-md">
                        <div className="truncate font-mono" title={log.message}>
                          {log.message}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-300 text-xs whitespace-nowrap">
                        {log.eventHash ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-200 truncate max-w-[100px] font-mono font-medium" title={log.eventHash}>
                              {log.eventHash.slice(0, 10)}...
                            </span>
                            <button
                              onClick={() => handleCopy(log.eventHash, `hash_${log.eventId}`)}
                              className="text-zinc-400 hover:text-white cursor-pointer"
                              title="Copy SHA-256 Hash"
                            >
                              {copiedField === `hash_${log.eventId}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInspectEvent(log.eventId)}
                          className="h-8 text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer gap-1.5 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <div>
              Showing page <strong className="text-white font-mono font-bold">{pagination.page}</strong> of{' '}
              <strong className="text-white font-mono font-bold">{pagination.totalPages}</strong> ({pagination.total} total events)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 text-xs border-zinc-700 bg-zinc-900 text-zinc-200 cursor-pointer gap-1 font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              <span className="font-mono text-white px-2 font-bold">
                {page} / {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages || loading}
                className="h-8 text-xs border-zinc-700 bg-zinc-900 text-zinc-200 cursor-pointer gap-1 font-semibold"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Forensic Event Detail Dialog */}
      {selectedEventId && (
        <Dialog open={!!selectedEventId} onOpenChange={() => setSelectedEventId(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl p-6">
            <DialogHeader className="pr-8">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    Event Forensic Record
                    {eventDetail?.sequenceNumber && (
                      <Badge variant="default" className="font-mono text-xs bg-white text-zinc-950 font-bold">
                        Seq #{eventDetail.sequenceNumber}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-mono text-zinc-400 mt-0.5">
                    Event ID: <code className="text-zinc-200 font-semibold">{selectedEventId}</code>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {detailLoading || !eventDetail ? (
              <div className="py-8 space-y-3">
                <Skeleton className="h-6 w-full bg-zinc-800" />
                <Skeleton className="h-20 w-full bg-zinc-800" />
              </div>
            ) : (
              <div className="space-y-4 py-2 text-xs w-full min-w-0">
                {/* Host & Timing Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 font-mono w-full min-w-0">
                  <div>
                    <span className="text-zinc-400 block font-sans text-xs">Host Node:</span>
                    <span className="text-white font-bold">{eventDetail.serverName}</span>
                    <span className="text-zinc-400 block text-[11px]">{eventDetail.hostname} ({eventDetail.environment})</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-sans text-xs">Source Channel:</span>
                    <span className="text-zinc-100 font-bold">{eventDetail.source}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-sans text-xs">Observed At:</span>
                    <span className="text-zinc-200">{new Date(eventDetail.observedAt).toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-sans text-xs">Ingested At:</span>
                    <span className="text-zinc-200">{new Date(eventDetail.ingestedAt).toISOString()}</span>
                  </div>
                </div>

                {/* Raw Log Message Content */}
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-zinc-200">Raw Message:</span>
                    <button
                      onClick={() => handleCopy(eventDetail.message, 'msg_detail')}
                      className="text-xs text-zinc-300 hover:text-white cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      {copiedField === 'msg_detail' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Content
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all w-full min-w-0">
                    {eventDetail.message}
                  </pre>
                </div>

                {/* Cryptographic Proof Details (Phase 4 Sequential Hash Chain) */}
                {eventDetail.cryptographicProof ? (
                  <div className="space-y-2 pt-2 border-t border-zinc-800 w-full min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-emerald-400">Phase 4 Cryptographic Hash Chain Proof</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs space-y-2.5 w-full min-w-0">
                      <div className="min-w-0">
                        <span className="text-zinc-400 block text-[11px] font-sans">Previous Hash (H_prev):</span>
                        <span className="text-zinc-300 break-all select-all font-semibold block">{eventDetail.cryptographicProof.previousHash}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-zinc-400 block text-[11px] font-sans">Event Hash (H_curr):</span>
                        <span className="text-emerald-400 font-bold break-all select-all block">{eventDetail.cryptographicProof.eventHash}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-400 block text-[11px] font-sans">RFC 8785 Canonical Payload:</span>
                          <button
                            onClick={() => handleCopy(eventDetail.cryptographicProof.canonicalPayload, 'payload_detail')}
                            className="text-[11px] text-zinc-400 hover:text-white cursor-pointer flex items-center gap-1 font-sans"
                          >
                            {copiedField === 'payload_detail' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            Copy JSON
                          </button>
                        </div>
                        {(() => {
                          let displayPayload = eventDetail.cryptographicProof.canonicalPayload;
                          try {
                            displayPayload = JSON.stringify(JSON.parse(displayPayload), null, 2);
                          } catch {}
                          return (
                            <pre className="text-xs text-zinc-300 overflow-x-auto max-h-40 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 whitespace-pre-wrap break-all w-full min-w-0 font-mono">
                              {displayPayload}
                            </pre>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono flex items-center gap-2 w-full min-w-0">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <span>Event pending hash-chain sealing or unverified.</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEventId(null)}
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer font-semibold"
              >
                Close
              </Button>
              {eventDetail?.serverId && (
                <Button
                  size="sm"
                  onClick={() => navigate(`/integrity?server=${eventDetail.serverId}`)}
                  className="text-xs bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer"
                >
                  Verify Hash Chain
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
