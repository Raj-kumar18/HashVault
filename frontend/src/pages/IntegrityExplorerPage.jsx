import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  apiGetServers,
  apiGetIntegritySummary,
  apiGetIntegrityEvents,
  apiGetIntegrityEvent,
  apiVerifyIntegrity,
  apiGetCheckpoints,
} from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  Copy,
  Check,
  Layers,
  Server,
  FileCode,
  Lock,
  ChevronLeft,
  ChevronRight,
  Link2,
} from 'lucide-react';

export default function IntegrityExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Servers list for selector
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(searchParams.get('server') || '');
  const [serversLoading, setServersLoading] = useState(true);

  // Integrity summary for selected server
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Events list for selected server
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkpoints, setCheckpoints] = useState([]);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationError, setVerificationError] = useState(null);
  const [findingsDialogOpen, setFindingsDialogOpen] = useState(false);

  // Inspect single event detail state
  const [inspectEvent, setInspectEvent] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Copy-to-clipboard state
  const [copiedHash, setCopiedHash] = useState(null);

  // Fetch servers list once
  useEffect(() => {
    async function loadServers() {
      setServersLoading(true);
      try {
        const res = await apiGetServers({ limit: 100 });
        const srvs = res.servers || [];
        setServers(srvs);

        // Auto-select first server if none selected in URL
        if (!selectedServerId && srvs.length > 0) {
          const firstId = srvs[0].serverId;
          setSelectedServerId(firstId);
          setSearchParams({ server: firstId });
        }
      } catch (err) {
        console.error('Failed to load fleet servers:', err);
      } finally {
        setServersLoading(false);
      }
    }
    loadServers();
  }, []);

  // Handle Server Switch
  const handleSelectServer = (id) => {
    setSelectedServerId(id);
    setSearchParams({ server: id });
    setPage(1);
    setSearchQuery('');
    setVerificationResult(null);
    setVerificationError(null);
  };

  // Fetch Integrity Summary for selected server
  const fetchSummary = useCallback(async () => {
    if (!selectedServerId) return;
    setSummaryLoading(true);
    try {
      const res = await apiGetIntegritySummary(selectedServerId);
      setSummary(res);
    } catch (err) {
      console.error('Failed to load integrity summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedServerId]);

  // Fetch Checkpoints for selected server
  const fetchCheckpoints = useCallback(async () => {
    if (!selectedServerId) return;
    try {
      const res = await apiGetCheckpoints({ serverId: selectedServerId, limit: 50 });
      setCheckpoints(res.checkpoints || []);
    } catch (err) {
      console.error('Failed to load server checkpoints:', err);
    }
  }, [selectedServerId]);

  // Fetch Paginated Sealed Events
  const fetchEvents = useCallback(async () => {
    if (!selectedServerId) return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await apiGetIntegrityEvents(selectedServerId, {
        page,
        limit: 15,
        search: searchQuery,
      });
      setEvents(res.events || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.totalCount || 0);
    } catch (err) {
      setEventsError(err.message || 'Failed to load integrity records.');
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [selectedServerId, page, searchQuery]);

  useEffect(() => {
    if (selectedServerId) {
      fetchSummary();
      fetchEvents();
      fetchCheckpoints();
    }
  }, [selectedServerId, fetchSummary, fetchEvents, fetchCheckpoints]);

  // Real-time silent background poll every 2.5 seconds
  useEffect(() => {
    if (!selectedServerId) return;

    const silentPoll = async () => {
      try {
        const [sumRes, evRes] = await Promise.all([
          apiGetIntegritySummary(selectedServerId),
          apiGetIntegrityEvents(selectedServerId, {
            page,
            limit: 15,
            search: searchQuery,
          }),
        ]);
        if (sumRes) setSummary(sumRes);
        if (evRes?.events) {
          setEvents(evRes.events);
          setTotalPages(evRes.pagination?.totalPages || 1);
          setTotalCount(evRes.pagination?.totalCount || 0);
        }
      } catch {}
    };

    const interval = setInterval(silentPoll, 2500);
    return () => clearInterval(interval);
  }, [selectedServerId, page, searchQuery]);

  // Run Real Cryptographic Hash Chain Verification
  const handleVerify = async () => {
    if (!selectedServerId) return;
    setIsVerifying(true);
    setVerificationError(null);
    try {
      const res = await apiVerifyIntegrity(selectedServerId);
      setVerificationResult(res);
      setFindingsDialogOpen(true);
      fetchSummary(); // refresh summary status
    } catch (err) {
      setVerificationError(err.message || 'Chain verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Inspect Single Event Detail
  const handleInspectSequence = async (seq) => {
    if (!selectedServerId) return;
    setInspectLoading(true);
    try {
      const res = await apiGetIntegrityEvent(selectedServerId, seq);
      setInspectEvent(res.event);
    } catch (err) {
      console.error('Failed to inspect event record:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const truncateHash = (hash, len = 10) => {
    if (!hash || hash.length <= len * 2) return hash;
    return `${hash.slice(0, len)}...${hash.slice(-len)}`;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return ts;
    }
  };

  const selectedServer = servers.find((s) => s.serverId === selectedServerId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Integrity Explorer
                <Badge variant="default" className="font-mono text-xs bg-white text-zinc-950 font-bold">
                  SHA-256 Engine
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] border-emerald-800 bg-emerald-950/40 text-emerald-400 flex items-center gap-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync (2.5s)
                </Badge>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Append-only SHA-256 hash chains with RFC 8785 canonical serialization and mathematical tamper verification.
              </p>
            </div>
          </div>
        </div>

        {/* Server Selector & Verify Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-zinc-400" />
            <select
              value={selectedServerId}
              onChange={(e) => handleSelectServer(e.target.value)}
              disabled={serversLoading || servers.length === 0}
              className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white font-mono"
            >
              {servers.length === 0 ? (
                <option value="">No registered servers</option>
              ) : (
                servers.map((s) => (
                  <option key={s.serverId} value={s.serverId}>
                    {s.serverName} ({s.serverId.slice(0, 10)}...)
                  </option>
                ))
              )}
            </select>
          </div>

          <Button
            size="sm"
            onClick={handleVerify}
            disabled={isVerifying || !selectedServerId || summary?.totalEventsInChain === 0}
            className="h-9 px-4 text-xs font-bold bg-white hover:bg-zinc-200 text-zinc-950 cursor-pointer shadow-sm gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Verifying Chain...' : 'Verify Integrity'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/checkpoints?server=${selectedServerId}`)}
            className="h-9 px-3 text-xs font-semibold border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer shadow-sm gap-1.5"
            title="View smart contract checkpoints for this server"
          >
            <Link2 className="w-3.5 h-3.5 text-zinc-300" />
            Blockchain Registry
          </Button>
        </div>
      </div>

      {verificationError && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{verificationError}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVerificationError(null)}
            className="h-6 text-xs text-red-300 hover:text-white"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Real Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Tracked Server */}
        <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Target Server</span>
              <Server className="w-3.5 h-3.5 text-zinc-400" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-white mt-1 truncate">
              {summaryLoading ? (
                <Skeleton className="h-5 w-24 bg-zinc-800" />
              ) : summary?.serverName || selectedServer?.serverName || 'None'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs font-mono text-zinc-300">
            {selectedServerId ? selectedServerId : 'No server selected'}
          </CardContent>
        </Card>

        {/* Card 2: Total Events in Hash Chain */}
        <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Total Sealed Events</span>
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white mt-1 font-mono">
              {summaryLoading ? <Skeleton className="h-7 w-16 bg-zinc-800" /> : summary?.totalEventsInChain ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-zinc-400 font-medium">
            Append-only sequence #{summary?.chainHeadSequence ?? 0}
          </CardContent>
        </Card>

        {/* Card 3: Verification Status */}
        <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Chain Integrity (Phase 4)</span>
              {summary?.lastVerificationStatus === 'VERIFIED' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : summary?.lastVerificationStatus === 'TAMPERED' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </CardDescription>
            <div className="mt-1 flex items-center gap-2">
              {summaryLoading ? (
                <Skeleton className="h-6 w-20 bg-zinc-800" />
              ) : summary?.lastVerificationStatus === 'VERIFIED' ? (
                <Badge variant="success" className="font-mono text-xs px-2 py-0.5 font-bold">
                  VERIFIED
                </Badge>
              ) : summary?.lastVerificationStatus === 'TAMPERED' ? (
                <Badge variant="destructive" className="font-mono text-xs px-2 py-0.5 font-bold">
                  TAMPERED
                </Badge>
              ) : summary?.lastVerificationStatus === 'INCOMPLETE' ? (
                <Badge variant="warning" className="font-mono text-xs px-2 py-0.5 font-bold">
                  INCOMPLETE
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5 font-bold">
                  NOT VERIFIED
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-zinc-400 truncate">
            {summary?.lastVerifiedAt
              ? `Checked: ${formatTimestamp(summary.lastVerifiedAt)}`
              : 'Awaiting verification'}
          </CardContent>
        </Card>

        {/* Card 4: Blockchain Anchored Checkpoint */}
        <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 flex items-center justify-between">
              <span>On-Chain Anchor (Phase 5)</span>
              <Link2 className="w-3.5 h-3.5 text-zinc-400" />
            </CardDescription>
            <CardTitle className="text-sm font-mono text-zinc-100 mt-1 truncate font-bold">
              {(() => {
                const latestConf = checkpoints.find((c) => c.transactionStatus === 'CONFIRMED');
                return latestConf ? `#${latestConf.startSequence} → #${latestConf.endSequence}` : 'None Anchored';
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-zinc-400 flex items-center justify-between">
            {(() => {
              const latestConf = checkpoints.find((c) => c.transactionStatus === 'CONFIRMED');
              return latestConf ? (
                <>
                  <span className="text-emerald-400 font-bold font-mono">Block #{latestConf.blockNumber}</span>
                  <button
                    onClick={() => navigate(`/checkpoints?server=${selectedServerId}`)}
                    className="text-zinc-200 hover:text-white cursor-pointer ml-1 text-xs underline font-semibold"
                  >
                    View Registry
                  </button>
                </>
              ) : (
                <span>No checkpoints</span>
              );
            })()}
          </CardContent>
        </Card>

        {/* Card 5: Chain Head Hash */}
        <Card className="bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Chain Head Hash</span>
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
            </CardDescription>
            <CardTitle className="text-xs font-mono text-zinc-200 mt-1 truncate font-semibold">
              {summaryLoading ? (
                <Skeleton className="h-5 w-32 bg-zinc-800" />
              ) : (
                truncateHash(summary?.chainHeadHash, 8)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-zinc-400 flex items-center justify-between">
            <span>SHA-256 (64 hex)</span>
            {summary?.chainHeadHash && (
              <button
                onClick={() => handleCopy(summary.chainHeadHash, 'head')}
                className="text-zinc-400 hover:text-white cursor-pointer"
                title="Copy full hash"
              >
                {copiedHash === 'head' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Integrity Chain Events Table Card */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-white" />
                Sequential Chain Ledger ({searchQuery ? totalCount : (summary?.totalEventsInChain ?? totalCount)} Records)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Every event links to the preceding event's hash. The genesis entry (seq #1) starts at 64 zeros.
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <Input
                placeholder="Search event ID, source, message..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-8 bg-zinc-950 border-zinc-700 text-xs h-9 text-white placeholder:text-zinc-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {eventsError && (
            <div className="p-4 m-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{eventsError}</span>
            </div>
          )}

          {eventsLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full bg-zinc-800/80" />
              <Skeleton className="h-8 w-full bg-zinc-800/80" />
              <Skeleton className="h-8 w-full bg-zinc-800/80" />
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Layers className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-200">
                  No Integrity Records Recorded Yet
                </h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed font-normal">
                  {selectedServer
                    ? `Server ${selectedServer.serverName} has not ingested any log events yet. Start the background collector agent to begin generating the hash chain.`
                    : 'Please select a registered server above to inspect its cryptographic integrity chain.'}
                </p>
              </div>

              {selectedServer && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/servers/${selectedServer.serverId}`)}
                    className="text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:text-white cursor-pointer gap-1.5 font-semibold"
                  >
                    <Server className="w-3.5 h-3.5 text-zinc-300" />
                    Configure Server Collector
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs font-mono">
                <TableHeader className="bg-zinc-950/90 border-b border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-20 text-zinc-300 font-bold">Sequence</TableHead>
                    <TableHead className="w-32 text-zinc-300 font-bold">Event ID</TableHead>
                    <TableHead className="w-36 text-zinc-300 font-bold">Source</TableHead>
                    <TableHead className="min-w-[180px] text-zinc-300 font-bold">Message</TableHead>
                    <TableHead className="w-44 text-zinc-300 font-bold">Previous Hash</TableHead>
                    <TableHead className="w-44 text-zinc-300 font-bold">Event Hash</TableHead>
                    <TableHead className="w-32 text-zinc-300 font-bold">On-Chain Anchor</TableHead>
                    <TableHead className="w-20 text-right text-zinc-300 font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-800/60">
                  {events.map((ev) => {
                    const matchingCheckpoint = checkpoints.find(
                      (cp) => ev.sequenceNumber >= cp.startSequence && ev.sequenceNumber <= cp.endSequence
                    );

                    return (
                      <TableRow key={ev.sequenceNumber} className="border-zinc-800/60 hover:bg-zinc-800/40">
                        <TableCell className="font-bold text-white text-xs">
                          #{ev.sequenceNumber}
                        </TableCell>
                        <TableCell className="text-zinc-300 text-xs">
                          <span title={ev.eventId}>{truncateHash(ev.eventId, 6)}</span>
                        </TableCell>
                        <TableCell className="text-zinc-400 truncate max-w-[140px] text-xs">
                          {ev.source || 'syslog'}
                        </TableCell>
                        <TableCell className="text-zinc-200 font-sans truncate max-w-[260px] text-xs font-medium">
                          {ev.message}
                        </TableCell>
                        <TableCell className="text-zinc-400 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span title={ev.previousHash}>
                              {ev.previousHash === '0000000000000000000000000000000000000000000000000000000000000000'
                                ? 'GENESIS (0000...)'
                                : truncateHash(ev.previousHash, 6)}
                            </span>
                            <button
                              onClick={() => handleCopy(ev.previousHash, `prev_${ev.sequenceNumber}`)}
                              className="text-zinc-400 hover:text-white cursor-pointer"
                            >
                              {copiedHash === `prev_${ev.sequenceNumber}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-emerald-400 text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span title={ev.eventHash}>{truncateHash(ev.eventHash, 6)}</span>
                            <button
                              onClick={() => handleCopy(ev.eventHash, `curr_${ev.sequenceNumber}`)}
                              className="text-zinc-400 hover:text-white cursor-pointer"
                            >
                              {copiedHash === `curr_${ev.sequenceNumber}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {matchingCheckpoint ? (
                            <button
                              onClick={() => navigate(`/checkpoints?server=${selectedServerId}`)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-950/60 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/80 cursor-pointer"
                              title={`Anchored in Checkpoint #${matchingCheckpoint.checkpointId?.slice(0, 10)}... (Tx: ${matchingCheckpoint.transactionHash || 'Pending'})`}
                            >
                              <Link2 className="w-3 h-3 text-emerald-400" />
                              <span>Block #{matchingCheckpoint.blockNumber || 'Mined'}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-zinc-400 bg-zinc-950 border border-zinc-800">
                              Unanchored
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInspectSequence(ev.sequenceNumber)}
                            className="h-8 px-2 text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer font-semibold"
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination Bar */}
              <div className="p-3.5 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <div>
                  Showing {events.length} of {totalCount} events (Page {page} of {totalPages})
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 px-3 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer font-semibold"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Findings Dialog */}
      {verificationResult && (
        <Dialog open={findingsDialogOpen} onOpenChange={setFindingsDialogOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-2xl shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                {verificationResult.status === 'VERIFIED' ? (
                  <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : verificationResult.status === 'TAMPERED' ? (
                  <div className="p-2 rounded-xl bg-red-950 border border-red-800 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    Integrity Verification Result:
                    <Badge
                      variant={
                        verificationResult.status === 'VERIFIED'
                          ? 'success'
                          : verificationResult.status === 'TAMPERED'
                          ? 'destructive'
                          : 'warning'
                      }
                      className="font-mono text-xs px-2 py-0.5 font-bold"
                    >
                      {verificationResult.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                    Server: <strong className="text-zinc-200">{verificationResult.serverName}</strong> (
                    <code className="text-zinc-300 font-mono text-xs">
                      {verificationResult.serverId}
                    </code>
                    )
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Checked Scope Card */}
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Checked Sequence Range:</span>
                  <span className="font-mono text-white font-bold">
                    #{verificationResult.checkedRange?.fromSequence ?? 1} to #
                    {verificationResult.checkedRange?.toSequence ?? verificationResult.recordsChecked}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Total Records Examined:</span>
                  <span className="font-mono text-zinc-100 font-semibold">{verificationResult.recordsChecked}</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Verified Chain Head:</span>
                  <span className="font-mono text-emerald-400 text-xs truncate max-w-[320px] font-semibold">
                    {verificationResult.actualChainHead}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Verification Timestamp:</span>
                  <span className="text-zinc-200 font-mono">
                    {formatTimestamp(verificationResult.verifiedAt)}
                  </span>
                </div>
              </div>

              {/* Findings Section */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-200 text-xs">
                  Findings ({verificationResult.findings?.length ?? 0}):
                </h4>
                {verificationResult.findings?.length === 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      All SHA-256 event hashes and sequential previous-hash links matched perfectly. Zero tampering detected.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {verificationResult.findings.map((f, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          f.severity === 'CRITICAL'
                            ? 'bg-red-950/40 border-red-800/60 text-red-200'
                            : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>{f.type}</span>
                          {f.sequenceNumber && <span>Sequence #{f.sequenceNumber}</span>}
                        </div>
                        <p className="text-zinc-200">{f.message}</p>
                        {f.expected && (
                          <div className="text-xs font-mono text-zinc-400 break-all">
                            Expected: <span className="text-emerald-400">{f.expected}</span> | Actual:{' '}
                            <span className="text-red-400">{f.actual}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFindingsDialogOpen(false)}
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer font-semibold"
              >
                Close Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Inspect Single Event Canonical Envelope Modal */}
      {inspectEvent && (
        <Dialog open={!!inspectEvent} onOpenChange={() => setInspectEvent(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-zinc-300" />
                Sealed Integrity Record #{inspectEvent.sequenceNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                Event ID: <code className="text-zinc-200 font-mono font-semibold">{inspectEvent.eventId}</code>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-zinc-400 block text-[11px] font-sans">Hash Version:</span>
                  <div className="font-mono text-zinc-200 font-bold">{inspectEvent.hashVersion}</div>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px] font-sans">Received Timestamp:</span>
                  <div className="font-mono text-zinc-200">{formatTimestamp(inspectEvent.receivedAt)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 block text-[11px] font-sans">Previous Hash (H_prev):</span>
                  <div className="font-mono text-zinc-300 text-xs break-all p-2 bg-zinc-950 rounded-lg border border-zinc-800 mt-1 select-all">
                    {inspectEvent.previousHash}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-emerald-400 block text-[11px] font-sans font-semibold">Event Hash (H_curr):</span>
                  <div className="font-mono text-emerald-400 text-xs break-all p-2 bg-zinc-950 rounded-lg border border-zinc-800 mt-1 select-all font-bold">
                    {inspectEvent.eventHash}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-zinc-200">
                  Deterministic Canonical Payload (RFC 8785 JSON):
                </span>
                <pre className="mt-1.5 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 max-h-56 overflow-y-auto select-all">
                  {inspectEvent.canonicalPayload}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInspectEvent(null)}
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer font-semibold"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
