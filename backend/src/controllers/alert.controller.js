import { Alert } from '../models/Alert.js';
import {
  acknowledgeAlert,
  resolveAlert,
} from '../services/monitoring.service.js';
import { alertEvents } from '../services/alert.service.js';
import { runMonitoringCycle, getSchedulerStatus } from '../monitoring/scheduler.js';

export const listAlerts = async (req, res, next) => {
  try {
    // Freshness check: if not evaluated in past 5s, run an evaluation cycle so manual DB alterations are caught immediately
    const scheduler = getSchedulerStatus();
    if (!scheduler.lastRunAt || Date.now() - new Date(scheduler.lastRunAt).getTime() > 5000) {
      await runMonitoringCycle().catch(() => {});
    }

    const {
      status,
      severity,
      alertType,
      serverId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }
    if (alertType && alertType !== 'ALL') {
      query.alertType = alertType;
    }
    if (serverId) {
      query.serverId = serverId;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { description: regex }, { serverName: regex }, { alertId: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({ detectedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Alert.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      alerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = await Alert.findOne({ alertId }).lean();

    if (!alert) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Alert ${alertId} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    next(error);
  }
};

export const acknowledge = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = await acknowledgeAlert(alertId, req.user);

    res.status(200).json({
      success: true,
      alert,
      message: `Alert ${alertId} acknowledged.`,
    });
  } catch (error) {
    next(error);
  }
};

export const resolve = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body || {};
    const alert = await resolveAlert(alertId, req.user, resolutionNotes);

    res.status(200).json({
      success: true,
      alert,
      message: `Alert ${alertId} resolved.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Server-Sent Events (SSE) endpoint for real-time alert streaming.
 * GET /api/alerts/stream
 */
export const streamAlerts = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const handler = (payload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // Ignored
    }
  };

  alertEvents.on('alert', handler);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    alertEvents.off('alert', handler);
  });
};
