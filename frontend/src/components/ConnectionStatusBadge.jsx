import React from 'react';

/**
 * Small backend connection status indicator badge
 */
export default function ConnectionStatusBadge({
  status,
  latency,
  isRefreshing,
  onRefresh,
}) {
  const isConnected = status === 'connected';
  const isChecking = status === 'checking';

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors bg-zinc-900 border-zinc-700/80 text-zinc-200 shadow-sm"
      id="backend-connection-badge"
    >
      <span className="relative flex h-2 w-2">
        {isConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </>
        ) : isChecking ? (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        )}
      </span>

      <span className="font-semibold text-zinc-300">
        API:{' '}
        <span
          className={
            isConnected
              ? 'text-emerald-400 font-bold'
              : isChecking
              ? 'text-amber-400 font-bold'
              : 'text-red-400 font-bold'
          }
        >
          {isChecking ? 'Checking...' : isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </span>

      {isConnected && latency !== null && (
        <span className="text-zinc-400 border-l border-zinc-700 pl-2 font-mono text-[11px]">
          {latency}ms
        </span>
      )}

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh backend status"
          className="ml-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          id="btn-refresh-connection"
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
