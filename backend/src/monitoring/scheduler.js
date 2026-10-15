import { evaluateFleetMonitoring } from '../services/monitoring.service.js';

let schedulerIntervalId = null;
let isEvaluating = false;
let lastRunAt = null;
let lastRunStatus = null;
let lastRunError = null;

export const runMonitoringCycle = async () => {
  if (isEvaluating) {
    console.log('[MonitoringScheduler] Previous evaluation still in progress; skipping tick.');
    return null;
  }

  isEvaluating = true;
  try {
    const result = await evaluateFleetMonitoring();
    lastRunAt = new Date();
    lastRunStatus = 'SUCCESS';
    lastRunError = null;
    return result;
  } catch (error) {
    lastRunAt = new Date();
    lastRunStatus = 'ERROR';
    lastRunError = error.message;
    console.error(`[MonitoringScheduler] Monitoring run error: ${error.message}`);
    return null;
  } finally {
    isEvaluating = false;
  }
};

export const startMonitoringScheduler = (intervalMs = null) => {
  if (schedulerIntervalId) return;

  const interval =
    intervalMs ||
    Math.max(
      5000,
      parseInt(process.env.MONITORING_INTERVAL_MS || '15000', 10) // 15s default
    );

  // Initial run after short delay to let server initialize
  setTimeout(() => {
    runMonitoringCycle().catch(() => {});
  }, 3000);

  schedulerIntervalId = setInterval(() => {
    runMonitoringCycle().catch(() => {});
  }, interval);

  console.log(`[MonitoringScheduler] Monitoring worker started (interval: ${interval}ms)`);
};

export const stopMonitoringScheduler = () => {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log('[MonitoringScheduler] Monitoring worker stopped.');
  }
};

export const getSchedulerStatus = () => {
  return {
    isRunning: !!schedulerIntervalId,
    isEvaluating,
    lastRunAt,
    lastRunStatus,
    lastRunError,
  };
};
