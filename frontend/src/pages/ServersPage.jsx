import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiGetServers, apiDeleteServer } from '@/utils/api';
import AddServerDialog from '@/components/AddServerDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  HardDrive,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

export default function ServersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [osFilter, setOsFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const isAdmin = user?.role === 'Admin';

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetServers({
        search,
        os: osFilter,
        environment: envFilter,
        page,
        limit: 10,
      });

      let serverList = res.servers || [];

      // Filter by collectorHealth on client if set
      if (healthFilter !== 'all') {
        serverList = serverList.filter((s) => s.collectorHealth === healthFilter);
      }

      setServers(serverList);
      setPagination(
        res.pagination || { total: serverList.length, totalPages: 1, limit: 10 }
      );
    } catch (err) {
      setError(err.message || 'Failed to load servers from fleet inventory.');
    } finally {
      setLoading(false);
    }
  }, [search, osFilter, envFilter, healthFilter, page]);

  useEffect(() => {
    fetchServers();

    // Real-time silent background poll every 4 seconds
    const interval = setInterval(() => {
      apiGetServers({
        search,
        os: osFilter,
        environment: envFilter,
        page,
        limit: 10,
      }).then((res) => {
        let serverList = res?.servers || [];
        if (healthFilter !== 'all') {
          serverList = serverList.filter((s) => s.collectorHealth === healthFilter);
        }
        setServers(serverList);
        setPagination(
          res?.pagination || { total: serverList.length, totalPages: 1, limit: 10 }
        );
      }).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchServers, search, osFilter, envFilter, healthFilter, page]);

  const handleDeleteClick = (srv, e) => {
    e.stopPropagation();
    setServerToDelete(srv);
    setActionError(null);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!serverToDelete) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await apiDeleteServer(serverToDelete.serverId);
      setDeleteDialogOpen(false);
      setActionSuccess(`Server "${serverToDelete.serverName}" was permanently removed from your fleet.`);
      setServerToDelete(null);
      fetchServers();
    } catch (err) {
      setActionError(err.message || 'Failed to delete server from fleet.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchServers();
  };

  const getHealthBadge = (health) => {
    switch (health) {
      case 'ONLINE':
        return (
          <Badge variant="success" className="font-mono text-xs gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </Badge>
        );
      case 'STALE':
        return (
          <Badge variant="warning" className="font-mono text-xs gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            STALE
          </Badge>
        );
      case 'OFFLINE':
        return (
          <Badge variant="destructive" className="font-mono text-xs gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            OFFLINE
          </Badge>
        );
      case 'DISABLED':
        return (
          <Badge variant="outline" className="font-mono text-xs text-zinc-400 border-zinc-700">
            DISABLED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs text-zinc-400 border-zinc-700">
            UNKNOWN
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Server Fleet Inventory
                <Badge variant="default" className="font-mono text-xs py-0.5 bg-white text-zinc-950 font-bold">
                  {pagination.total} Nodes
                </Badge>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Register, provision secure single-use enrollment tokens, and monitor collector health states.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchServers}
            disabled={loading}
            className="text-xs h-9 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 cursor-pointer gap-1.5 font-medium"
            title="Refresh Fleet Inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-white' : ''}`} />
            Refresh
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="text-xs h-9 bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer gap-1.5 shadow-sm"
              id="add-server-button"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="md:col-span-4 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or hostname..."
            className="pl-8 bg-zinc-950 border-zinc-700 text-xs h-9 text-white placeholder:text-zinc-500"
            id="server-search-input"
          />
        </form>

        {/* Collector Health Filter */}
        <div className="md:col-span-3 flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-semibold whitespace-nowrap">Health:</span>
          <select
            value={healthFilter}
            onChange={(e) => {
              setHealthFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
            id="filter-health"
          >
            <option value="all">All Health States</option>
            <option value="ONLINE">Online</option>
            <option value="STALE">Stale</option>
            <option value="OFFLINE">Offline</option>
            <option value="DISABLED">Disabled</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>

        {/* Environment Filter */}
        <div className="md:col-span-3 flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-semibold whitespace-nowrap">Env:</span>
          <select
            value={envFilter}
            onChange={(e) => {
              setEnvFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
            id="filter-environment"
          >
            <option value="all">All Environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
          </select>
        </div>

        {/* OS Filter */}
        <div className="md:col-span-2 flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-semibold whitespace-nowrap">OS:</span>
          <select
            value={osFilter}
            onChange={(e) => {
              setOsFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
            id="filter-os"
          >
            <option value="all">All OS</option>
            <option value="Linux">Linux</option>
            <option value="Windows">Windows</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold">Error Loading Inventory</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {actionSuccess && (
        <Alert variant="success" className="bg-emerald-950/40 border-emerald-800 text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertTitle className="text-xs font-bold">Fleet Updated</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold">Action Failed</AlertTitle>
          <AlertDescription className="text-xs">{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Servers Table Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <Table>
          <TableHeader className="bg-zinc-950/90 border-b border-zinc-800">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-300 font-bold text-xs">Server / Host</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">Collector Health</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">Environment</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">OS</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">Last Heartbeat</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">Chain Head</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">Integrity</TableHead>
              <TableHead className="text-right text-zinc-300 font-bold text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-28 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-zinc-800" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto bg-zinc-800" /></TableCell>
                </TableRow>
              ))
            ) : servers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-300">
                      <HardDrive className="w-6 h-6 text-zinc-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">No Fleet Servers Found</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                      {search || osFilter !== 'all' || envFilter !== 'all' || healthFilter !== 'all'
                        ? 'No servers match your current search and filter criteria.'
                        : 'Your fleet inventory is empty. Register your first host server to begin collector enrollment.'}
                    </p>
                    {isAdmin && (
                      <Button
                        size="sm"
                        onClick={() => setAddDialogOpen(true)}
                        className="text-xs bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer gap-1.5 mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Register First Server
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              servers.map((srv) => (
                <TableRow
                  key={srv.serverId}
                  className="cursor-pointer hover:bg-zinc-800/50 border-zinc-800/60"
                  onClick={() => navigate(`/servers/${srv.serverId}`)}
                >
                  <TableCell className="font-medium text-white">
                    <div className="font-bold text-zinc-100">{srv.serverName}</div>
                    <div className="text-xs font-mono text-zinc-400">{srv.hostname}</div>
                  </TableCell>

                  <TableCell>{getHealthBadge(srv.collectorHealth)}</TableCell>

                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs border-zinc-700 text-zinc-300">
                      {srv.environment}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs text-zinc-300">
                      {srv.os}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-zinc-300 text-xs font-mono">
                    {srv.lastHeartbeatAgeSeconds !== null ? (
                      <span className="text-zinc-200 font-medium">{srv.lastHeartbeatAgeSeconds}s ago</span>
                    ) : (
                      <span className="text-zinc-500 italic">None</span>
                    )}
                  </TableCell>

                  <TableCell className="font-mono text-white font-bold text-xs">
                    #{srv.chainHeadSequence || 0}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        srv.lastVerificationStatus === 'VERIFIED'
                          ? 'success'
                          : srv.lastVerificationStatus === 'TAMPERED'
                          ? 'destructive'
                          : 'outline'
                      }
                      className="font-mono text-xs font-semibold"
                    >
                      {srv.lastVerificationStatus || 'NOT_VERIFIED'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/servers/${srv.serverId}`)}
                        className="text-xs h-8 px-3 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 cursor-pointer gap-1.5 font-semibold"
                      >
                        Details
                        <ExternalLink className="w-3 h-3 text-zinc-400" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleDeleteClick(srv, e)}
                          className="text-xs h-8 px-2.5 border-red-900/60 bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 cursor-pointer gap-1 font-semibold"
                          title={`Delete ${srv.serverName} from fleet`}
                          id={`btn-delete-server-${srv.serverId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-3.5 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between text-xs text-zinc-400">
            <div>
              Showing page <strong className="text-white font-mono">{pagination.page}</strong> of{' '}
              <strong className="text-white font-mono">{pagination.totalPages}</strong> ({pagination.total} servers)
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
                Prev
              </Button>

              <span className="font-mono text-white px-2 font-bold">{page} / {pagination.totalPages}</span>

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
      </div>

      {/* Add Server Dialog */}
      {addDialogOpen && (
        <AddServerDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onServerCreated={() => fetchServers()}
        />
      )}

      {/* Delete Server Confirmation Dialog */}
      {deleteDialogOpen && serverToDelete && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md w-full shadow-2xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white">
                    Permanently Delete Server
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                    Fleet Decommissioning Action
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-white font-mono">{serverToDelete.serverName}</strong> (
                <code className="text-zinc-400">{serverToDelete.serverId}</code>)?
              </p>
              <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-[11px] text-red-300">
                This action is irreversible. All associated collector enrollment tokens and credentials will be permanently revoked.
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                id="btn-confirm-delete-server"
              >
                {isDeleting ? 'Deleting...' : 'Confirm & Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
