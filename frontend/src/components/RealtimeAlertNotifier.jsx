import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  X,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from './ui/button';
import { apiGetAlerts } from '../utils/api';

/**
 * Synthesizes a gentle, single dual-tone SOC warning chime.
 * Only called once per new incident when sound is explicitly enabled.
 */
function playSocAlarmChirp() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First pulse (784Hz - G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    osc1.frequency.exponentialRampToValueAtTime(392, now + 0.1);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Second pulse (987.77Hz - B5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(493.88, now + 0.22);
    gain2.gain.setValueAtTime(0.08, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.22);

    // Close audio context after playback to avoid background audio thread retention
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // Ignore
      }
    }, 400);
  } catch {
    // Non-fatal
  }
}

export default function RealtimeAlertNotifier({ onAlertEvent = null }) {
  const navigate = useNavigate();
  const [activeAlert, setActiveAlert] = useState(null);
  // Default sound to FALSE to ensure zero background buzzing
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const dismissedAlertIdsRef = useRef(new Set());
  const soundPlayedAlertIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  // Load dismissed alert IDs from localStorage (and fallback to sessionStorage)
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem('hashvault_dismissed_alerts') ||
        sessionStorage.getItem('hashvault_dismissed_alerts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          dismissedAlertIdsRef.current = new Set(parsed);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Dismiss handler: permanently silences and hides this alert across tabs and refreshes
  const handleDismiss = useCallback((alertId = null) => {
    setIsVisible(false);
    setActiveAlert(null);

    if (alertId) {
      dismissedAlertIdsRef.current.add(alertId);
    }

    try {
      localStorage.setItem(
        'hashvault_dismissed_alerts',
        JSON.stringify(Array.from(dismissedAlertIdsRef.current))
      );
    } catch {
      // Ignore
    }
  }, []);

  // Listen for local alert actions (e.g. Ack or Resolve clicked from Alerts Center)
  useEffect(() => {
    const handleLocalAlertAction = (e) => {
      const { alertId } = e.detail || {};
      if (alertId) {
        handleDismiss(alertId);
      }
    };
    window.addEventListener('hashvault:alert-action', handleLocalAlertAction);
    return () => window.removeEventListener('hashvault:alert-action', handleLocalAlertAction);
  }, [handleDismiss]);

  const triggerNotification = useCallback(
    (alert) => {
      if (!alert?.alertId || alert.status !== 'OPEN') return;

      // NEVER show or sound if user dismissed, acknowledged, or resolved this alert ID
      if (dismissedAlertIdsRef.current.has(alert.alertId)) {
        return;
      }

      setActiveAlert(alert);
      setIsVisible(true);

      // Sound ONLY plays if explicitly enabled AND has NOT played yet for this alert
      if (soundEnabled && !soundPlayedAlertIdsRef.current.has(alert.alertId)) {
        soundPlayedAlertIdsRef.current.add(alert.alertId);
        playSocAlarmChirp();
      }

      if (onAlertEvent) {
        onAlertEvent(alert);
      }
    },
    [soundEnabled, onAlertEvent]
  );

  // 1. Establish SSE Connection for instant sub-second delivery
  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/alerts/stream');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // If an alert was acknowledged, resolved, or marked non-open, immediately hide notification
            if (
              data.type === 'ALERT_RESOLVED' ||
              data.type === 'ALERT_ACKNOWLEDGED' ||
              (data.alert && data.alert.status !== 'OPEN')
            ) {
              if (data.alert?.alertId) {
                dismissedAlertIdsRef.current.add(data.alert.alertId);
                try {
                  localStorage.setItem(
                    'hashvault_dismissed_alerts',
                    JSON.stringify(Array.from(dismissedAlertIdsRef.current))
                  );
                } catch {
                  // Ignore
                }
              }
              setActiveAlert((current) => {
                if (current?.alertId === data.alert?.alertId) {
                  setIsVisible(false);
                  return null;
                }
                return current;
              });
              return;
            }

            if (data.type === 'ALERT_RAISED' || data.type === 'ALERT_UPDATED') {
              const alert = data.alert;
              if (!alert || alert.status !== 'OPEN') return;

              // If dismissed or acknowledged, ignore completely
              if (dismissedAlertIdsRef.current.has(alert.alertId)) {
                return;
              }

              const isTamper =
                alert.alertType === 'HASH_CHAIN_MISMATCH' ||
                alert.alertType === 'CHECKPOINT_MISMATCH' ||
                alert.alertType === 'SEQUENCE_GAP';
              const isCritical = alert.severity === 'CRITICAL' || isTamper;

              if (isCritical) {
                triggerNotification(alert);
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimeout = setTimeout(connectSSE, 8000);
        };
      } catch {
        // SSE not supported
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [triggerNotification]);

  // 2. Polling Fallback (every 5 seconds)
  useEffect(() => {
    const pollAlerts = async () => {
      try {
        const res = await apiGetAlerts({ status: 'OPEN', limit: 5 });
        const openAlerts = res?.alerts || [];

        for (const alert of openAlerts) {
          if (dismissedAlertIdsRef.current.has(alert.alertId)) {
            continue; // Already dismissed, acknowledged or resolved by user
          }

          const isTamper =
            alert.alertType === 'HASH_CHAIN_MISMATCH' ||
            alert.alertType === 'CHECKPOINT_MISMATCH' ||
            alert.alertType === 'SEQUENCE_GAP';
          const isCritical = alert.severity === 'CRITICAL' || isTamper;

          if (isCritical) {
            if (!isInitialLoadRef.current) {
              triggerNotification(alert);
            }
          }
        }
        isInitialLoadRef.current = false;
      } catch {
        // Non-fatal
      }
    };

    pollAlerts();
    const interval = setInterval(pollAlerts, 5000);
    return () => clearInterval(interval);
  }, [triggerNotification]);

  if (!isVisible || !activeAlert) {
    return null;
  }

  const isTamper =
    activeAlert.alertType === 'HASH_CHAIN_MISMATCH' ||
    activeAlert.alertType === 'CHECKPOINT_MISMATCH' ||
    activeAlert.alertType === 'SEQUENCE_GAP';

  return (
    <div
      className="fixed top-4 right-4 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300 select-none"
      id="realtime-alert-notification"
    >
      <div className="rounded-2xl border-2 border-red-500/90 bg-zinc-950/95 backdrop-blur-2xl p-4 shadow-2xl shadow-red-950/80 ring-2 ring-red-500/30 text-zinc-100">
        {/* Banner Top Bar */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-900/40">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-xs font-mono font-bold tracking-wider text-red-400 uppercase">
              {isTamper ? '🚨 REAL-TIME TAMPERING DETECTED' : '🚨 CRITICAL SECURITY ALERT'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSoundEnabled((prev) => {
                  const nextState = !prev;
                  if (nextState) {
                    playSocAlarmChirp();
                  }
                  return nextState;
                });
              }}
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title={soundEnabled ? 'Alarm Sound: Enabled (click to mute)' : 'Alarm Sound: Muted (click to enable)'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </button>
            <button
              onClick={() => handleDismiss(activeAlert.alertId)}
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Close and dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-600/60 flex items-center justify-center shrink-0 text-red-400 mt-0.5">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white leading-tight">
                {activeAlert.title}
              </h4>
              <p className="text-xs text-zinc-300 mt-1 line-clamp-2 leading-relaxed">
                {activeAlert.description}
              </p>
            </div>
          </div>

          {/* Asset & Sequence Tag */}
          <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-zinc-400">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold truncate">
              {activeAlert.serverName || activeAlert.serverId || 'Host'}
            </span>
            {activeAlert.relatedSequence && (
              <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-800/50 text-red-300 font-bold">
                Seq #{activeAlert.relatedSequence}
              </span>
            )}
            <span className="text-[10px] text-zinc-500 ml-auto">
              {activeAlert.occurrenceCount > 1 ? `${activeAlert.occurrenceCount}x detected` : 'Just now'}
            </span>
          </div>

          {/* Action CTAs */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => {
                handleDismiss(activeAlert.alertId);
                navigate('/alerts');
              }}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-8 rounded-lg cursor-pointer shadow-md"
            >
              Alerts <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                handleDismiss(activeAlert.alertId);
                navigate('/ai');
              }}
              className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs h-8 rounded-lg cursor-pointer"
            >
              <Sparkles className="w-3 h-3 mr-1 text-cyan-400" />
              VaultAI
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDismiss(activeAlert.alertId)}
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 text-xs h-8 rounded-lg cursor-pointer"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
