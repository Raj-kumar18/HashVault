import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-white selection:text-black">
      
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
                  Enterprise SOC
                </span>
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-zinc-300">
            <Link to="/home" className="text-white font-bold transition-colors">
              Home
            </Link>
            <Link to="/how-it-works" className="text-zinc-300 hover:text-white transition-colors">
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
          HERO SECTION (ONLY SECTION ON HOMEPAGE)
          ======================================================== */}
      <main className="relative flex-1 flex flex-col justify-center py-16 px-4 sm:px-6 overflow-hidden">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[360px] bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6 w-full">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Every Server Log.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-white">
              Cryptographically Sealed.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-200 max-w-2xl mx-auto leading-relaxed font-normal">
            Every log line is cryptographically chained and anchored to Ethereum. 
            Attackers cannot alter history—even with full root access.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
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
              About Platform <ArrowRight className="w-4 h-4 ml-1.5 text-zinc-400" />
            </Link>
          </div>

          {/* Visual Live Ledger Mockup */}
          <div className="pt-6 max-w-3xl mx-auto text-left">
            <div className="rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden font-mono text-xs">
              {/* Terminal Titlebar */}
              <div className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-zinc-400 text-[11px] ml-2 font-medium">hashvault-ledger — live telemetry stream</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Chain Nominal</span>
                </div>
              </div>

              {/* Terminal Event Lines */}
              <div className="p-4 space-y-2.5 bg-zinc-950/90">
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-emerald-400 font-bold">#28</span>
                    <span className="text-zinc-300 truncate">[14:24:29Z] sshd[3804]: Accepted publickey for admin 185.220.101.5</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded shrink-0">SHA-256 SEALED</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-emerald-400 font-bold">#29</span>
                    <span className="text-zinc-300 truncate">[14:24:35Z] sudo: devops : TTY=pts/0 ; /usr/bin/systemctl restart nginx</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded shrink-0">SHA-256 SEALED</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/50 text-cyan-200">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-cyan-400 font-bold">ANCHOR</span>
                    <span className="truncate">Ethereum Sepolia Rollup: Merkle Root 0xbdc2...058e</span>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded shrink-0">ON-CHAIN VERIFIED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics (4 Compact Cards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-left">
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold block">Integrity</span>
              <div className="text-sm font-bold text-white mt-0.5">SHA-256 Chained</div>
              <span className="text-[11px] text-emerald-400 font-mono">Tamper-Evident</span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold block">Consensus</span>
              <div className="text-sm font-bold text-white mt-0.5">Ethereum Proofs</div>
              <span className="text-[11px] text-cyan-400 font-mono">Sepolia Anchored</span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold block">Investigation</span>
              <div className="text-sm font-bold text-white mt-0.5">VaultAI Copilot</div>
              <span className="text-[11px] text-cyan-400 font-mono">Zero Hallucination</span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold block">Defense</span>
              <div className="text-sm font-bold text-white mt-0.5">1-Click Quarantine</div>
              <span className="text-[11px] text-red-400 font-mono">Instant Containment</span>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================
          FOOTER
          ======================================================== */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
