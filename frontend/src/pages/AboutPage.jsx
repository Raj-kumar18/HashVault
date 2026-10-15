import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  Lock,
  Sparkles,
  ArrowRight,
  Boxes,
  Terminal,
  Database,
  Cpu,
  CheckCircle2,
  FileCheck,
  Eye,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function AboutPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

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
                  About
                </span>
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-zinc-300">
            <Link to="/home" className="text-zinc-300 hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/how-it-works" className="text-zinc-300 hover:text-white transition-colors">
              How It Works
            </Link>
            <Link to="/about" className="text-white font-bold transition-colors">
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
          HERO / MISSION STATEMENT (CONCISE, HIGH CONTRAST)
          ======================================================== */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 border-b border-zinc-800/80 overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>The HashVault Mission</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Proving What Happened When{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-white">
              Every Second Matters.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-200 max-w-2xl mx-auto leading-relaxed font-normal">
            Traditional server logs are mutable text files that intruders easily erase. 
            <strong className="text-white font-semibold"> HashVault</strong> turns every log into a cryptographically sealed, immutable record anchored to the blockchain.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
              className="bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm h-11 px-6 rounded-xl shadow-lg cursor-pointer"
            >
              {isAuthenticated ? 'Open Security Console' : 'Launch Live Demo'} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Link
              to="/home"
              className="inline-flex items-center justify-center border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-colors cursor-pointer"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================
          CORE PROBLEM & SOLUTION (3 COMPACT CARDS)
          ======================================================== */}
      <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-300">
            Why HashVault Exists
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            The Trust Gap in Modern Logging
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">The Root Dilemma</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              If an attacker gains root or database access, they can alter timestamps, delete records, and fabricate audit trails with zero traces.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Mathematical Sealing</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              HashVault binds every event to its predecessor using SHA-256 hash chains. Modifying a single character invalidates all subsequent proofs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/80 flex items-center justify-center text-violet-400">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">External Consensus</h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Batches are rolled into Merkle root commitments anchored to Ethereum smart contracts, delivering independent third-party auditability.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          ENGINEERING PRINCIPLES (HIGH CONTRAST, BULLET CARDS)
          ======================================================== */}
      <section className="py-16 px-4 sm:px-6 max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-300">
            Design Philosophy
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Our Core Security Principles
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Deterministic Verification</h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Zero guesswork. The SHA-256 hash either verifies or fails. Integrity is a binary mathematical fact.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Zero AI Hallucinations</h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                VaultAI is constrained to cite concrete telemetry events. It never fabricates incidents or proofs.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-violet-950 border border-violet-800 flex items-center justify-center text-violet-400 shrink-0 mt-0.5">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Secret Sanitization</h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Passwords, session cookies, and private tokens are redacted before ingestion and AI analysis.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Low-Footprint Collection</h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Lightweight Node collector tails `/var/log` passively without slowing down production workloads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          BOTTOM CTA BANNER
          ======================================================== */}
      <section className="py-16 px-4 sm:px-6 border-t border-zinc-800 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Experience HashVault Live
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto">
            Test attack simulations, verify Ethereum smart contracts, and explore real-time telemetry in the security console.
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
            <Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
            <Link to="/about" className="text-white font-bold transition-colors">About</Link>
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
