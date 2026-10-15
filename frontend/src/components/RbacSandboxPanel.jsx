import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiTestRbac } from '../utils/api';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';

export default function RbacSandboxPanel({ user }) {
  const [activeTest, setActiveTest] = useState(null);
  const [testingEndpoint, setTestingEndpoint] = useState(null);
  const [probeResult, setProbeResult] = useState(null);

  const runProbe = async (endpoint, tierName, requiredRoles) => {
    setTestingEndpoint(endpoint);
    setActiveTest(tierName);
    const startTime = performance.now();

    try {
      const data = await apiTestRbac(endpoint);
      const latency = Math.round(performance.now() - startTime);
      setProbeResult({
        success: true,
        endpoint: `/api/auth/test/${endpoint}`,
        status: 200,
        statusText: '200 OK — Access Granted',
        tierName,
        requiredRoles,
        latency,
        message: data.message,
        payload: data,
      });
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      setProbeResult({
        success: false,
        endpoint: `/api/auth/test/${endpoint}`,
        status: err.status || 403,
        statusText: `${err.status || 403} Forbidden — Access Denied`,
        tierName,
        requiredRoles,
        latency,
        message: err.message,
        payload: err.data || { error: 'Forbidden', message: err.message },
      });
    } finally {
      setTestingEndpoint(null);
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'Admin':
        return 'default';
      case 'Analyst':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
      <CardHeader className="p-6 pb-4 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-white">
                Live RBAC Authorization Sandbox &amp; Probes
              </CardTitle>
              <Badge variant="default" className="text-[10px] font-mono bg-white text-zinc-950 font-bold">
                Access Controls
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-1">
              Verify server-side role enforcement against Express authorization middleware
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-950 px-3.5 py-1.5 rounded-lg border border-zinc-800 shadow-sm">
            <span className="text-xs text-zinc-400 font-semibold">Active Session Role:</span>
            <Badge variant={getRoleBadgeVariant(user?.role)} className="font-mono text-xs font-bold">
              {user?.role || 'Viewer'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Tier test action cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Probe 1: Any Authenticated */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Generic Protected
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 text-zinc-300">
                  All Roles
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                Requires active authenticated session (Admin, Analyst, or Viewer).
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => runProbe('protected', 'Generic Authenticated', ['Admin', 'Analyst', 'Viewer'])}
              disabled={testingEndpoint === 'protected'}
              className="mt-4 w-full text-xs cursor-pointer border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-semibold"
            >
              {testingEndpoint === 'protected' ? 'Testing...' : 'Probe /test/protected'}
            </Button>
          </div>

          {/* Probe 2: Analyst & Admin */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                  <Shield className="w-4 h-4 text-zinc-300" />
                  Analyst Workflow
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono text-zinc-200">
                  Analyst + Admin
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                Restricted to security analysts &amp; administrators. Denied to Viewers.
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => runProbe('analyst-only', 'Analyst Workflow', ['Admin', 'Analyst'])}
              disabled={testingEndpoint === 'analyst-only'}
              className="mt-4 w-full text-xs cursor-pointer border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-semibold"
            >
              {testingEndpoint === 'analyst-only' ? 'Testing...' : 'Probe /test/analyst-only'}
            </Button>
          </div>

          {/* Probe 3: Admin Only */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Admin Controls
                </div>
                <Badge variant="default" className="text-[10px] font-mono bg-white text-zinc-950 font-bold">
                  Admin Only
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                Strict root administrative access. Denied to Analysts and Viewers.
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => runProbe('admin-only', 'Admin Controls', ['Admin'])}
              disabled={testingEndpoint === 'admin-only'}
              className="mt-4 w-full text-xs cursor-pointer border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-semibold"
            >
              {testingEndpoint === 'admin-only' ? 'Testing...' : 'Probe /test/admin-only'}
            </Button>
          </div>
        </div>

        {/* Live Probe Result Inspector */}
        {probeResult && (
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {probeResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-xs font-bold text-white">
                  Probe Result: {probeResult.statusText}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span>Latency: {probeResult.latency}ms</span>
                <span>•</span>
                <span>Endpoint: {probeResult.endpoint}</span>
              </div>
            </div>

            <div className="text-xs text-zinc-200 bg-zinc-900 p-3 rounded-lg border border-zinc-800 font-mono">
              <span className="text-zinc-400 block mb-1 font-sans text-xs uppercase font-semibold">
                Server Response:
              </span>
              {JSON.stringify(probeResult.payload, null, 2)}
            </div>

            <div className="text-xs text-zinc-400 flex items-center justify-between pt-1">
              <span>
                Required Role: <strong className="text-zinc-200">{probeResult.requiredRoles.join(' or ')}</strong>
              </span>
              <span>
                Your Account Role: <strong className="text-white font-bold">{user?.role}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Multi-Tenant Security Scope Notice */}
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 flex items-start gap-3 text-xs text-zinc-400">
          <Info className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-xs">
            <strong className="text-zinc-200 font-semibold">Enterprise RBAC Model:</strong> Role checks (`Admin`, `Analyst`, `Viewer`) enforce capability boundaries. Subsequent phases layer object-level ownership checks (e.g. server UUID, organization ID) to prevent cross-tenant data access even between users sharing the same role tier.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
