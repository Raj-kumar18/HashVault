import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '../utils/api';
import { RefreshCw, Check, Copy, Activity } from 'lucide-react';

export default function SystemHealthPanel({
  backendStatus,
  apiHealthData,
  dbHealthData,
  isRefreshing,
  onRefresh,
}) {
  const isApiConnected = backendStatus === 'connected';
  const isDbConnected = dbHealthData?.connected === true;
  const [copiedApi, setCopiedApi] = useState(false);
  const [copiedDb, setCopiedDb] = useState(false);

  const copyPayload = (data, setter) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden" id="system-health-panel">
      <CardHeader className="p-6 pb-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white" />
            <CardTitle className="text-base font-bold text-white">
              Live System Telemetry &amp; Health Probes
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono bg-zinc-800 text-zinc-200 border-zinc-700 font-semibold">
              Live Probes
            </Badge>
          </div>
          <CardDescription className="text-xs text-zinc-400 mt-1">
            Real-time ping results from backend Express gateway service and MongoDB database
          </CardDescription>
        </div>

        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          size="sm"
          variant="outline"
          className="gap-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 cursor-pointer self-start sm:self-auto font-semibold"
          id="btn-retest-health"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Pinging Endpoints...' : 'Ping Endpoints'}
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Health Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isApiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-zinc-100">
                    GET /api/health
                  </span>
                </div>
                <Badge
                  variant={isApiConnected ? 'success' : 'destructive'}
                  className="text-[10px] font-mono font-bold"
                >
                  {isApiConnected ? 'HTTP 200 OK' : 'OFFLINE'}
                </Badge>
              </div>

              <div className="text-xs space-y-2 text-zinc-400">
                <div className="flex justify-between">
                  <span>API Gateway:</span>
                  <span className={`font-semibold ${isApiConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isApiConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target URL:</span>
                  <span className="font-mono text-xs text-zinc-200">{API_BASE_URL}/health</span>
                </div>
                {apiHealthData?.latency !== undefined && (
                  <div className="flex justify-between">
                    <span>Roundtrip Latency:</span>
                    <span className="font-mono text-zinc-200 font-semibold">{apiHealthData.latency} ms</span>
                  </div>
                )}
                {apiHealthData?.data?.timestamp && (
                  <div className="flex justify-between">
                    <span>Server Timestamp:</span>
                    <span className="font-mono text-xs text-zinc-300">
                      {new Date(apiHealthData.data.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Response Payload Preview */}
            <div className="mt-4 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">
                  Response Payload
                </span>
                <button
                  type="button"
                  onClick={() => copyPayload(apiHealthData?.data, setCopiedApi)}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedApi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedApi ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs font-mono bg-zinc-900 p-2.5 rounded-lg text-zinc-200 overflow-x-auto border border-zinc-800">
                {JSON.stringify(
                  apiHealthData?.data || { error: apiHealthData?.error || 'Unreachable' },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>

          {/* Database Health Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-zinc-100">
                    GET /api/health/db
                  </span>
                </div>
                <Badge
                  variant={isDbConnected ? 'success' : 'warning'}
                  className="text-[10px] font-mono font-bold"
                >
                  {isDbConnected ? 'HTTP 200 CONNECTED' : 'HTTP 503 DISCONNECTED'}
                </Badge>
              </div>

              <div className="text-xs space-y-2 text-zinc-400">
                <div className="flex justify-between">
                  <span>Mongoose Status:</span>
                  <span className={`font-semibold ${isDbConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isDbConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ReadyState:</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    {dbHealthData?.data?.readyState !== undefined
                      ? `${dbHealthData.data.readyState} (${dbHealthData.data.database})`
                      : 'N/A'}
                  </span>
                </div>
                {dbHealthData?.data?.message && (
                  <div className="flex justify-between">
                    <span>Message:</span>
                    <span className="text-zinc-300 text-right truncate max-w-[200px]" title={dbHealthData.data.message}>
                      {dbHealthData.data.message}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Target URL:</span>
                  <span className="font-mono text-xs text-zinc-200">{API_BASE_URL}/health/db</span>
                </div>
              </div>
            </div>

            {/* Response Payload Preview */}
            <div className="mt-4 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">
                  Response Payload
                </span>
                <button
                  type="button"
                  onClick={() => copyPayload(dbHealthData?.data, setCopiedDb)}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedDb ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedDb ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs font-mono bg-zinc-900 p-2.5 rounded-lg text-zinc-200 overflow-x-auto border border-zinc-800">
                {JSON.stringify(
                  dbHealthData?.data || { error: dbHealthData?.error || 'Unreachable' },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
