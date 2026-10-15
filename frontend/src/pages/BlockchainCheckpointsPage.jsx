import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  apiGetServers,
  apiGetBlockchainStatus,
  apiGetCheckpoints,
  apiGetCheckpoint,
  apiCreateCheckpoint,
  apiVerifyCheckpoint,
  apiGetIntegritySummary,
} from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Link2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Lock,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Zap,
} from 'lucide-react';

export default function BlockchainCheckpointsPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Servers
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(searchParams.get('server') || '');
  const [serversLoading, setServersLoading] = useState(true);

  // Blockchain RPC Status
  const [blockchainHealth, setBlockchainHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Server Integrity Summary (to know current chain head)
  const [serverSummary, setServerSummary] = useState(null);

  // Checkpoints List
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Anchor Modal
  const [isAnchorModalOpen, setIsAnchorModalOpen] = useState(false);
  const [startSeqInput, setStartSeqInput] = useState('');
  const [endSeqInput, setEndSeqInput] = useState('');
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState(null);

  // Verification Dialog
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationError, setVerificationError] = useState(null);

  // Envelope Inspector Dialog
  const [inspectCheckpoint, setInspectCheckpoint] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const isAdmin = user?.role === 'Admin';

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Fetch Servers
  const fetchServers = useCallback(async () => {
    try {
      setServersLoading(true);
      const res = await apiGetServers({ limit: 100 });
      const serverList = res.servers || [];
      setServers(serverList);

      if (serverList.length > 0) {
        const queryServer = searchParams.get('server');
        const matched = serverList.find((s) => s.serverId === queryServer);
        if (matched) {
          setSelectedServerId(matched.serverId);
        } else if (!selectedServerId) {
          setSelectedServerId(serverList[0].serverId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch servers for checkpoints:', err);
    } finally {
      setServersLoading(false);
    }
  }, [searchParams, selectedServerId]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // 2. Fetch Blockchain Health
  const fetchHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const res = await apiGetBlockchainStatus();
      setBlockchainHealth(res?.blockchain || res);
    } catch (err) {
      setBlockchainHealth({
        connected: false,
        status: 'UNAVAILABLE',
        message: err.message,
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 20000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // 3. Fetch Server Summary & Checkpoints
  const fetchServerData = useCallback(async (serverId, pageNum = 1) => {
    if (!serverId) return;

    try {
      setCheckpointsLoading(true);
      const [sumRes, cpRes] = await Promise.all([
        apiGetIntegritySummary(serverId).catch(() => null),
        apiGetCheckpoints(serverId, { page: pageNum, limit: 10 }).catch(() => ({ checkpoints: [] })),
      ]);

      if (sumRes) setServerSummary(sumRes);
      if (cpRes) {
        setCheckpoints(cpRes.checkpoints || []);
        setTotalPages(cpRes.pagination?.pages || 1);
        setTotalCount(cpRes.pagination?.total || 0);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Failed to fetch server checkpoints:', err);
    } finally {
      setCheckpointsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      fetchServerData(selectedServerId, 1);
    }
  }, [selectedServerId, fetchServerData]);

  const handleServerChange = (e) => {
    const nextId = e.target.value;
    setSelectedServerId(nextId);
    setSearchParams({ server: nextId });
  };

  // Open Anchor Modal with sensible defaults
  const handleOpenAnchorModal = () => {
    setAnchorError(null);
    const head = serverSummary?.summary?.chainHeadSequence || 0;
    
    // Find latest confirmed checkpoint to suggest next range
    const confirmedCps = checkpoints.filter((c) => c.transactionStatus === 'CONFIRMED');
    const latestConfirmedEnd = confirmedCps.length > 0 ? Math.max(...confirmedCps.map((c) => c.endSequence)) : 0;

    const suggestedStart = latestConfirmedEnd + 1;
    setStartSeqInput(suggestedStart <= head ? String(suggestedStart) : '1');
    setEndSeqInput(String(head > 0 ? head : 1));
    setIsAnchorModalOpen(true);
  };

  const handleAnchorSubmit = async (e) => {
    e.preventDefault();
    setAnchorError(null);
    const startSeq = parseInt(startSeqInput, 10);
    const endSeq = parseInt(endSeqInput, 10);

    if (isNaN(startSeq) || isNaN(endSeq) || startSeq <= 0 || endSeq < startSeq) {
      setAnchorError('Invalid range: startSequence must be ≥ 1 and endSequence must be ≥ startSequence.');
      return;
    }

    try {
      setIsAnchoring(true);
      const res = await apiCreateCheckpoint(selectedServerId, {
        startSequence: startSeq,
        endSequence: endSeq,
      });

      setIsAnchorModalOpen(false);
      // Refresh list
      fetchServerData(selectedServerId, 1);
      fetchHealth();
    } catch (err) {
      setAnchorError(err.message || 'Failed to submit checkpoint to blockchain.');
    } finally {
      setIsAnchoring(false);
    }
  };

  // Run On-Chain Verification
  const handleVerifyCheckpoint = async (checkpointId) => {
    setIsVerifyModalOpen(true);
    setIsVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);

    try {
      const res = await apiVerifyCheckpoint(selectedServerId, checkpointId);
      setVerificationResult(res);
    } catch (err) {
      setVerificationError(err.message || 'Verification failed unexpectedly.');
    } finally {
      setIsVerifying(false);
    }
  };

  const selectedServer = servers.find((s) => s.serverId === selectedServerId);
  const chainHead =
    serverSummary?.chainHeadSequence ??
    serverSummary?.summary?.chainHeadSequence ??
    selectedServer?.chainHeadSequence ??
    0;
  const confirmedCount = checkpoints.filter((c) => c.transactionStatus === 'CONFIRMED').length;
  const latestConfirmed = checkpoints.find((c) => c.transactionStatus === 'CONFIRMED');

  return (
    <div className="space-y-6" id="blockchain-checkpoints-page">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shadow-sm">
              <Link2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Blockchain Checkpoint Registry
            </h1>
            <Badge variant="outline" className="font-mono text-xs border-zinc-700 text-zinc-300">
              Phase 5
            </Badge>
          </div>
          <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
            Cryptographic state anchoring of contiguous SHA-256 hash chains onto smart contracts.
            Guarantees historical non-repudiation and detects retroactive database manipulation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              fetchHealth();
              if (selectedServerId) fetchServerData(selectedServerId, page);
            }}
            variant="outline"
            size="sm"
            className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs cursor-pointer h-9 px-3"
            disabled={healthLoading || checkpointsLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isAdmin ? (
            <Button
              onClick={handleOpenAnchorModal}
              size="sm"
              className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-sm cursor-pointer h-9 px-3"
              disabled={!selectedServerId || chainHead === 0}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 text-zinc-950" />
              Anchor Checkpoint
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Admin Role Required to Anchor</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Live Blockchain RPC Connection & Smart Contract Health Banner */}
      <Card className="border-zinc-800/80 bg-zinc-900/90 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status & Network */}
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full mt-1 sm:mt-0 shrink-0 ${
                  blockchainHealth?.status === 'READY'
                    ? 'bg-emerald-400 ring-4 ring-emerald-950/80'
                    : blockchainHealth?.status === 'UNAVAILABLE'
                    ? 'bg-red-400 ring-4 ring-red-950/80'
                    : 'bg-amber-400 ring-4 ring-amber-950/80'
                }`}
              />

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {blockchainHealth?.networkName || 'Ethereum Ledger'}
                  </span>
                  <Badge
                    variant={
                      blockchainHealth?.status === 'READY'
                        ? 'success'
                        : blockchainHealth?.status === 'UNAVAILABLE'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="font-mono text-[10px] py-0 font-semibold"
                  >
                    {blockchainHealth?.status || 'CONNECTING...'}
                  </Badge>
                  {blockchainHealth?.connectedChainId && (
                    <span className="text-xs text-zinc-400 font-mono">
                      Chain ID: {blockchainHealth.connectedChainId}
                    </span>
                  )}
                  {blockchainHealth?.latency !== undefined && (
                    <span className="text-xs text-emerald-400 font-mono font-medium">
                      • {blockchainHealth.latency}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs font-mono text-zinc-400">
                  <span>Contract:</span>
                  <span className="text-zinc-200 font-semibold">
                    {blockchainHealth?.contractAddress || '0x...'}
                  </span>
                  {blockchainHealth?.contractAddress && (
                    <button
                      onClick={() => copyToClipboard(blockchainHealth.contractAddress, 'contract')}
                      className="text-zinc-400 hover:text-white cursor-pointer ml-1"
                      title="Copy Contract Address"
                    >
                      {copiedId === 'contract' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Signer & Balance */}
            <div className="flex flex-wrap items-center gap-5 text-xs font-mono border-t lg:border-t-0 pt-3 lg:pt-0 border-zinc-800">
              {blockchainHealth?.signerAddress && (
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">Authorized Submitter</span>
                  <div className="flex items-center gap-1.5 text-zinc-200 mt-0.5">
                    <span className="font-medium">
                      {blockchainHealth.signerAddress.slice(0, 6)}...
                      {blockchainHealth.signerAddress.slice(-4)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(blockchainHealth.signerAddress, 'signer')}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                      title="Copy Signer"
                    >
                      {copiedId === 'signer' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {blockchainHealth?.signerBalanceEth && (
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">Submitter Gas</span>
                  <span className="text-emerald-400 font-bold mt-0.5">
                    {parseFloat(blockchainHealth.signerBalanceEth).toFixed(4)} ETH
                  </span>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Min Confirmations</span>
                <span className="text-zinc-200 font-medium mt-0.5">
                  {blockchainHealth?.requiredConfirmations || 1} Block
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Server Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-3">
          <label htmlFor="server-select" className="text-xs font-semibold text-zinc-300 whitespace-nowrap">
            Target Server:
          </label>
          <select
            id="server-select"
            value={selectedServerId}
            onChange={handleServerChange}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white font-mono min-w-[240px] sm:min-w-[280px]"
            disabled={serversLoading || servers.length === 0}
          >
            {servers.length === 0 ? (
              <option value="">No servers enrolled</option>
            ) : (
              servers.map((s) => (
                <option key={s.serverId} value={s.serverId}>
                  {s.serverName} ({s.hostname})
                </option>
              ))
            )}
          </select>
          {servers.length === 0 && (
            <Link
              to="/servers"
              className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium whitespace-nowrap"
            >
              + Enroll Server
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Chain Head:</span>
            <Badge variant="secondary" className="font-mono text-xs py-0.5 text-white font-bold bg-zinc-800 border border-zinc-700">
              #{chainHead}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <span>Confirmed Anchors:</span>
            <Badge variant="success" className="font-mono text-xs py-0.5">
              {confirmedCount}
            </Badge>
          </div>
        </div>
      </div>

      {/* 4. KPI Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-800/80 bg-zinc-900/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
              <span>Total Checkpoints</span>
              <Layers className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {totalCount}
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              {confirmedCount} Confirmed on-chain
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
              <span>Latest Anchored Range</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {latestConfirmed ? `#${latestConfirmed.startSequence} → #${latestConfirmed.endSequence}` : 'None'}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {latestConfirmed ? `${latestConfirmed.eventCount} sealed events` : 'No checkpoints anchored'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
              <span>Unanchored Events</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {latestConfirmed ? Math.max(0, chainHead - latestConfirmed.endSequence) : chainHead}
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Chain Head #{chainHead}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
              <span>Smart Contract State</span>
              <Cpu className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="text-sm font-bold text-white font-mono truncate mt-1">
              {latestConfirmed?.transactionHash ? (
                <span className="text-zinc-200">
                  {latestConfirmed.transactionHash.slice(0, 10)}...
                </span>
              ) : (
                'Synchronized'
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {latestConfirmed?.blockNumber ? `Block #${latestConfirmed.blockNumber}` : 'Local registry active'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 5. Checkpoints History Table */}
      <Card className="border-zinc-800/80 bg-zinc-900/90 shadow-sm">
        <CardHeader className="p-5 border-b border-zinc-800/80 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-zinc-300" />
              Cryptographic Checkpoint Commitments
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Append-only registry of domain-separated Merkle root commitments committed to the blockchain.
            </CardDescription>
          </div>

          <div className="text-xs font-mono text-zinc-400">
            {checkpoints.length} / {totalCount} records
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {checkpointsLoading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full bg-zinc-800" />
              <Skeleton className="h-10 w-full bg-zinc-800" />
              <Skeleton className="h-10 w-full bg-zinc-800" />
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
                <Link2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                No Checkpoints Anchored Yet
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                This server has not had its SHA-256 hash chains sealed to the blockchain registry.
                {isAdmin && chainHead > 0 && ' Click "Anchor Checkpoint" above to commit the current chain.'}
              </p>
              {isAdmin && chainHead > 0 && (
                <Button
                  onClick={handleOpenAnchorModal}
                  size="sm"
                  className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs cursor-pointer mt-2"
                >
                  Anchor Range #1 → #{chainHead}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sequence Range</TableHead>
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Checkpoint ID</TableHead>
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Root Commitment</TableHead>
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tx Hash / Block</TableHead>
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Timestamp</TableHead>
                    <TableHead className="text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkpoints.map((cp) => {
                    const statusVariant =
                      cp.transactionStatus === 'CONFIRMED'
                        ? 'success'
                        : cp.transactionStatus === 'SUBMITTED'
                        ? 'secondary'
                        : cp.transactionStatus === 'PENDING'
                        ? 'outline'
                        : 'destructive';

                    return (
                      <TableRow key={cp._id} className="border-zinc-800/80 hover:bg-zinc-850/50">
                        {/* Range */}
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1.5 text-white font-semibold">
                            <span>#{cp.startSequence}</span>
                            <ArrowRight className="w-3 h-3 text-zinc-500" />
                            <span>#{cp.endSequence}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {cp.eventCount} logs
                          </span>
                        </TableCell>

                        {/* Checkpoint ID */}
                        <TableCell className="font-mono text-xs text-zinc-300">
                          <div className="flex items-center gap-1">
                            <span>{cp.checkpointId.slice(0, 10)}...{cp.checkpointId.slice(-6)}</span>
                            <button
                              onClick={() => copyToClipboard(cp.checkpointId, cp.checkpointId)}
                              className="text-zinc-500 hover:text-white cursor-pointer ml-1"
                              title="Copy Checkpoint ID"
                            >
                              {copiedId === cp.checkpointId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Checkpoint Root */}
                        <TableCell className="font-mono text-xs text-zinc-200">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{cp.checkpointRoot.slice(0, 10)}...{cp.checkpointRoot.slice(-6)}</span>
                            <button
                              onClick={() => copyToClipboard(cp.checkpointRoot, `root-${cp._id}`)}
                              className="text-zinc-500 hover:text-white cursor-pointer ml-1"
                              title="Copy Checkpoint Root"
                            >
                              {copiedId === `root-${cp._id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={statusVariant} className="text-[10px] font-mono py-0 font-semibold">
                            {cp.transactionStatus}
                          </Badge>
                          {cp.confirmations > 0 && (
                            <span className="block text-[10px] font-mono text-zinc-400 mt-0.5">
                              {cp.confirmations} confs
                            </span>
                          )}
                        </TableCell>

                        {/* Tx Hash / Block */}
                        <TableCell className="font-mono text-xs text-zinc-400">
                          {cp.transactionHash ? (
                            <div>
                              <div className="flex items-center gap-1 text-zinc-200">
                                <span>{cp.transactionHash.slice(0, 8)}...</span>
                                <button
                                  onClick={() => copyToClipboard(cp.transactionHash, cp.transactionHash)}
                                  className="text-zinc-500 hover:text-white cursor-pointer"
                                  title="Copy Tx Hash"
                                >
                                  {copiedId === cp.transactionHash ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              <span className="text-[10px] text-zinc-400">
                                Block #{cp.blockNumber || 'Pending'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-500">Pending Broadcast</span>
                          )}
                        </TableCell>

                        {/* Timestamp */}
                        <TableCell className="text-xs text-zinc-300">
                          <span title={new Date(cp.createdAt).toISOString()}>
                            {new Date(cp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="block text-[10px] text-zinc-400">
                            {new Date(cp.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              onClick={() => handleVerifyCheckpoint(cp.checkpointId)}
                              variant="outline"
                              size="sm"
                              className="text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white cursor-pointer h-7 px-2.5 font-medium"
                              title="Verify against Blockchain smart contract"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                              Verify
                            </Button>

                            <Button
                              onClick={() => setInspectCheckpoint(cp)}
                              variant="outline"
                              size="sm"
                              className="text-xs border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white cursor-pointer h-7 px-2"
                              title="View full cryptographic envelope"
                            >
                              <FileCode className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => fetchServerData(selectedServerId, page - 1)}
                  disabled={page <= 1}
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-800 text-xs cursor-pointer text-zinc-300 hover:text-white"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  onClick={() => fetchServerData(selectedServerId, page + 1)}
                  disabled={page >= totalPages}
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-800 text-xs cursor-pointer text-zinc-300 hover:text-white"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Modal: Anchor New Checkpoint (Admin Only) */}
      <Dialog open={isAnchorModalOpen} onOpenChange={setIsAnchorModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-white" />
              Anchor Hash-Chain Checkpoint
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Submit a cryptographic commitment of sequential SHA-256 log events to the smart contract.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAnchorSubmit} className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Target Server:</span>
                <span className="text-white font-bold">{selectedServer?.serverName}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Server ID:</span>
                <span className="text-zinc-200 font-semibold">{selectedServerId}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Current Chain Head:</span>
                <span className="text-emerald-400 font-bold">#{chainHead}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startSeq" className="text-xs text-zinc-300">
                  Start Sequence *
                </Label>
                <Input
                  id="startSeq"
                  type="number"
                  min="1"
                  max={chainHead}
                  value={startSeqInput}
                  onChange={(e) => setStartSeqInput(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-xs font-mono text-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endSeq" className="text-xs text-zinc-300">
                  End Sequence *
                </Label>
                <Input
                  id="endSeq"
                  type="number"
                  min="1"
                  max={chainHead}
                  value={endSeqInput}
                  onChange={(e) => setEndSeqInput(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-xs font-mono text-white"
                  required
                />
              </div>
            </div>

            {/* Event Count Preview */}
            <div className="text-xs font-mono text-zinc-400 flex items-center justify-between px-1">
              <span>Events to seal:</span>
              <span className="text-white font-bold">
                {parseInt(endSeqInput, 10) >= parseInt(startSeqInput, 10)
                  ? parseInt(endSeqInput, 10) - parseInt(startSeqInput, 10) + 1
                  : 0}{' '}
                records
              </span>
            </div>

            {anchorError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{anchorError}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAnchorModalOpen(false)}
                className="border-zinc-800 text-xs cursor-pointer text-zinc-300 hover:text-white"
                disabled={isAnchoring}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs cursor-pointer"
                disabled={isAnchoring}
              >
                {isAnchoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-zinc-950" />
                    Broadcasting Transaction...
                  </>
                ) : (
                  'Commit to Smart Contract'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Modal: Verification Audit Report */}
      <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Independent On-Chain Verification Audit
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Cross-validating stored MongoDB log history against the immutable smart contract registry.
            </DialogDescription>
          </DialogHeader>

          {isVerifying ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-white animate-spin mx-auto" />
              <p className="text-xs font-mono text-zinc-300">
                Querying smart contract on blockchain & recomputing SHA-256 chain...
              </p>
            </div>
          ) : verificationError ? (
            <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400" />
                Verification Error
              </div>
              <p>{verificationError}</p>
            </div>
          ) : verificationResult ? (
            <div className="space-y-4 py-2">
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  verificationResult.status === 'VERIFIED'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    : verificationResult.status === 'MISMATCH'
                    ? 'bg-red-950/50 border-red-800 text-red-200'
                    : 'bg-amber-950/40 border-amber-800 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {verificationResult.status === 'VERIFIED' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : verificationResult.status === 'MISMATCH' ? (
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Audit Verdict: {verificationResult.status}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      {verificationResult.message}
                    </p>
                  </div>
                </div>

                <Badge
                  variant={
                    verificationResult.status === 'VERIFIED'
                      ? 'success'
                      : verificationResult.status === 'MISMATCH'
                      ? 'destructive'
                      : 'outline'
                  }
                  className="font-mono text-xs font-bold"
                >
                  {verificationResult.status}
                </Badge>
              </div>

              {/* Range & Event Count */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Sequence Range</span>
                  <span className="text-white font-bold">
                    #{verificationResult.startSequence ?? verificationResult.checkedRange?.startSequence ?? verificationResult.checkedRange?.fromSequence ?? 1} → #{verificationResult.endSequence ?? verificationResult.checkedRange?.endSequence ?? verificationResult.checkedRange?.toSequence ?? 1}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Events Evaluated</span>
                  <span className="text-white font-bold">
                    {verificationResult.eventCount ?? verificationResult.checkedRange?.eventCount ?? verificationResult.checkedRange?.recordCount ?? 0} records
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Anchor Block</span>
                  <span className="text-white font-bold">
                    #{verificationResult.onChain?.anchorBlockNumber || 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Match Flag</span>
                  <span
                    className={
                      verificationResult.match
                        ? 'text-emerald-400 font-bold'
                        : verificationResult.status === 'UNAVAILABLE'
                        ? 'text-amber-400 font-bold'
                        : verificationResult.status === 'UNANCHORED' || verificationResult.status === 'INCOMPLETE'
                        ? 'text-zinc-400 font-bold'
                        : 'text-red-400 font-bold'
                    }
                  >
                    {verificationResult.match
                      ? '100% IDENTICAL'
                      : verificationResult.status === 'UNAVAILABLE'
                      ? 'RPC OFFLINE'
                      : verificationResult.status === 'UNANCHORED'
                      ? 'NOT ON-CHAIN'
                      : verificationResult.status === 'INCOMPLETE'
                      ? 'INCOMPLETE RANGE'
                      : 'COLLISION / ALTERED'}
                  </span>
                </div>
              </div>

              {/* Cryptographic Root Comparison */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono text-xs">
                <h5 className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
                  Cryptographic Commitment Comparison
                </h5>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                    <span>SMART CONTRACT ON-CHAIN ROOT:</span>
                    <span>Immutable Source of Truth</span>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-medium break-all select-all">
                    {verificationResult.onChain?.checkpointRoot || 'Not recorded on contract'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                    <span>DATABASE RECOMPUTED LOCAL ROOT:</span>
                    <span>Rebuilt from MongoDB Hash Chain</span>
                  </div>
                  <div
                    className={`p-2.5 rounded border break-all select-all font-medium ${
                      verificationResult.match
                        ? 'bg-zinc-950 border-emerald-800/80 text-emerald-300'
                        : verificationResult.status === 'UNAVAILABLE'
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        : 'bg-red-950/30 border-red-800 text-red-300'
                    }`}
                  >
                    {verificationResult.recomputed?.recomputedRoot || 'Unable to recompute'}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Server Commitment:</span>
                  <span className="text-zinc-200 font-mono text-xs select-all">
                    {verificationResult.serverCommitment || verificationResult.audit?.serverCommitment || '...'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => setIsVerifyModalOpen(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs cursor-pointer"
            >
              Close Audit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Modal: Envelope Inspector */}
      <Dialog open={!!inspectCheckpoint} onOpenChange={() => setInspectCheckpoint(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-zinc-300" />
              Cryptographic Checkpoint Envelope
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Full signed JSON envelope committed to the MongoDB ledger and verified on-chain.
            </DialogDescription>
          </DialogHeader>

          {inspectCheckpoint && (
            <div className="space-y-4 py-2 font-mono text-xs">
              <div className="relative">
                <pre className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(inspectCheckpoint, null, 2)}
                </pre>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(inspectCheckpoint, null, 2), 'envelope')
                  }
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                  title="Copy JSON"
                >
                  {copiedId === 'envelope' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setInspectCheckpoint(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
