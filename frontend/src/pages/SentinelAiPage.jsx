import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  apiGetAiStatus,
  apiCreateAnalysis,
  apiListAnalyses,
  apiGetAnalysis,
  apiGetServers,
  apiGetAlerts,
} from '../utils/api';
import VaultAIHeader from '../components/vaultai/VaultAIHeader';
import InvestigationStart from '../components/vaultai/InvestigationStart';
import InvestigationProgress from '../components/vaultai/InvestigationProgress';
import ExecutiveConclusion from '../components/vaultai/ExecutiveConclusion';
import FindingList from '../components/vaultai/FindingList';
import IntegritySummary from '../components/vaultai/IntegritySummary';
import RecommendedActions from '../components/vaultai/RecommendedActions';
import ReportActions from '../components/vaultai/ReportActions';
import InvestigationHistoryDialog from '../components/vaultai/InvestigationHistoryDialog';

export default function SentinelAiPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Primary 3 UI States: 'ready' | 'investigating' | 'report'
  const [viewState, setViewState] = useState('ready');

  // Authoritative Telemetry & Fleet State
  const [servers, setServers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadingFleet, setLoadingFleet] = useState(true);

  // Target Server Selection
  const [selectedServerId, setSelectedServerId] = useState(null);

  // Investigation Execution State
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigationMessage, setInvestigationMessage] = useState('');
  const [investigationStepIndex, setInvestigationStepIndex] = useState(0);
  const [investigationError, setInvestigationError] = useState(null);

  // Completed Active Report
  const [activeReport, setActiveReport] = useState(null);

  // History & Diagnostics
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  const progressIntervalRef = useRef(null);

  // Handle server selection change
  const handleSelectServer = (serverId) => {
    setSelectedServerId(serverId);
  };

  // Fetch initial fleet, alerts, AI readiness, and history
  const loadInitialData = useCallback(async () => {
    setLoadingFleet(true);
    try {
      const [serversRes, alertsRes, statusRes, historyRes] = await Promise.all([
        apiGetServers({ limit: 50 }).catch(() => null),
        apiGetAlerts({ status: 'OPEN', limit: 20 }).catch(() => null),
        apiGetAiStatus().catch(() => null),
        apiListAnalyses({ limit: 15 }).catch(() => null),
      ]);

      const loadedServers = serversRes?.servers || [];
      setServers(loadedServers);
      setAlerts(alertsRes?.alerts || []);
      setAiStatus(statusRes?.data || { ready: true });

      // Initialize selected server to first server if not set
      if (loadedServers.length > 0) {
        setSelectedServerId((prev) => {
          const match = loadedServers.find((s) => s.serverId === prev);
          return match ? match.serverId : loadedServers[0].serverId;
        });
      }

      const loadedHistory = historyRes?.analyses || historyRes?.reports || [];
      setHistory(loadedHistory);

      // ONLY load report if explicitly requested via query parameter (?report=ID)
      // Never use sticky localStorage that traps the user upon page refresh!
      const queryParams = new URLSearchParams(location.search);
      const urlReportId = queryParams.get('report');

      if (urlReportId) {
        try {
          const repRes = await apiGetAnalysis(urlReportId);
          if (repRes?.success && repRes.report) {
            setActiveReport(repRes.report);
            setViewState('report');
          }
        } catch {
          // If specified report cannot be found, stay in ready view
          navigate('/ai', { replace: true });
        }
      } else {
        // Default on fresh navigation or refresh is ALWAYS the clean Ready view
        setViewState('ready');
      }
    } catch (err) {
      console.error('Failed to initialize VaultAI fleet telemetry:', err);
    } finally {
      setLoadingFleet(false);
    }
  }, [location.search, navigate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Fetch History for Dialog
  const fetchHistoryList = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiListAnalyses({ limit: 20 });
      setHistory(res?.analyses || res?.reports || []);
    } catch (err) {
      console.error('Failed to list historical analyses:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    fetchHistoryList();
    setHistoryDialogOpen(true);
  };

  // Select historical report from history dialog
  const handleSelectReport = async (analysisId) => {
    try {
      const res = await apiGetAnalysis(analysisId);
      if (res?.success && res.report) {
        setActiveReport(res.report);
        setViewState('report');
        navigate(`/ai?report=${analysisId}`, { replace: true });
      }
    } catch (err) {
      alert(`Could not load report: ${err.message}`);
    }
  };

  // Primary Action: "Investigate Selected Server"
  const handleStartInvestigation = async () => {
    if (isInvestigating || servers.length === 0) return;

    const targetServer = servers.find((s) => s.serverId === selectedServerId) || servers[0];
    if (!targetServer) return;

    setIsInvestigating(true);
    setViewState('investigating');
    setInvestigationError(null);
    setInvestigationStepIndex(0);

    const progressStages = [
      `Collecting security evidence for ${targetServer.serverName}...`,
      'Verifying cryptographic SHA-256 hash chains...',
      'Cross-referencing Ethereum Sepolia consensus...',
      'Analyzing sequence continuity and potential tampering...',
      'Compiling executive security report...',
    ];

    setInvestigationMessage(progressStages[0]);

    let stageIdx = 0;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      stageIdx++;
      if (stageIdx < progressStages.length) {
        setInvestigationStepIndex(stageIdx);
        setInvestigationMessage(progressStages[stageIdx]);
      } else {
        setInvestigationMessage('Finalizing evidence correlation and compiling audit report...');
      }
    }, 1800);

    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const openAlertIds = (alerts || []).map((a) => a.alertId || a._id).filter(Boolean);

      const res = await apiCreateAnalysis({
        serverId: targetServer.serverId,
        startTime,
        endTime,
        alertIds: openAlertIds,
        question: `Autonomous fleet security investigation: verify cryptographic hash-chain integrity, detect log tampering anomalies, and assess operational security risks for ${targetServer.serverName}.`,
      });

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      if (res?.success && res.report) {
        setActiveReport(res.report);
        setViewState('report');
        fetchHistoryList();
      } else {
        setInvestigationError(res?.message || 'Investigation failed to complete. Please retry.');
      }
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setInvestigationError(err.message || 'Investigation pipeline encountered an unexpected error.');
    } finally {
      setIsInvestigating(false);
    }
  };

  // Return cleanly to Ready view to investigate another server
  const handleInvestigateAgain = () => {
    setViewState('ready');
    setActiveReport(null);
    setInvestigationError(null);
    navigate('/ai', { replace: true });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto w-full pb-16">
      {/* 1. Header (Minimalist & Understated) */}
      <VaultAIHeader
        aiStatus={aiStatus}
        onOpenHistory={handleOpenHistory}
        historyCount={history.length}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={handleSelectServer}
      />

      {/* 2. Ready State (Clean, Server Fleet Selection & One Primary Action) */}
      {viewState === 'ready' && (
        <InvestigationStart
          servers={servers}
          selectedServerId={selectedServerId}
          onSelectServer={handleSelectServer}
          loadingServers={loadingFleet}
          onStartInvestigation={handleStartInvestigation}
          isInvestigating={isInvestigating}
        />
      )}

      {/* 3. Investigating State (Minimal Restrained Progress) */}
      {viewState === 'investigating' && (
        <InvestigationProgress
          currentMessage={investigationMessage}
          stepIndex={investigationStepIndex}
          error={investigationError}
          onRetry={handleStartInvestigation}
        />
      )}

      {/* 4. Report State (Executive Conclusion, Findings, Integrity & Actions) */}
      {viewState === 'report' && activeReport && (
        <div className="space-y-6">
          {/* Section A: Executive Conclusion */}
          <ExecutiveConclusion report={activeReport} />

          {/* Section B: What Needs Attention */}
          <FindingList
            findings={activeReport.findings || []}
            serverName={activeReport.serverName || activeReport.serverId}
          />

          {/* Section C: Evidence & Integrity */}
          <IntegritySummary report={activeReport} />

          {/* Section D: Recommended Actions */}
          <RecommendedActions
            steps={activeReport.recommendedInvestigationSteps || []}
            findings={activeReport.findings || []}
          />

          {/* Section E: Report Actions (PDF Download & Investigate Another Server) */}
          <ReportActions
            report={activeReport}
            onInvestigateAgain={handleInvestigateAgain}
          />
        </div>
      )}

      {/* 5. Separate Compact History Dialog */}
      <InvestigationHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        history={history}
        loading={loadingHistory}
        onSelectReport={handleSelectReport}
      />
    </div>
  );
}
