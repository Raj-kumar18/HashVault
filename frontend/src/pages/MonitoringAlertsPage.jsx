import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiGetMonitoringOverview,
  apiGetMonitoredServers,
  apiTriggerMonitoringCycle,
  apiGetSimulations,
  apiRunSimulation,
} from '@/utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Activity,
  Server,
  Zap,
  Play,
  RefreshCw,
  Flame,
  Radio,
  FileCode,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function MonitoringAlertsPage({ user, initialTab = 'simulator' }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Admin';

  const [activeTab, setActiveTab] = useState(initialTab || 'simulator');

  useEffect(() => {
    setActiveTab(initialTab || 'simulator');
  }, [initialTab]);

  // Overview data
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);

  // Fleet servers monitoring data
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(false);

  // Simulation data
  const [simulationsData, setSimulationsData] = useState(null);
  const [simulationsLoading, setSimulationsLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [confirmSimulationOpen, setConfirmSimulationOpen] = useState(false);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Load Overview
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await apiGetMonitoringOverview();
      setOverview(res.monitoring);
    } catch (err) {
      console.error('Failed to load monitoring overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // Load Monitored Servers
  const loadServers = useCallback(async () => {
    setServersLoading(true);
    try {
      const res = await apiGetMonitoredServers();
      setServers(res.servers || []);
    } catch (err) {
      console.error('Failed to load monitored servers:', err);
    } finally {
      setServersLoading(false);
    }
  }, []);

  // Load Simulations
  const loadSimulations = useCallback(async () => {
    setSimulationsLoading(true);
    try {
      const res = await apiGetSimulations();
      setSimulationsData(res);
    } catch (err) {
      console.error('Failed to load simulations catalog:', err);
    } finally {
      setSimulationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === 'servers') {
      loadServers();
    } else if (activeTab === 'simulator') {
      loadSimulations();
    }
  }, [activeTab, loadServers, loadSimulations]);

  // Manual Fleet Audit Trigger
  const handleTriggerAudit = async () => {
    setIsAuditing(true);
    try {
      await apiTriggerMonitoringCycle();
      await loadOverview();
      if (activeTab === 'servers') await loadServers();
    } catch (err) {
      console.error('Audit trigger failed:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSelectScenario = (scenario) => {
    setActiveScenario(scenario);
    setSimulationResult(null);
    setConfirmSimulationOpen(true);
  };

  const handleExecuteSimulation = async () => {
    if (!activeScenario) return;
    setSimulationRunning(true);
    setConfirmSimulationOpen(false);
    try {
      const result = await apiRunSimulation(activeScenario.id);
      setSimulationResult(result);
      await loadSimulations();
      await loadOverview();
    } catch (err) {
      setSimulationResult({
        detected: false,
        observedResult: `Execution error: ${err.message}`,
        findings: [],
        status: 'FAILED',
      });
    } finally {
      setSimulationRunning(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-red-950/50 border border-red-800 text-red-300">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-orange-950/50 border border-orange-800 text-orange-300">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-950/50 border border-amber-800 text-amber-300">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-950/50 border border-emerald-800 text-emerald-300">
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
            INFO
          </span>
        );
    }
  };

  const getHealthBadge = (health) => {
    switch (health) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-emerald-950/40 border border-emerald-800/80 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ONLINE
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-amber-950/40 border border-amber-800/80 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            STALE
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-red-950/40 border border-red-800/80 text-red-300">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            OFFLINE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
            UNKNOWN
          </span>
        );
    }
  };

  const renderTamperedLogDiff = (tamperedLog) => {
    if (!tamperedLog) return null;

    return (
      <div className="space-y-3 pt-3 border-t border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-400" />
              Target:
            </span>
            <span className="text-sm font-mono font-bold text-amber-300">
              {tamperedLog.target || `Sequence #${tamperedLog.sequenceNumber}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {tamperedLog.tamperType && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-red-950/60 border border-red-700/60 text-red-300">
                {tamperedLog.tamperType}
              </span>
            )}
            {tamperedLog.diagnosticCode && (
              <Badge variant="destructive" className="font-mono text-xs font-bold">
                {tamperedLog.diagnosticCode}
              </Badge>
            )}
          </div>
        </div>

        {/* Side by side diff */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Original Legitimate State */}
          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Original State
              </span>
              {tamperedLog.original?.sequenceNumber && (
                <span className="text-xs font-mono text-emerald-300 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                  Seq #{tamperedLog.original.sequenceNumber}
                </span>
              )}
            </div>

            {tamperedLog.original?.message && (
              <div className="space-y-1">
                <div className="text-xs text-zinc-400 font-medium">Sealed Log Message:</div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-emerald-900/50 text-emerald-200 text-xs sm:text-sm font-mono break-all leading-relaxed">
                  {tamperedLog.original.message}
                </div>
              </div>
            )}

            {tamperedLog.original?.eventHash && (
              <div className="space-y-1">
                <div className="text-xs text-zinc-400 font-medium">SHA-256 Hash:</div>
                <div className="text-xs font-mono text-zinc-300 truncate p-2 rounded bg-zinc-950 border border-zinc-800" title={tamperedLog.original.eventHash}>
                  {tamperedLog.original.eventHash}
                </div>
              </div>
            )}
          </div>

          {/* Tampered Attacker State */}
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-red-900/40 pb-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Tampered State
              </span>
              {tamperedLog.tampered?.sequenceNumber && (
                <span className="text-xs font-mono text-red-300 font-bold px-2 py-0.5 rounded bg-red-950 border border-red-800">
                  Seq #{tamperedLog.tampered.sequenceNumber}
                </span>
              )}
            </div>

            {tamperedLog.tampered?.message ? (
              <div className="space-y-1">
                <div className="text-xs text-zinc-400 font-medium">Injected Message:</div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-red-900/50 text-red-200 text-xs sm:text-sm font-mono font-bold break-all leading-relaxed">
                  {tamperedLog.tampered.message}
                </div>
              </div>
            ) : tamperedLog.tampered?.status === 'DELETED_FROM_DATABASE' ? (
              <div className="p-3.5 rounded-lg bg-zinc-950 border border-red-900/60 text-red-300 text-xs sm:text-sm font-mono font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>RECORD PURGED — SEQUENCE GAP TRAPPED</span>
              </div>
            ) : null}

            {tamperedLog.tampered?.eventHash && (
              <div className="space-y-1">
                <div className="text-xs text-zinc-400 font-medium">Diverging Hash:</div>
                <div className="text-xs font-mono text-red-300 truncate p-2 rounded bg-zinc-950 border border-red-900/40" title={tamperedLog.tampered.eventHash}>
                  {tamperedLog.tampered.eventHash}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cryptographic Trap Explanation */}
        {tamperedLog.explanation && (
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs sm:text-sm leading-relaxed">
            <span className="font-bold text-amber-400">Cryptographic Trap: </span>
            {tamperedLog.explanation}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header (Clean, High Contrast) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Monitoring &amp; Attack Drills
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Real-time daemon health tracking and red-team integrity drills.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTriggerAudit}
            disabled={isAuditing}
            className="text-xs sm:text-sm bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-850 cursor-pointer gap-2 h-9 px-4 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            {isAuditing ? 'Evaluating Fleet...' : 'Run Health Audit'}
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
          <TabsTrigger
            value="simulator"
            className="gap-2 text-xs sm:text-sm cursor-pointer data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-medium"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Attack Simulator
          </TabsTrigger>
          <TabsTrigger
            value="servers"
            className="gap-2 text-xs sm:text-sm cursor-pointer data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-medium"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            Fleet Health
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Controlled Attack Simulator */}
        <TabsContent value="simulator" className="space-y-6 mt-0">
          {/* Scenarios Grid (Concise & Legible) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {simulationsData?.scenarios?.map((scenario) => (
              <Card
                key={scenario.id}
                className="bg-zinc-900 border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-700 transition-colors"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-medium">
                      {scenario.category}
                    </span>
                    {getSeverityBadge(scenario.severity)}
                  </div>
                  <CardTitle className="text-base font-bold text-white leading-snug">
                    {scenario.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    {scenario.description}
                  </p>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-xs space-y-1">
                    <div className="text-zinc-400 text-xs">Expected Trap:</div>
                    <div className="text-red-400 font-bold">{scenario.expectedFinding}</div>
                    <div className="text-zinc-500 text-[11px] pt-1">
                      Engine: <span className="text-zinc-300">{scenario.targetSubsystem}</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-5 pt-0">
                  <Button
                    size="sm"
                    onClick={() => handleSelectScenario(scenario)}
                    disabled={!isAdmin || simulationRunning}
                    className="w-full text-xs sm:text-sm bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer gap-2 h-9.5 rounded-lg transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
                    Launch Simulation Drill
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Simulation Result Presentation Card */}
          {simulationResult && (
            <Card className="bg-zinc-900 border-zinc-800 shadow-md mt-6">
              <CardHeader className="p-5 pb-3 border-b border-zinc-800">
                <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {simulationResult.detected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span>Simulation Verdict:</span>
                    <Badge
                      variant={simulationResult.detected ? 'success' : 'destructive'}
                      className="font-mono text-xs font-bold uppercase"
                    >
                      {simulationResult.detected ? 'TAMPERING TRAPPED' : 'UNDETECTED'}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 font-normal">
                    Duration: {simulationResult.durationMs}ms
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-xs font-mono text-zinc-400">Observed Result:</div>
                  <div className="text-emerald-300 font-bold text-sm sm:text-base leading-relaxed">
                    {simulationResult.observedResult}
                  </div>
                </div>

                {/* Render Forensics of Which Log Was Tampered */}
                {(simulationResult.tamperedLog || simulationResult.run?.tamperedLog) &&
                  renderTamperedLogDiff(simulationResult.tamperedLog || simulationResult.run?.tamperedLog)}

                {simulationResult.findings?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                    <div className="text-zinc-200 font-semibold text-xs sm:text-sm">
                      Engine Verification Findings ({simulationResult.findings.length}):
                    </div>
                    <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-200 overflow-x-auto max-h-48 leading-relaxed font-mono">
                      {JSON.stringify(simulationResult.findings, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attack Drill Run History Table */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm mt-8">
            <CardHeader className="p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Drill Execution History
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Audit log of past executed scenarios, tampered records, and detection verdicts.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-zinc-700 bg-zinc-950 text-zinc-300">
                  {simulationsData?.recentRuns?.length || 0} Runs Recorded
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadSimulations}
                  disabled={simulationsLoading}
                  className="h-8 px-2.5 text-xs bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${simulationsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {simulationsLoading && !simulationsData ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-10 w-full bg-zinc-800/60" />
                  <Skeleton className="h-10 w-full bg-zinc-800/60" />
                </div>
              ) : !simulationsData?.recentRuns || simulationsData.recentRuns.length === 0 ? (
                <div className="p-10 text-center text-sm text-zinc-400">
                  No attack drill runs executed yet. Launch a scenario above to test the integrity engine.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader className="bg-zinc-950 border-b border-zinc-800">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 font-semibold uppercase text-xs">Timestamp</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase text-xs">Scenario / Drill</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase text-xs">Target &amp; Vector</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase text-xs">Verdict</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase text-xs">Duration</TableHead>
                        <TableHead className="text-right text-zinc-400 font-semibold uppercase text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-800/50">
                      {simulationsData.recentRuns.map((run) => (
                        <TableRow key={run._id || run.runId} className="border-zinc-800/50 hover:bg-zinc-850/50">
                          <TableCell className="font-mono text-zinc-400 text-xs sm:text-sm whitespace-nowrap">
                            {new Date(run.startedAt || run.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-white text-sm">{run.title || run.scenarioName}</div>
                            <div className="text-xs font-mono text-zinc-400 truncate max-w-sm">
                              {run.intendedModification}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-zinc-300 text-xs sm:text-sm">
                            {run.tamperedLog ? (
                              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-amber-300 font-semibold">
                                {run.tamperedLog.target || `Seq #${run.tamperedLog.sequenceNumber}`}
                              </span>
                            ) : (
                              <span className="text-zinc-500">Drill Fixture</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={run.detected ? 'success' : 'destructive'}
                              className="font-mono text-xs font-bold uppercase"
                            >
                              {run.detected ? 'TRAPPED' : 'UNDETECTED'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-zinc-400 text-xs sm:text-sm">
                            {run.durationMs}ms
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedHistoryRun(run);
                                setHistoryModalOpen(true);
                              }}
                              className="h-8 px-3 text-xs sm:text-sm border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white cursor-pointer font-medium gap-1.5"
                            >
                              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                              Inspect Diff
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

        {/* Tab 2: Fleet Health */}
        <TabsContent value="servers" className="space-y-6 mt-0">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Collector Fleet Health */}
            <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Collector Daemons</span>
                  <Radio className="w-4 h-4 text-emerald-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.collectorHealth?.ONLINE || 0}{' '}
                  <span className="text-xs font-sans font-normal text-zinc-400">
                    / {overview?.totalServers || 0} Online
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                  <span className="text-emerald-400">● {overview?.collectorHealth?.ONLINE || 0} Online</span>
                  <span className="text-amber-400">● {overview?.collectorHealth?.STALE || 0} Stale</span>
                  <span className="text-red-400">● {overview?.collectorHealth?.OFFLINE || 0} Offline</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Blockchain Connectivity */}
            <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Blockchain Ledger</span>
                  <Layers className="w-4 h-4 text-zinc-300" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                  {overview?.blockchainHealth?.connected ? 'READY' : 'OFFLINE'}
                </div>
                <p className="text-xs text-zinc-400 mt-2 truncate font-mono">
                  {overview?.blockchainHealth?.networkName || 'Hardhat Localhost'} ({overview?.blockchainHealth?.latency || 0}ms)
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Ingested Hash Chain Telemetry */}
            <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Sealed Log Events</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.totalChainEvents || 0}
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  Protected via SHA-256 canonical hash chain
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-300" />
                Collector Daemon Health &amp; Ingestion Progression
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Real-time daemon heartbeats, telemetry sequences, and cryptographic verification states.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {serversLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-10 w-full bg-zinc-800/60" />
                  <Skeleton className="h-10 w-full bg-zinc-800/60" />
                </div>
              ) : servers.length === 0 ? (
                <div className="p-10 text-center text-sm text-zinc-400">
                  No registered servers found. Register a node in Server Fleet to begin monitoring.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader className="bg-zinc-950 border-b border-zinc-800">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Server / Host</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Collector Health</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Last Heartbeat</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Chain Head</TableHead>
                        <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">Integrity Verdict</TableHead>
                        <TableHead className="text-right text-zinc-400 font-semibold uppercase tracking-wider text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-800/50">
                      {servers.map((srv) => (
                        <TableRow key={srv.serverId} className="border-zinc-800/50 hover:bg-zinc-850/50">
                          <TableCell className="font-medium text-white">
                            <div className="text-sm font-semibold">{srv.serverName}</div>
                            <div className="text-xs font-mono text-zinc-400">{srv.hostname}</div>
                          </TableCell>
                          <TableCell>{getHealthBadge(srv.collectorHealth)}</TableCell>
                          <TableCell className="font-mono text-zinc-300 text-xs sm:text-sm">
                            {srv.lastHeartbeatAt ? (
                              <span title={new Date(srv.lastHeartbeatAt).toISOString()}>
                                {srv.lastHeartbeatAgeSeconds}s ago
                              </span>
                            ) : (
                              <span className="text-zinc-500">No heartbeat yet</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-white font-bold text-sm">
                            #{srv.chainHeadSequence}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                srv.lastVerificationStatus === 'VERIFIED'
                                  ? 'success'
                                  : srv.lastVerificationStatus === 'TAMPERED'
                                  ? 'destructive'
                                  : 'warning'
                              }
                              className="font-mono text-xs font-semibold"
                            >
                              {srv.lastVerificationStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/integrity?server=${srv.serverId}`)}
                              className="h-8 px-3 text-xs sm:text-sm border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white cursor-pointer font-medium"
                            >
                              Inspect Chain
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
      </Tabs>

      {/* Confirmation Modal Before Running Simulation */}
      {activeScenario && (
        <Dialog open={confirmSimulationOpen} onOpenChange={setConfirmSimulationOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                Confirm Attack Drill
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-zinc-400">
                Execute controlled drill: <strong className="text-white">{activeScenario.title}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 leading-relaxed">
                {activeScenario.description}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Executes in an isolated environment against a disposable fixture. No production logs will be modified.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmSimulationOpen(false)}
                className="text-xs sm:text-sm bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteSimulation}
                className="text-xs sm:text-sm bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer"
              >
                Execute Drill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Historical Simulation Run Detail Modal */}
      {selectedHistoryRun && (
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3 pr-6">
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>Drill Forensic Audit</span>
                </DialogTitle>
                <Badge
                  variant={selectedHistoryRun.detected ? 'success' : 'destructive'}
                  className="font-mono text-xs font-bold"
                >
                  {selectedHistoryRun.detected ? 'TAMPERING TRAPPED' : 'UNDETECTED'}
                </Badge>
              </div>
              <DialogDescription className="text-xs sm:text-sm text-zinc-400 mt-1">
                {selectedHistoryRun.title} — {new Date(selectedHistoryRun.startedAt || selectedHistoryRun.createdAt).toLocaleString()} ({selectedHistoryRun.durationMs}ms)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs sm:text-sm">
              {/* Intended Modification & Observed Result */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="text-xs uppercase font-bold text-zinc-400">Intended Modification:</div>
                  <div className="text-zinc-200 font-mono text-xs sm:text-sm leading-relaxed">{selectedHistoryRun.intendedModification}</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="text-xs uppercase font-bold text-zinc-400">Observed Result:</div>
                  <div className="text-emerald-300 font-mono text-xs sm:text-sm font-bold leading-relaxed">{selectedHistoryRun.observedResult}</div>
                </div>
              </div>

              {/* Tampered Log Breakdown */}
              {renderTamperedLogDiff(selectedHistoryRun.tamperedLog)}

              {/* Raw Findings if available */}
              {selectedHistoryRun.findings?.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-zinc-200 font-semibold text-xs sm:text-sm">
                    Engine Findings ({selectedHistoryRun.findings.length}):
                  </div>
                  <pre className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-zinc-200 overflow-x-auto max-h-40 leading-relaxed font-mono">
                    {JSON.stringify(selectedHistoryRun.findings, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryModalOpen(false)}
                className="text-xs sm:text-sm bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                Close Audit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
