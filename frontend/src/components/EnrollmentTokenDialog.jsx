import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Terminal,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { apiEnrollCollector } from '@/utils/api';

export default function EnrollmentTokenDialog({
  open,
  onOpenChange,
  tokenData,
  onEnrollmentComplete,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedCred, setCopiedCred] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [enrolledCredData, setEnrolledCredData] = useState(null);
  const [enrollError, setEnrollError] = useState(null);

  if (!tokenData) return null;

  const handleCopyToken = () => {
    if (tokenData.enrollmentToken) {
      navigator.clipboard.writeText(tokenData.enrollmentToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCredential = () => {
    if (enrolledCredData?.credential) {
      navigator.clipboard.writeText(enrolledCredData.credential);
      setCopiedCred(true);
      setTimeout(() => setCopiedCred(false), 2000);
    }
  };

  const handleSimulateEnrollment = async () => {
    setIsSimulating(true);
    setEnrollError(null);
    try {
      const res = await apiEnrollCollector({
        token: tokenData.enrollmentToken,
        serverId: tokenData.serverId,
      });
      setEnrolledCredData(res);
      if (onEnrollmentComplete) {
        onEnrollmentComplete(res);
      }
    } catch (err) {
      setEnrollError(
        err.message || 'Failed to exchange token for collector credential.'
      );
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight">
                Single-Use Enrollment Token
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                Bound strictly to server{' '}
                <strong className="text-zinc-200">{tokenData.serverName}</strong> (
                <code className="text-zinc-300 font-mono text-xs">
                  {tokenData.serverId}
                </code>
                )
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Warning Banner */}
        <Alert variant="warning" className="py-2.5 bg-amber-950/40 border-amber-800/60">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertTitle className="text-xs font-bold text-amber-300">
            Cryptographic Security Notice
          </AlertTitle>
          <AlertDescription className="text-xs text-zinc-300">
            This token is valid for <strong>15 minutes</strong> and will be invalidated immediately upon consumption. The raw token is stored hashed in the database and cannot be retrieved again.
          </AlertDescription>
        </Alert>

        {/* Raw Token Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Enrollment Token (Expires: {new Date(tokenData.expiresAt).toLocaleTimeString()})
            </span>
            <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 text-zinc-300">
              TTL: 15 Minutes
            </Badge>
          </div>

          <div className="relative">
            <pre className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-200 overflow-x-auto select-all break-all">
              {tokenData.enrollmentToken}
            </pre>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyToken}
              className="absolute right-2 top-2 h-7 px-2.5 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer gap-1 font-semibold"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Agent Installation Protocol Instructions */}
        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            Collector Bootstrap Sequence:
          </h4>
          <ol className="text-xs text-zinc-300 space-y-1.5 list-decimal list-inside leading-relaxed font-normal">
            <li>Run agent directly: <code className="text-zinc-200 font-mono text-xs bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">node collector/src/index.js --server {tokenData.serverId} --enroll {tokenData.enrollmentToken?.slice(0, 10)}...</code></li>
            <li>Or run installer: <code className="text-zinc-200 font-mono text-xs bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">sudo bash collector/scripts/install.sh --server {tokenData.serverId} --token &lt;TOKEN&gt;</code></li>
            <li>Agent executes TLS exchange with <code className="text-white font-mono font-semibold">POST /api/collector/enroll</code>.</li>
            <li>Backend validates &amp; invalidates single-use token, returning persistent collector credential (0600 mode).</li>
            <li>Daemon begins tails and streams batches to <code className="text-white font-mono font-semibold">POST /api/collector/logs</code>.</li>
          </ol>
        </div>

        {/* Real Collector Enrollment Simulator */}
        {!enrolledCredData ? (
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-zinc-100">
                Collector Simulator (Test Harness)
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Trigger backend token exchange to simulate collector enrollment.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSimulateEnrollment}
              disabled={isSimulating}
              className="text-xs shrink-0 bg-white hover:bg-zinc-200 text-zinc-950 font-bold cursor-pointer gap-1.5 shadow-sm"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Simulate Agent Exchange
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-emerald-900/60 bg-emerald-950/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Collector Credential Issued! (v{enrolledCredData.credentialVersion})
              </span>
              <Badge variant="success" className="font-mono text-xs font-bold">
                Enrolled
              </Badge>
            </div>
            <p className="text-xs text-zinc-300">
              The enrollment token was consumed. Below is the server-specific collector credential (stored hashed on server):
            </p>
            <div className="relative">
              <pre className="p-2.5 bg-zinc-950 rounded-lg border border-emerald-900/40 text-xs font-mono text-emerald-300 overflow-x-auto select-all break-all">
                {enrolledCredData.credential}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyCredential}
                className="absolute right-2 top-2 h-6 px-2 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer gap-1"
              >
                {copiedCred ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {enrollError && (
          <Alert variant="destructive" className="py-2 text-xs">
            {enrollError}
          </Alert>
        )}

        <DialogFooter className="pt-2 border-t border-zinc-800">
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 cursor-pointer font-semibold"
          >
            Close Dialog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
