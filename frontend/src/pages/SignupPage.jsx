import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  User,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Info,
} from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  // Real-time password criteria
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  // Calculate password strength score (0 to 4)
  const strengthScore = [
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSymbol && password.length >= 10,
  ].filter(Boolean).length;

  const strengthLabels = ['Too Weak', 'Weak', 'Moderate', 'Strong', 'Enterprise'];
  const strengthColors = [
    'bg-zinc-700',
    'bg-red-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-white',
  ];

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Generate initials for avatar preview
  const getInitials = (str) => {
    if (!str.trim()) return '--';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name || name.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }

    if (!email) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    if (!hasMinLength) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMessage(
        err.message || 'Registration failed. An account with this email may already exist.'
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
      <div className="w-full max-w-[440px] relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
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
              SOC Enterprise
            </span>
          </h1>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Provision analyst access to cryptographic security telemetry
          </p>
        </div>

        {/* Card */}
        <Card className="border border-zinc-800/90 bg-zinc-900/95 shadow-2xl shadow-black/80 backdrop-blur-xl rounded-2xl">
          <CardHeader className="pt-6 pb-4 px-6 border-b border-zinc-800/70">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold tracking-tight text-white">
                  Create Analyst Account
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Self-service cryptographic workstation access
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 text-emerald-400 bg-emerald-950/20 py-0.5">
                ● Role: Analyst
              </Badge>
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

              {/* Full Name Field with Live Initials Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="name" className="text-xs font-medium text-zinc-300">
                    Full Name
                  </Label>
                  {name.trim() && (
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 inline-flex items-center justify-center text-[9px] font-bold text-white">
                        {getInitials(name)}
                      </span>
                      {name.trim().split(' ')[0]}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Sarah Chen"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-10 bg-zinc-950 border-zinc-700/80 text-white placeholder:text-zinc-600 text-xs h-10 rounded-xl focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Email Address Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="text-xs font-medium text-zinc-300">
                    Work Email
                  </Label>
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
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-10 bg-zinc-950 border-zinc-700/80 text-white placeholder:text-zinc-600 text-xs h-10 rounded-xl focus:border-white focus:ring-1 focus:ring-white transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-zinc-300">
                    Master Password
                  </Label>
                  {password.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      Strength: <span className="font-semibold text-white">{strengthLabels[strengthScore]}</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-medium pt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Caps Lock is ON</span>
                  </div>
                )}

                {/* Password Strength Progress Bar */}
                {password.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            strengthScore >= step ? strengthColors[strengthScore] : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Requirements checklist pills */}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-medium pt-0.5">
                      <div className="flex items-center gap-1.5">
                        {hasMinLength ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span className={hasMinLength ? 'text-zinc-200' : 'text-zinc-500'}>
                          8+ characters
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasLetter ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span className={hasLetter ? 'text-zinc-200' : 'text-zinc-500'}>
                          Contains letter
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasNumber ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span className={hasNumber ? 'text-zinc-200' : 'text-zinc-500'}>
                          Contains number
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasSymbol ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span className={hasSymbol ? 'text-zinc-200' : 'text-zinc-500'}>
                          Symbol (recommended)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-zinc-300">
                    Confirm Password
                  </Label>
                  {passwordsMatch && (
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Passwords match
                    </span>
                  )}
                  {passwordsMismatch && (
                    <span className="text-[10px] text-red-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Does not match
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className={`pl-10 bg-zinc-950 border-zinc-700/80 text-white placeholder:text-zinc-600 text-xs h-10 rounded-xl focus:border-white focus:ring-1 focus:ring-white transition-colors font-mono ${
                      passwordsMismatch ? 'border-red-700 focus:border-red-500' : ''
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Compact Role Notice */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-2.5 text-[11px] text-zinc-400">
                <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                  Self-registered accounts receive the <strong className="text-white">Security Analyst</strong> role. Administrator privileges require delegation by an existing Admin.
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4 pb-6 px-6 border-t border-zinc-800/70">
              <Button
                type="submit"
                className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold shadow-md shadow-white/10 cursor-pointer h-10 rounded-xl text-xs transition-all duration-200"
                disabled={isSubmitting || passwordsMismatch}
                id="btn-signup-submit"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                    Provisioning Account...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Create Analyst Account <ArrowRight className="w-4 h-4 ml-0.5" />
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                <span>Already have credentials?</span>
                <Link
                  to="/login"
                  className="text-white hover:underline font-semibold ml-1 inline-flex items-center gap-1"
                >
                  Sign In <ArrowRight className="w-3 h-3" />
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
          <span>FIPS 140-3 Standard</span>
        </div>
      </div>
    </div>
  );
}
