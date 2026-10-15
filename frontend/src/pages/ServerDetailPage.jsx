import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  apiGetServer,
  apiUpdateServer,
  apiDisableServer,
  apiDeleteServer,
  apiGenerateEnrollmentToken,
  apiRotateCredential,
  apiVerifyIntegrity,
  apiGetCheckpoints,
  apiVerifyCheckpoint,
  apiGetAlerts,
  apiAcknowledgeAlert,
  apiResolveAlert,
} from '@/utils/api';
import { EnrollmentBadge, ConnectionBadge } from '@/components/ServerStatusBadge';
import EnrollmentTokenDialog from '@/components/EnrollmentTokenDialog';
import ServerLogViewer from '@/components/ServerLogViewer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Server,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  Ban,
  Trash2,
  Edit,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Terminal,
  Activity,
  HardDrive,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Info,
  Hash,
  Copy,
  Check,
  ExternalLink,
  Play,
  RotateCw,
  Link2,
  Radio,
} from 'lucide-react';

export default function ServerDetailPage({ serverId: propServerId }) {
  const { id: paramId } = useParams();
  const location = useLocation();
  const pathnameMatch = location.pathname.match(/^\/servers\/([^/]+)/);
  const id = propServerId || paramId || (pathnameMatch ? pathnameMatch[1] : null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Enrollment token modal state
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [activeTokenData, setActiveTokenData] = useState(null);

  // Disable server dialog state
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // Delete server dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit metadata dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    serverName: '',
    hostname: '',
    os: 'Linux',
    environment: 'Production',
    description: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  // Integrity verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Checkpoints state
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);
  const [verifyingCheckpointId, setVerifyingCheckpointId] = useState(null);

  // Alerts state
  const [serverAlerts, setServerAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const isAdmin = user?.role === 'Admin';

  const fetchServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetServer(id);
      setServer(res.server);
      setEditFormData({
        serverName: res.server.serverName,
        hostname: res.server.hostname,
        os: res.server.os,
        environment: res.server.environment,
        description: res.server.description || '',
      });
    } catch (err) {
      setError(err.message || 'Failed to retrieve server details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  // Fetch Checkpoints for this server
  const fetchCheckpoints = useCallback(async () => {
    if (!server?.serverId) return;
    setCheckpointsLoading(true);
    try {
      const res = await apiGetCheckpoints(server.serverId);
      setCheckpoints(res.checkpoints || []);
    } catch (err) {
      console.error('Failed to load server checkpoints:', err);
    } finally {
      setCheckpointsLoading(false);
    }
  }, [server?.serverId]);

  // Fetch Alerts for this server
  const fetchAlerts = useCallback(async () => {
    if (!server?.serverId) return;
    setAlertsLoading(true);
    try {
      const res = await apiGetAlerts({ serverId: server.serverId });
      setServerAlerts(res.alerts || []);
    } catch (err) {
      console.error('Failed to load server alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, [server?.serverId]);

  useEffect(() => {
    if (activeTab === 'blockchain') {
      fetchCheckpoints();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    }
  }, [activeTab, fetchCheckpoints, fetchAlerts]);

  // Handle Token Generation
  const handleGenerateToken = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiGenerateEnrollmentToken(server.serverId);
      setActiveTokenData({
        enrollmentToken: res.enrollmentToken,
        serverId: res.serverId,
        serverName: res.serverName,
        expiresAt: res.expiresAt,
      });
      setTokenModalOpen(true);
      fetchServer();
    } catch (err) {
      setActionError(err.message || 'Failed to generate enrollment token.');
    }
  };

  // Handle Credential Rotation
  const handleRotateCredential = async () => {
    if (!window.confirm('Are you sure you want to rotate collector credentials? The active daemon will disconnect until re-enrolled with the new token.')) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiRotateCredential(server.serverId);
      setActiveTokenData({
        enrollmentToken: res.enrollmentToken,
        serverId: server.serverId,
        serverName: server.serverName,
        expiresAt: res.expiresAt,
      });
      setTokenModalOpen(true);
      setActionSuccess('Collector credentials rotated and previous secret revoked.');
      fetchServer();
    } catch (err) {
      setActionError(err.message || 'Failed to rotate collector credentials.');
    }
  };

  // Handle Server Disablement
  const handleConfirmDisable = async () => {
    setIsDisabling(true);
    setActionError(null);
    try {
      await apiDisableServer(server.serverId);
      setDisableDialogOpen(false);
      setActionSuccess('Server disabled and all collector credentials permanently revoked.');
      fetchServer();
    } catch (err) {
      setActionError(err.message || 'Failed to disable server.');
    } finally {
      setIsDisabling(false);
    }
  };

  // Handle Server Deletion
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setActionError(null);
    try {
      await apiDeleteServer(server.serverId);
      navigate('/servers');
    } catch (err) {
      setActionError(err.message || 'Failed to delete server.');
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Handle Metadata Update
  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    setIsEditing(true);
    setActionError(null);
    try {
      const res = await apiUpdateServer(server.serverId, editFormData);
      setServer(res.server);
      setEditDialogOpen(false);
      setActionSuccess('Server metadata updated successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to update server metadata.');
    } finally {
      setIsEditing(false);
    }
  };

  // Handle Integrity Verification
  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    setActionError(null);
    setActionSuccess(null);
    setVerifyResult(null);
    try {
      const res = await apiVerifyIntegrity(server.serverId);
      setVerifyResult(res);
      await fetchServer();
      if (res.status === 'VERIFIED') {
        setActionSuccess(`Cryptographic chain verified (${res.checkedCount} records checked, 0 tampering detected).`);
      } else if (res.status === 'TAMPERED') {
        setActionError(`Tamper-evident violation detected! ${res.tamperedCount} corrupted record(s) identified.`);
      } else if (res.status === 'INCOMPLETE') {
        setActionError('Chain sequence incomplete or gap detected in event history.');
      }
    } catch (err) {
      setActionError(err.message || 'Failed to verify cryptographic integrity chain.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Checkpoint On-Chain Verification
  const handleVerifyCheckpoint = async (checkpointId) => {
    setVerifyingCheckpointId(checkpointId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiVerifyCheckpoint(server.serverId, checkpointId);
      if (res.status === 'VERIFIED') {
        setActionSuccess(`On-chain checkpoint ${checkpointId.slice(0, 10)}... mathematically verified on Ethereum registry.`);
      } else {
        setActionError(`On-chain checkpoint verification returned verdict: ${res.status}.`);
      }
      fetchCheckpoints();
    } catch (err) {
      setActionError(err.message || 'On-chain checkpoint verification failed.');
    } finally {
      setVerifyingCheckpointId(null);
    }
  };

  // Alert Actions
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      window.dispatchEvent(new CustomEvent('hashvault:alert-action', { detail: { alertId, action: 'ACKNOWLEDGE' } }));
      setAlerts((prev) =>
        prev.map((a) => (a.alertId === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a))
      );
      if (selectedAlert?.alertId === alertId) {
        setSelectedAlert((prev) => ({ ...prev, status: 'ACKNOWLEDGED' }));
      }
      await apiAcknowledgeAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolveAlert = async (alertId) => {
    setIsResolving(true);
    try {
      window.dispatchEvent(new CustomEvent('hashvault:alert-action', { detail: { alertId, action: 'RESOLVE' } }));
      setAlerts((prev) =>
        prev.map((a) => (a.alertId === alertId ? { ...a, status: 'RESOLVED', resolutionNotes } : a))
      );
      await apiResolveAlert(alertId, { resolutionNotes });
      setResolutionNotes('');
      setSelectedAlert(null);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCopyHash = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl bg-zinc-800" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 bg-zinc-800" />
            <Skeleton className="h-4 w-32 bg-zinc-800" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl bg-zinc-800" />
          <Skeleton className="h-64 rounded-xl bg-zinc-800 col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/servers')}
          className="text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Server Fleet
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Error Loading Server</AlertTitle>
          <AlertDescription className="text-xs">{error || 'Server record could not be found.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/servers')}
            className="text-xs text-zinc-400 hover:text-white p-1.5 h-auto rounded-lg hover:bg-zinc-850 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {server.serverName}
              </h1>
              <EnrollmentBadge status={server.enrollmentStatus} />
              <Badge
                variant={
                  server.collectorHealth === 'ONLINE'
                    ? 'success'
                    : server.collectorHealth === 'STALE'
                    ? 'warning'
                    : server.collectorHealth === 'OFFLINE'
                    ? 'destructive'
                    : 'outline'
                }
                className="font-mono text-[10px] font-semibold"
              >
                {server.collectorHealth || server.connectionStatus}
              </Badge>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              ID: <span className="text-zinc-200 font-semibold">{server.serverId}</span> • Host:{' '}
              <span className="text-zinc-300">{server.hostname}</span> ({server.environment})
            </p>
          </div>
        </div>

        {/* Action Buttons for Authorized Admins */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && server.enrollmentStatus !== 'DISABLED' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
                className="text-xs h-8 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer gap-1.5"
              >
                <Edit className="w-3.5 h-3.5 text-zinc-300" />
                Edit Metadata
              </Button>

              <Button
                size="sm"
                onClick={handleGenerateToken}
                className="text-xs h-8 bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer gap-1.5 shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5 text-zinc-950" />
                Generate Token
              </Button>

              {server.enrollmentStatus === 'ENROLLED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRotateCredential}
                  className="text-xs h-8 border-amber-800/80 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 cursor-pointer gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  Rotate Credential
                </Button>
              )}

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDisableDialogOpen(true)}
                className="text-xs h-8 cursor-pointer gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                Disable Node
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-xs h-8 border-red-900/60 bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 cursor-pointer gap-1.5 font-semibold"
                id="btn-delete-server"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Server
              </Button>
            </>
          )}

          {server.enrollmentStatus === 'DISABLED' && (
            <Badge variant="destructive" className="font-mono text-xs py-1 px-3">
              Server Decommissioned
            </Badge>
          )}
        </div>
      </div>

      {/* Action Notification Banners */}
      {actionSuccess && (
        <Alert variant="success" className="py-2.5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Error</AlertTitle>
          <AlertDescription className="text-xs">{actionError}</AlertDescription>
        </Alert>
      )}

      {/* 5 Distinct Server Operational Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 text-xs cursor-pointer">
            <HardDrive className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 text-xs cursor-pointer">
            <Terminal className="w-3.5 h-3.5" />
            Logs Explorer
          </TabsTrigger>
          <TabsTrigger value="integrity" className="gap-2 text-xs cursor-pointer">
            <ShieldCheck className="w-3.5 h-3.5" />
            SHA-256 Hash Chain
          </TabsTrigger>
          <TabsTrigger value="blockchain" className="gap-2 text-xs cursor-pointer">
            <Link2 className="w-3.5 h-3.5" />
            Blockchain Registry
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 text-xs cursor-pointer">
            <ShieldAlert className="w-3.5 h-3.5" />
            Security Alerts
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Host Identity & Specifications */}
            <Card className="bg-zinc-900/90 border-zinc-800/80 text-zinc-100 shadow-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/80">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <HardDrive className="w-4 h-4 text-zinc-300" />
                  Host Specifications
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Node identity and fleet deployment parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Server ID:</span>
                  <span className="font-mono text-zinc-200 font-semibold">{server.serverId}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Host FQDN:</span>
                  <span className="font-mono text-zinc-200">{server.hostname}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Operating System:</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">{server.os}</Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Environment:</span>
                  <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 text-zinc-300">{server.environment}</Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Registered On:</span>
                  <span className="font-mono text-zinc-300">{new Date(server.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-400 font-medium">Description:</span>
                  <span className="text-zinc-300 truncate max-w-[180px]">{server.description || 'None provided'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Collector Health & Telemetry State */}
            <Card className="bg-zinc-900/90 border-zinc-800/80 text-zinc-100 shadow-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/80">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  Collector Health &amp; Heartbeats
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Live daemon status calculated from physical heartbeat pings
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Evaluated Health:</span>
                    <span className="text-base font-bold font-mono text-white mt-0.5 block">{server.collectorHealth || server.connectionStatus}</span>
                  </div>
                  <Badge
                    variant={
                      server.collectorHealth === 'ONLINE'
                        ? 'success'
                        : server.collectorHealth === 'STALE'
                        ? 'warning'
                        : server.collectorHealth === 'OFFLINE'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="font-mono text-xs font-semibold"
                  >
                    {server.collectorHealth || server.connectionStatus}
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Last Heartbeat Ping:</span>
                  {server.lastHeartbeatAt ? (
                    <span className="font-mono text-zinc-200">
                      {new Date(server.lastHeartbeatAt).toLocaleTimeString()} ({server.lastHeartbeatAgeSeconds ?? 0}s ago)
                    </span>
                  ) : (
                    <span className="text-zinc-500 italic">No heartbeats received</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-400 font-medium">Chain Head Sequence:</span>
                  <span className="font-mono text-white font-bold">#{server.chainHeadSequence || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Credential Security & Isolation */}
            <Card className="bg-zinc-900/90 border-zinc-800/80 text-zinc-100 shadow-sm">
              <CardHeader className="pb-3 border-b border-zinc-800/80">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <Lock className="w-4 h-4 text-zinc-300" />
                  Collector Credentials
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Cryptographic single-use token and secret rotation
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Credential Version:</span>
                  <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 text-zinc-300">v{server.credentialVersion || 1}</Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">Enrollment State:</span>
                  <span className="font-mono text-zinc-200 font-semibold">{server.enrollmentStatus}</span>
                </div>
                <p className="text-xs text-zinc-400 pt-1 leading-relaxed">
                  Raw collector secrets are never persisted in MongoDB. Only SHA-256 hashes are verified during HTTP authentication.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Logs */}
        <TabsContent value="logs" className="space-y-6 mt-0">
          <ServerLogViewer serverId={server.serverId} serverName={server.serverName} />
        </TabsContent>

        {/* Tab 3: Integrity (SHA-256 Hash Chain) */}
        <TabsContent value="integrity" className="space-y-6 mt-0">
          <Card className="border-zinc-800/80 bg-zinc-900/90 shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-4 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Sequential SHA-256 Hash Chain
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Deterministic RFC 8785 canonical serialization and append-only cryptographic linking.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleVerifyIntegrity}
                  disabled={isVerifying}
                  className="text-xs h-8 bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer gap-1.5 shadow-sm"
                >
                  <Play className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                  {isVerifying ? 'Verifying Chain...' : 'Run Integrity Verification'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/integrity?server=${server.serverId}`)}
                  className="text-xs h-8 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                >
                  Open in Explorer
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Integrity Verdict</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {server.lastVerificationStatus || 'UNVERIFIED'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Chain Head Sequence</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    #{server.chainHeadSequence || 0}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Last Verified At</span>
                  <div className="text-xs font-mono text-zinc-300 mt-1">
                    {server.lastVerifiedAt ? new Date(server.lastVerifiedAt).toLocaleString() : 'Not verified yet'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-semibold">Chain Head Digest (SHA-256):</span>
                  <button
                    onClick={() => handleCopyHash(server.chainHeadHash)}
                    className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy Hash
                  </button>
                </div>
                <code className="text-zinc-200 font-mono text-xs break-all block bg-zinc-900 p-3 rounded-lg border border-zinc-800 font-medium">
                  {server.chainHeadHash || '0000000000000000000000000000000000000000000000000000000000000000'}
                </code>
              </div>

              {verifyResult && (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Latest Verification Run Result</span>
                    <Badge variant={verifyResult.status === 'VERIFIED' ? 'success' : 'destructive'} className="font-mono text-xs font-bold">
                      {verifyResult.status}
                    </Badge>
                  </div>
                  <p className="text-zinc-300 text-xs">
                    Checked {verifyResult.checkedCount} records (Sequence #{verifyResult.checkedRange?.fromSequence} → #{verifyResult.checkedRange?.toSequence}).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Blockchain (Checkpoints) */}
        <TabsContent value="blockchain" className="space-y-6 mt-0">
          <Card className="border-zinc-800/80 bg-zinc-900/90 shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-4 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-zinc-300" />
                  On-Chain Checkpoint Commitments
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Decentralized Merkle root registry anchors guaranteeing historical immutability.
                </CardDescription>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/checkpoints')}
                className="text-xs h-8 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer"
              >
                Open Blockchain Registry
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {checkpointsLoading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-8 w-full bg-zinc-800" />
                  <Skeleton className="h-8 w-full bg-zinc-800" />
                </div>
              ) : checkpoints.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-400">
                  No blockchain checkpoints anchored for this server yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-zinc-950 border-b border-zinc-800">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Checkpoint ID</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Sequence Range</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Status</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Block #</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Tx Hash</TableHead>
                        <TableHead className="text-right text-zinc-400 font-semibold uppercase tracking-wider text-xs">Verification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-800/40">
                      {checkpoints.map((cp) => (
                        <TableRow key={cp.checkpointId} className="border-zinc-800/50 hover:bg-zinc-850/50">
                          <TableCell className="font-mono text-zinc-200 font-medium">
                            {cp.checkpointId.slice(0, 12)}...
                          </TableCell>
                          <TableCell className="font-mono text-white font-semibold">
                            #{cp.startSequence} → #{cp.endSequence}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={cp.transactionStatus === 'CONFIRMED' ? 'success' : 'outline'}
                              className="font-mono text-[10px] font-semibold"
                            >
                              {cp.transactionStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-zinc-300">
                            {cp.blockNumber ?? '—'}
                          </TableCell>
                          <TableCell className="font-mono text-zinc-400 truncate max-w-[120px]" title={cp.transactionHash}>
                            {cp.transactionHash ? `${cp.transactionHash.slice(0, 10)}...` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerifyCheckpoint(cp.checkpointId)}
                              disabled={verifyingCheckpointId === cp.checkpointId}
                              className="h-7 text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white cursor-pointer font-medium"
                            >
                              {verifyingCheckpointId === cp.checkpointId ? 'Auditing...' : 'Verify On-Chain'}
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
        </TabsContent>

        {/* Tab 5: Alerts */}
        <TabsContent value="alerts" className="space-y-6 mt-0">
          <Card className="border-zinc-800/80 bg-zinc-900/90 shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-4 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Host Security Incidents &amp; Alerts
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Deduplicated alerts detected specifically on this host node.
                </CardDescription>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/alerts')}
                className="text-xs h-8 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer"
              >
                Open Central Alerts Center
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {alertsLoading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-8 w-full bg-zinc-800" />
                  <Skeleton className="h-8 w-full bg-zinc-800" />
                </div>
              ) : serverAlerts.length === 0 ? (
                <div className="p-12 text-center text-xs text-emerald-400 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <span className="font-medium">No open or active security alerts for this host.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-zinc-950 border-b border-zinc-800">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Severity</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Title</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Detected At</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Status</TableHead>
                        <TableHead className="text-right text-zinc-400 font-semibold uppercase tracking-wider text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-800/40">
                      {serverAlerts.map((alt) => (
                        <TableRow key={alt.alertId} className="border-zinc-800/50 hover:bg-zinc-850/50">
                          <TableCell>
                            <Badge
                              variant={
                                alt.severity === 'CRITICAL'
                                  ? 'destructive'
                                  : alt.severity === 'HIGH'
                                  ? 'warning'
                                  : 'secondary'
                              }
                              className="font-mono text-[10px] font-semibold"
                            >
                              {alt.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-white">
                            <div>{alt.title}</div>
                            <div className="text-xs text-zinc-400 line-clamp-1">{alt.description}</div>
                          </TableCell>
                          <TableCell className="font-mono text-zinc-400 text-xs">
                            {new Date(alt.detectedAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={alt.status === 'OPEN' ? 'warning' : 'outline'}
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
                                className="h-7 text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white cursor-pointer font-medium whitespace-nowrap shrink-0"
                              >
                                Investigate
                              </Button>
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
        </TabsContent>
      </Tabs>

      {/* Edit Metadata Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Edit Server Metadata</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Update editable display metadata for {server.serverName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMetadata} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Server Name</Label>
              <Input
                value={editFormData.serverName}
                onChange={(e) => setEditFormData({ ...editFormData, serverName: e.target.value })}
                className="bg-zinc-900 border-zinc-700 text-xs h-9 text-white focus:border-white"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Hostname / FQDN</Label>
              <Input
                value={editFormData.hostname}
                onChange={(e) => setEditFormData({ ...editFormData, hostname: e.target.value })}
                className="bg-zinc-900 border-zinc-700 text-xs h-9 text-white focus:border-white"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Environment</Label>
              <select
                value={editFormData.environment}
                onChange={(e) => setEditFormData({ ...editFormData, environment: e.target.value })}
                className="w-full h-9 rounded-md bg-zinc-900 border border-zinc-700 px-3 text-xs text-white focus:outline-none focus:border-white"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Description</Label>
              <Input
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="bg-zinc-900 border-zinc-700 text-xs h-9 text-white focus:border-white"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
                className="text-xs bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isEditing}
                className="text-xs bg-white hover:bg-zinc-200 text-zinc-950 font-bold"
              >
                {isEditing ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Disable Node Alert Dialog */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Disable Host Server?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed">
              This will permanently revoke all collector credentials for <strong className="text-white">{server.serverName}</strong>. Telemetry ingestion from this daemon will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              disabled={isDisabling}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
            >
              {isDisabling ? 'Disabling...' : 'Confirm Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Server Alert Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4 text-red-400" />
              <AlertDialogTitle className="text-white">Delete Host Server from Fleet?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed">
              This will permanently delete <strong className="text-white">{server.serverName}</strong> (
              <code className="text-zinc-300 font-mono">{server.serverId}</code>) from the fleet inventory. All associated collector enrollment tokens and credentials will be permanently erased.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              id="btn-confirm-delete-server"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enrollment Token Dialog */}
      {tokenModalOpen && activeTokenData && (
        <EnrollmentTokenDialog
          open={tokenModalOpen}
          onOpenChange={setTokenModalOpen}
          tokenData={activeTokenData}
        />
      )}

      {/* Alert Investigation & Resolution Dialog */}
      {selectedAlert && (
        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <div>
                  <DialogTitle className="text-base font-bold text-white">{selectedAlert.title}</DialogTitle>
                  <DialogDescription className="text-xs font-mono text-zinc-400">
                    Alert ID: <code className="text-zinc-300">{selectedAlert.alertId}</code>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 leading-relaxed">
                {selectedAlert.description}
              </p>

              {selectedAlert.evidenceMetadata && (
                <div>
                  <span className="text-zinc-300 font-semibold block mb-1">Cryptographic Evidence:</span>
                  <pre className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 max-h-36 overflow-y-auto leading-relaxed">
                    {JSON.stringify(selectedAlert.evidenceMetadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAlert.status !== 'RESOLVED' && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <span className="text-zinc-300 font-semibold">Resolution Notes:</span>
                  <Input
                    placeholder="Enter root cause diagnosis or resolution notes..."
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
                  className="text-xs border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 cursor-pointer"
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
