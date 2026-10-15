import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [activeRole, setActiveRole] = useState(null);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleRoleSelect = (role) => {
    setActiveRole(role);
    setErrorMessage('');
    if (role === 'admin') {
      setEmail('admin@logsentinel.local');
      setPassword('LogSentinel@Admin2026');
    } else if (role === 'analyst') {
      setEmail('analyst@logsentinel.local');
      setPassword('LogSentinel@Analyst2026');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(
        err.message || 'Authentication failed. Please check your credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-white selection:text-black">
      {/* Eye-catching ambient light aura */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[340px] bg-gradient-to-b from-zinc-700/15 via-zinc-800/5 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-[420px] relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="relative mb-3.5 group">
            <div className="w-13 h-13 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-white shadow-xl shadow-black/50 transition-transform duration-300 group-hover:scale-105">
              <Shield className="w-6 h-6 stroke-[2.2]" />
            </div>
            {/* Pulsing online status indicator */}
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-zinc-950"></span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            HashVault
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300 border border-zinc-700/80">
              Enterprise SOC
            </span>
          </h1>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Sign in to access your cryptographic security workstation
          </p>
        </div>

        {/* Card */}
        <Card className="border border-zinc-800/90 bg-zinc-900/95 shadow-2xl shadow-black/80 backdrop-blur-xl rounded-2xl">
          <CardHeader className="pt-6 pb-4 px-6 border-b border-zinc-800/70">
            {/* Quick Demo Switcher Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  Quick Fill Profile
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">1-Click Auto-Fill</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('admin')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                    activeRole === 'admin'
                      ? 'bg-white text-zinc-950 shadow-md font-bold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <span>Administrator</span>
                  <span className={`text-[9px] font-normal ${activeRole === 'admin' ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    Full Privileges
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('analyst')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                    activeRole === 'analyst'
                      ? 'bg-white text-zinc-950 shadow-md font-bold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <span>Security Analyst</span>
                  <span className={`text-[9px] font-normal ${activeRole === 'analyst' ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    SOC Operations
                  </span>
                </button>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-5 px-6">
              {errorMessage && (
                <Alert variant="destructive" className="py-2.5 bg-red-950/40 border-red-800 text-red-200">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-xs font-medium">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="text-xs font-medium text-zinc-300">
                    Work Email
                  </Label>
                  {/* Subtle domain shortcut */}
                  <button
                    type="button"
                    onClick={() => setEmail((prev) => (prev.includes('@') ? prev : `${prev || 'analyst'}@logsentinel.local`))}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    + @logsentinel.local
                  </button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="analyst@enterprise.corp"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setActiveRole(null);
                    }}
                    disabled={isSubmitting}
                    className="pl-10 bg-zinc-950 border-zinc-700/80 text-white placeholder:text-zinc-600 text-xs h-10 rounded-xl focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-zinc-300">
                    Master Password
                  </Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setActiveRole(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyDown}
                    disabled={isSubmitting}
                    className="pl-10 pr-10 bg-zinc-950 border-zinc-700/80 text-white placeholder:text-zinc-600 text-xs h-10 rounded-xl focus:border-white focus:ring-1 focus:ring-white transition-colors font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-zinc-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* CapsLock Warning */}
                {capsLockActive && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-medium pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Caps Lock is ON</span>
                  </div>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                  />
                  <span>Remember this workstation</span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">SOC Session Guard</span>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4 pb-6 px-6 border-t border-zinc-800/70">
              <Button
                type="submit"
                className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold shadow-md shadow-white/10 cursor-pointer h-10 rounded-xl text-xs transition-all duration-200"
                disabled={isSubmitting}
                id="btn-login-submit"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                    Authenticating Session...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Sign In to Console <ArrowRight className="w-4 h-4 ml-0.5" />
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                <span>New security personnel?</span>
                <Link
                  to="/signup"
                  className="text-white hover:underline font-semibold ml-1 inline-flex items-center gap-1"
                >
                  Create Account <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Eye-catching Bottom Trust Strip */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            SHA-256 Ledger
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-zinc-400" />
            256-bit AES
          </span>
          <span>•</span>
          <span>RFC 8785 Canonical</span>
        </div>
      </div>
    </div>
  );
}
