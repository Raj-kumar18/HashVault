import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import HowItWorksPage from './pages/HowItWorksPage';
import ServersPage from './pages/ServersPage';
import ServerDetailPage from './pages/ServerDetailPage';
import IntegrityExplorerPage from './pages/IntegrityExplorerPage';
import BlockchainCheckpointsPage from './pages/BlockchainCheckpointsPage';
import MonitoringAlertsPage from './pages/MonitoringAlertsPage';
import AlertsCenterPage from './pages/AlertsCenterPage';
import SecurityOverviewPage from './pages/SecurityOverviewPage';
import LogsExplorerPage from './pages/LogsExplorerPage';
import SentinelAiPage from './pages/SentinelAiPage';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import SystemHealthPanel from './components/SystemHealthPanel';
import RealtimeAlertNotifier from './components/RealtimeAlertNotifier';
import { checkApiHealth, checkDbHealth, apiGetServers, apiGetAlerts } from './utils/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import {
  LayoutDashboard,
  Activity,
} from 'lucide-react';

function DashboardShell() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState('overview');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [backendLatency, setBackendLatency] = useState(null);
  const [apiHealthData, setApiHealthData] = useState(null);
  const [dbHealthData, setDbHealthData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [serverCount, setServerCount] = useState(null);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);

  // Sidebar visibility toggle with localStorage persistence
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('hashvault_sidebar_open');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hashvault_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

  // Synchronize sidebar active tab with browser URL
  useEffect(() => {
    if (location.pathname.startsWith('/servers')) {
      setActiveTab('servers');
    } else if (location.pathname.startsWith('/logs')) {
      setActiveTab('logs');
    } else if (location.pathname.startsWith('/integrity')) {
      setActiveTab('integrity');
    } else if (location.pathname.startsWith('/checkpoints')) {
      setActiveTab('checkpoints');
    } else if (location.pathname.startsWith('/alerts')) {
      setActiveTab('alerts');
    } else if (location.pathname.startsWith('/monitoring')) {
      setActiveTab('monitoring');
    } else if (location.pathname.startsWith('/ai')) {
      setActiveTab('sentinel-ai');
    } else if (location.pathname === '/' || location.pathname === '/dashboard') {
      setActiveTab('dashboard');
    }
  }, [location.pathname]);

  // Fetch real fleet count from MongoDB
  const fetchFleetCount = useCallback(async () => {
    try {
      const res = await apiGetServers({ limit: 1 });
      setServerCount(res?.pagination?.total ?? res?.servers?.length ?? 0);
    } catch {
      setServerCount(0);
    }
  }, []);

  useEffect(() => {
    fetchFleetCount();
  }, [fetchFleetCount, location.pathname]);

  const fetchHealth = useCallback(async () => {
    setIsRefreshing(true);
    const [apiRes, dbRes, alertsRes] = await Promise.all([
      checkApiHealth(),
      checkDbHealth(),
      apiGetAlerts({ status: 'OPEN', limit: 1 }).catch(() => null),
    ]);

    if (apiRes.success) {
      setBackendStatus('connected');
      setBackendLatency(apiRes.latency);
      setApiHealthData(apiRes);
    } else {
      setBackendStatus('disconnected');
      setBackendLatency(null);
      setApiHealthData(apiRes);
    }

    if (alertsRes?.pagination?.total !== undefined) {
      setOpenAlertsCount(alertsRes.pagination.total);
    }

    setDbHealthData(dbRes);
    setLastChecked(new Date());
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard') {
      navigate('/');
    } else if (tabId === 'servers') {
      navigate('/servers');
    } else if (tabId === 'logs') {
      navigate('/logs');
    } else if (tabId === 'integrity') {
      navigate('/integrity');
    } else if (tabId === 'checkpoints') {
      navigate('/checkpoints');
    } else if (tabId === 'alerts') {
      navigate('/alerts');
    } else if (tabId === 'monitoring') {
      navigate('/monitoring');
    } else if (tabId === 'sentinel-ai') {
      navigate('/ai');
    }
  };

  const serverDetailMatch = location.pathname.match(/^\/servers\/([^/]+)/);
  const activeServerId = serverDetailMatch ? serverDetailMatch[1] : null;
  const isServerDetailRoute = !!activeServerId;
  const isServersInventoryRoute = location.pathname === '/servers' || location.pathname === '/servers/';
  const isLogsRoute = location.pathname.startsWith('/logs');
  const isIntegrityRoute = location.pathname.startsWith('/integrity');
  const isCheckpointsRoute = location.pathname.startsWith('/checkpoints');
  const isAlertsRoute = location.pathname.startsWith('/alerts');
  const isMonitoringRoute = location.pathname.startsWith('/monitoring');
  const isAiRoute = location.pathname.startsWith('/ai');

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 flex overflow-hidden antialiased selection:bg-white selection:text-black relative">
      {/* Global Real-time Tamper & Critical Security Incident Notifier */}
      <RealtimeAlertNotifier onAlertEvent={fetchHealth} />

      {/* Sidebar Navigation (Permanently Fixed to Left) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        user={user}
        openAlertsCount={openAlertsCount}
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
      />

      {/* Main Viewport Container (Independently Scrolls) */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto overflow-x-hidden transition-all duration-300">
        {/* Top Navigation */}
        <TopNav
          backendStatus={backendStatus}
          backendLatency={backendLatency}
          isRefreshing={isRefreshing}
          onRefresh={fetchHealth}
          dbStatus={dbHealthData}
          apiHealthData={apiHealthData}
          user={user}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        {/* Page Content Body */}
        <main className="p-6 max-w-7xl w-full mx-auto space-y-6">

          {isServerDetailRoute ? (
            <ServerDetailPage serverId={activeServerId} />
          ) : isServersInventoryRoute || activeTab === 'servers' ? (
            <ServersPage />
          ) : isLogsRoute || activeTab === 'logs' ? (
            <LogsExplorerPage />
          ) : isIntegrityRoute || activeTab === 'integrity' ? (
            <IntegrityExplorerPage />
          ) : isCheckpointsRoute || activeTab === 'checkpoints' ? (
            <BlockchainCheckpointsPage user={user} />
          ) : isAlertsRoute || activeTab === 'alerts' ? (
            <AlertsCenterPage user={user} />
          ) : isMonitoringRoute || activeTab === 'monitoring' ? (
            <MonitoringAlertsPage user={user} initialTab="simulator" />
          ) : isAiRoute || activeTab === 'sentinel-ai' ? (
            <SentinelAiPage user={user} />
          ) : activeTab === 'dashboard' ? (
            <>
              {/* Dashboard SubTabs */}
              <Tabs
                value={dashboardSubTab}
                onValueChange={setDashboardSubTab}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <TabsList className="bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
                    <TabsTrigger
                      value="overview"
                      className="gap-2 text-xs cursor-pointer data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-zinc-700"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      SOC Overview
                    </TabsTrigger>

                    <TabsTrigger
                      value="telemetry"
                      className="gap-2 text-xs cursor-pointer data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:border-zinc-700"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Platform Telemetry
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* SubTab 1: Overview & Topology */}
                <TabsContent value="overview" className="space-y-6 mt-0">
                  <SecurityOverviewPage />
                </TabsContent>

                {/* SubTab 2: Live Health Telemetry */}
                <TabsContent value="telemetry" className="space-y-6 mt-0">
                  <SystemHealthPanel
                    backendStatus={backendStatus}
                    apiHealthData={apiHealthData}
                    dbHealthData={dbHealthData}
                    isRefreshing={isRefreshing}
                    onRefresh={fetchHealth}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <SecurityOverviewPage />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-zinc-800 bg-zinc-950 px-6 py-4 text-xs text-zinc-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-200">HashVault</span>
            <span>—</span>
            <span className="text-zinc-400">Every Log. Verifiable Trust.</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-zinc-300 font-medium">Enterprise Security Console</span>
            {lastChecked && (
              <span className="text-zinc-400">Last Telemetry Probe: {lastChecked.toLocaleTimeString()}</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <p className="text-xs text-zinc-400 font-mono tracking-wider">
          INITIALIZING SECURITY CONSOLE...
        </p>
      </div>
    );
  }

  return isAuthenticated ? <DashboardShell /> : <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<RootRoute />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
