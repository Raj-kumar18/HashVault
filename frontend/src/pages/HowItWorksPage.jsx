import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Terminal,
  Boxes,
  Sparkles,
  Lock,
  Layers,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function HowItWorksPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Interactive live tampering demo state
  const [tampered, setTampered] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-white selection:text-black">
      
      {/* ========================================================
          STICKY TOP NAVIGATION BAR
          ======================================================== */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-white shadow-sm">
              <Shield className="w-5 h-5 stroke-[2.2] text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                HashVault
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  How It Works
                </span>
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-zinc-300">
            <Link to="/home" className="text-zinc-300 hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/how-it-works" className="text-white font-bold transition-colors">
              How It Works
            </Link>
            <Link to="/about" className="text-zinc-300 hover:text-white transition-colors">
              About
            </Link>
          </nav>

          {/* Auth Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                onClick={() => navigate('/dashboard')}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs h-9 px-4 rounded-xl shadow-sm cursor-pointer"
              >
                Launch Console <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  className="text-xs text-zinc-200 hover:text-white hover:bg-zinc-900 h-9 px-3.5 cursor-pointer"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/signup')}
                  className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs h-9 px-4 rounded-xl shadow-sm cursor-pointer"
                >
                  Create Account <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================
          HERO BANNER (MINIMAL TEXT, HIGH IMPACT)
          ======================================================== */}
      <section className="relative pt-16 pb-16 px-4 sm:px-6 overflow-hidden border-b border-zinc-800/80">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>The Cryptographic Verification Pipeline</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            From Server Log to Blockchain Proof in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-white">
              3 Simple Steps.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-200 max-w-2xl mx-auto leading-relaxed">
            HashVault replaces vulnerable, mutable flat text logs with deterministic cryptographic commitments anchored to Ethereum.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
              className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm h-11 px-7 rounded-xl shadow-lg cursor-pointer"
            >
              {isAuthenticated ? 'Open Security Console' : 'Start Live Demo'} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Link
              to="/about"
              className="inline-flex items-center justify-center border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-colors cursor-pointer"
            >
              About the Platform <ArrowRight className="w-4 h-4 ml-1.5 text-zinc-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================
          VISUAL PIPELINE OVERVIEW (4-STAGE HORIZONTAL FLOW)
          ======================================================== */}
      <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-10">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-300">
            End-to-End Pipeline
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            How Every Event Travels
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-cyan-400 font-bold block uppercase tracking-wider">STAGE 01</span>
            <h3 className="text-base font-bold text-white">Edge Daemon</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Collector tails system logs passively with zero CPU overhead and normalizes them.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold block uppercase tracking-wider">STAGE 02</span>
            <h3 className="text-base font-bold text-white">SHA-256 Chaining</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Every event is canonically hashed and linked to the exact hash of the previous event.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800 flex items-center justify-center text-violet-400">
              <Boxes className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-violet-400 font-bold block uppercase tracking-wider">STAGE 03</span>
            <h3 className="text-base font-bold text-white">Ethereum Sepolia</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Batches of sequential logs are committed to an Ethereum smart contract Merkle root.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 relative">
            <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-amber-400 font-bold block uppercase tracking-wider">STAGE 04</span>
            <h3 className="text-base font-bold text-white">VaultAI Copilot</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Autonomous 9-node LangGraph engine investigates alerts and enforces 1-click quarantine.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          INTERACTIVE DEMO: WHAT HAPPENS WHEN LOG IS ALTERED
          ======================================================== */}
      <section className="py-16 px-4 sm:px-6 bg-zinc-900/40 border-y border-zinc-800/80">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-300">
              Interactive Tamper Demonstration
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              See Cryptographic Proof in Action
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-lg mx-auto">
              Click the button below to simulate an attacker altering just 1 character in a log file.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl font-mono text-xs">
            <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-bold">Log Record Sequence #42</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTampered(!tampered)}
                className={`text-xs h-7 px-3 cursor-pointer font-bold ${
                  tampered
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                    : 'border-red-600 bg-red-950/40 text-red-300'
                }`}
              >
                {tampered ? 'Restore Original Log' : 'Simulate Attacker Tampering'}
              </Button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <span className="text-zinc-400 text-[11px] block mb-1 font-semibold">LOG MESSAGE IN DATABASE:</span>
                <div
                  className={`p-3 rounded-lg border text-xs sm:text-sm transition-colors ${
                    tampered
                      ? 'bg-red-950/30 border-red-800 text-red-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  }`}
                >
                  {tampered
                    ? '[2026-10-15T01:20:00Z] sshd[4012]: Connection closed by user root (ALTERED BY INTRUDER)'
                    : '[2026-10-15T01:20:00Z] sshd[4012]: Accepted publickey for admin 192.168.1.100'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Calculated SHA-256 Digest</span>
                  <span className={`text-xs font-bold break-all mt-1 block ${tampered ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tampered
                      ? '0x7e8b21ac90fd834b9e81...f3a9 (MISMATCH)'
                      : '0x3a91c89e248b10fcd821...6b04 (VALID)'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Ethereum Merkle Proof</span>
                  <span className={`text-xs font-bold break-all mt-1 block ${tampered ? 'text-red-400' : 'text-cyan-400'}`}>
                    {tampered ? 'REVERTED — Root commitment diverges!' : 'CONFIRMED ON SEPOLIA (Contract Verified)'}
                  </span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  tampered
                    ? 'bg-red-950/40 border-red-700/80 text-red-200'
                    : 'bg-emerald-950/40 border-emerald-700/80 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {tampered ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <span className="font-bold">
                    {tampered ? 'TAMPERING DETECTED: Instant SOC Alert Fired' : 'INTEGRITY VERIFIED: Zero Anomalies'}
                  </span>
                </div>
                <Badge variant={tampered ? 'destructive' : 'success'} className="text-[10px] font-mono">
                  {tampered ? 'TAMPERED' : 'VERIFIED'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          BOTTOM CALL TO ACTION
          ======================================================== */}
      <section className="py-16 px-4 sm:px-6 border-t border-zinc-800 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Ready to Protect Your Infrastructure?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto">
            Enroll collector agents, run controlled attack simulations, and audit on-chain Ethereum commitments live.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
              className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm h-11 px-8 rounded-xl shadow-lg cursor-pointer"
            >
              {isAuthenticated ? 'Open Security Console' : 'Start Live Demo'} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ========================================================
          FOOTER
          ======================================================== */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">HashVault</span>
              <p className="text-xs text-zinc-400 font-mono">Every Log. Verifiable Trust.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-zinc-300">
            <Link to="/home" className="hover:text-white transition-colors">Home</Link>
            <Link to="/how-it-works" className="text-white font-bold transition-colors">How It Works</Link>
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            {isAuthenticated ? (
              <Link to="/dashboard" className="hover:text-white transition-colors">Console</Link>
            ) : (
              <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            )}
          </div>

          <div className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} HashVault. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
