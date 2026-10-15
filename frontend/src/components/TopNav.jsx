import React from 'react';
import ConnectionStatusBadge from './ConnectionStatusBadge';
import UserAccountMenu from './UserAccountMenu';
import SystemDiagnosticsDialog from './SystemDiagnosticsDialog';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TopNav({
  backendStatus,
  backendLatency,
  isRefreshing,
  onRefresh,
  dbStatus,
  apiHealthData,
  user,
  isSidebarOpen,
  onToggleSidebar,
}) {
  return (
    <header
      className="h-16 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20"
      id="top-nav-bar"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Sleek Minimalist Sidebar Toggle Icon */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-850 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors shrink-0 border border-zinc-800/80"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            id="sidebar-toggle-btn"
          >
            <PanelLeft className="w-4 h-4 text-zinc-300 hover:text-white" />
          </Button>
        )}

        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-white text-sm sm:text-base tracking-tight">
              HashVault Enterprise Dashboard
            </span>
          </div>
          <p className="text-xs text-zinc-300 font-normal hidden sm:block">
            Unified Security Operations &amp; Tamper-Evident Ledger
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Database state pill */}
        <div
          className={`hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors shadow-sm ${dbStatus?.connected
              ? 'bg-zinc-900 border-zinc-700/80 text-zinc-100'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          title={
            dbStatus?.connected
              ? 'Database connection active'
              : 'Database is currently disconnected'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
          />
          <span className="text-xs font-mono font-medium">
            DB: {dbStatus?.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* API Backend status badge */}
        <ConnectionStatusBadge
          status={backendStatus}
          latency={backendLatency}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />

        {/* System Diagnostics Modal Trigger */}
        <SystemDiagnosticsDialog
          user={user}
          apiHealth={apiHealthData}
          dbHealth={dbStatus}
          backendStatus={backendStatus}
          backendLatency={backendLatency}
        />

        {/* User Account Menu with Logout */}
        <UserAccountMenu />
      </div>
    </header>
  );
}
