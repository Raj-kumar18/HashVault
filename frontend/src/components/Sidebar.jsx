import React from 'react';
import {
  LayoutDashboard,
  Server,
  Terminal,
  ShieldCheck,
  Link2,
  ShieldAlert,
  Shield,
  Activity,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  onSelectTab,
  user,
  openAlertsCount = 0,
  isOpen = true,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Security Overview', icon: LayoutDashboard },
    { id: 'sentinel-ai', label: 'VaultAI', icon: Sparkles },
    { id: 'servers', label: 'Server Fleet', icon: Server },
    { id: 'logs', label: 'Logs Explorer', icon: Terminal },
    { id: 'integrity', label: 'Integrity Explorer', icon: ShieldCheck },
    { id: 'checkpoints', label: 'Blockchain Registry', icon: Link2 },
    { id: 'alerts', label: 'Alerts Center', icon: ShieldAlert },
    { id: 'monitoring', label: 'Monitoring & Drills', icon: Activity },
  ];

  return (
    <aside
      className={`bg-zinc-950 flex flex-col shrink-0 select-none h-screen overflow-y-auto overflow-x-hidden z-30 transition-[width,opacity] duration-300 ease-in-out ${
        isOpen
          ? 'w-64 opacity-100 border-r border-zinc-800'
          : 'w-0 opacity-0 border-none pointer-events-none'
      }`}
      id="sidebar-container"
    >
      <div className="w-64 flex flex-col h-full">
        {/* Brand Header */}
        <div className="h-16 sm:h-18 px-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white leading-tight">
                HashVault
              </h1>
              <p className="text-xs text-zinc-300 font-medium tracking-normal mt-0.5">
                Every Log. Verifiable Trust.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1.5 flex-1">
          <div className="px-3 py-2 text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>Security Console</span>
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800/90 text-white font-bold border-l-2 border-emerald-400 pl-2.5 shadow-sm'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-900/80'
                }`}
                id={`nav-item-${item.id}`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  />
                  <span className="tracking-tight text-sm">{item.label}</span>
                </div>
                {item.id === 'alerts' && openAlertsCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-red-600 text-white animate-pulse">
                    {openAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
