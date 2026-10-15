import { Server } from '../models/Server.js';
import { Alert } from '../models/Alert.js';
import { Checkpoint } from '../models/Checkpoint.js';
import { LogEvent } from '../models/LogEvent.js';
import { computeCollectorHealth, getHeartbeatThresholds } from '../services/monitoring.service.js';
import { checkBlockchainHealth } from '../blockchain/provider.js';
import { runMonitoringCycle, getSchedulerStatus } from '../monitoring/scheduler.js';

/**
 * Controller for comprehensive, real-time Security Operations Center Overview.
 * Aggregates only real persisted data across servers, logs, alerts, integrity, and blockchain.
 * Zero fabricated numbers, decorative mock stats, or fake live feeds.
 *
 * GET /api/overview
 */
export const getSecurityOverview = async (req, res, next) => {
  try {
    const scheduler = getSchedulerStatus();
    if (!scheduler.lastRunAt || Date.now() - new Date(scheduler.lastRunAt).getTime() > 5000) {
      await runMonitoringCycle().catch(() => {});
    }

    const userFilter = req.user ? { ownerId: req.user._id } : {};

    // 1. Fetch user-scoped servers
    const servers = await Server.find(userFilter).lean();
    const serverIds = servers.map((s) => s.serverId);

    // 2. Compute collector health breakdown
    const healthCounts = {
      ONLINE: 0,
      STALE: 0,
      OFFLINE: 0,
      DISABLED: 0,
      UNKNOWN: 0,
    };

    let latestVerifiedServer = null;

    const serverHealthList = servers.map((srv) => {
      const health = computeCollectorHealth(srv);
      healthCounts[health] = (healthCounts[health] || 0) + 1;

      if (
        srv.lastVerifiedAt &&
        (!latestVerifiedServer || new Date(srv.lastVerifiedAt) > new Date(latestVerifiedServer.lastVerifiedAt))
      ) {
        latestVerifiedServer = {
          serverId: srv.serverId,
          serverName: srv.serverName,
          status: srv.lastVerificationStatus,
          timestamp: srv.lastVerifiedAt,
          range: srv.lastVerifiedRange,
        };
      }

      const lastHeartbeatAgeSeconds = srv.lastHeartbeatAt
        ? Math.round((Date.now() - new Date(srv.lastHeartbeatAt).getTime()) / 1000)
        : null;

      return {
        serverId: srv.serverId,
        serverName: srv.serverName,
        hostname: srv.hostname,
        environment: srv.environment,
        collectorHealth: health,
        lastHeartbeatAt: srv.lastHeartbeatAt,
        lastHeartbeatAgeSeconds,
        chainHeadSequence: srv.chainHeadSequence || 0,
        lastVerificationStatus: srv.lastVerificationStatus || 'NOT_VERIFIED',
        lastVerifiedAt: srv.lastVerifiedAt || null,
      };
    });

    // 3. Log events counts (total and 24h)
    const logScope = serverIds.length > 0 ? { serverId: { $in: serverIds } } : { serverId: { $in: [] } };
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalEvents, events24h] = serverIds.length > 0
      ? await Promise.all([
          LogEvent.countDocuments(logScope),
          LogEvent.countDocuments({ ...logScope, ingestedAt: { $gte: oneDayAgo } }),
        ])
      : [0, 0];

    // 4. Alerts calculation
    const alertScope = serverIds.length > 0
      ? { serverId: { $in: serverIds } }
      : { serverId: { $in: [] } };

    const [openAlerts, alertCountsBySeverity, recentAlerts] = serverIds.length > 0
      ? await Promise.all([
          Alert.countDocuments({ ...alertScope, status: { $in: ['OPEN', 'ACKNOWLEDGED'] } }),
          Promise.all([
            Alert.countDocuments({ ...alertScope, status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'CRITICAL' }),
            Alert.countDocuments({ ...alertScope, status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'HIGH' }),
            Alert.countDocuments({ ...alertScope, status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'MEDIUM' }),
            Alert.countDocuments({ ...alertScope, status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'LOW' }),
            Alert.countDocuments({ ...alertScope, status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'INFO' }),
          ]),
          Alert.find(alertScope).sort({ detectedAt: -1 }).limit(6).lean(),
        ])
      : [0, [0, 0, 0, 0, 0], []];

    const alertsSeverityMap = {
      CRITICAL: alertCountsBySeverity[0],
      HIGH: alertCountsBySeverity[1],
      MEDIUM: alertCountsBySeverity[2],
      LOW: alertCountsBySeverity[3],
      INFO: alertCountsBySeverity[4],
    };

    // 5. Blockchain Checkpoints stats
    const checkpointScope = serverIds.length > 0 ? { serverId: { $in: serverIds } } : { serverId: { $in: [] } };
    const [confirmedCheckpoints, totalCheckpoints, blockchainHealth] = await Promise.all([
      serverIds.length > 0 ? Checkpoint.countDocuments({ ...checkpointScope, transactionStatus: 'CONFIRMED' }) : 0,
      serverIds.length > 0 ? Checkpoint.countDocuments(checkpointScope) : 0,
      checkBlockchainHealth(),
    ]);

    // 6. Hourly log ingestion volume for last 24h (Real time-series data)
    let hourlyIngestion = [];
    try {
      const hourlyAggregation = await LogEvent.aggregate([
        { $match: { ...logScope, ingestedAt: { $gte: oneDayAgo } } },
        {
          $group: {
            _id: {
              year: { $year: '$ingestedAt' },
              month: { $month: '$ingestedAt' },
              day: { $dayOfMonth: '$ingestedAt' },
              hour: { $hour: '$ingestedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
      ]);

      hourlyIngestion = hourlyAggregation.map((b) => ({
        hour: `${String(b._id.hour).padStart(2, '0')}:00`,
        count: b.count,
      }));
    } catch {
      hourlyIngestion = [];
    }

    // 7. Real Persisted Activity Timeline
    // Aggregates real actions from: Alerts, Checkpoints, Servers, and recent Batches
    const timelineItems = [];

    // Recent alerts activity
    for (const alt of recentAlerts) {
      timelineItems.push({
        id: `act_${alt.alertId}`,
        type: 'SECURITY_ALERT',
        title: alt.title,
        description: alt.description,
        timestamp: alt.detectedAt,
        severity: alt.severity,
        status: alt.status,
        source: alt.serverName || alt.serverId || 'System Engine',
        entityId: alt.alertId,
        entityType: 'alert',
      });
    }

    // Recent checkpoints
    const recentCheckpoints = await Checkpoint.find(checkpointScope)
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    for (const cp of recentCheckpoints) {
      timelineItems.push({
        id: `act_${cp.checkpointId}`,
        type: 'BLOCKCHAIN_CHECKPOINT',
        title: `Checkpoint ${cp.checkpointId.slice(0, 12)}... (${cp.transactionStatus})`,
        description: `Sequences [${cp.startSequence} - ${cp.endSequence}] anchored to blockchain. Block: ${cp.blockNumber || 'Pending'}`,
        timestamp: cp.createdAt,
        severity: cp.transactionStatus === 'CONFIRMED' ? 'INFO' : cp.transactionStatus === 'FAILED' ? 'HIGH' : 'LOW',
        status: cp.transactionStatus,
        source: cp.serverId,
        entityId: cp.checkpointId,
        entityType: 'checkpoint',
      });
    }

    // Recent server creations or changes
    for (const s of servers.slice(0, 5)) {
      if (s.createdAt) {
        timelineItems.push({
          id: `act_srv_${s.serverId}`,
          type: 'SERVER_ENROLLMENT',
          title: `Server Registered: ${s.serverName}`,
          description: `Host ${s.hostname} (${s.environment}) enrolled into fleet inventory.`,
          timestamp: s.createdAt,
          severity: 'INFO',
          status: s.enrollmentStatus,
          source: s.serverName,
          entityId: s.serverId,
          entityType: 'server',
        });
      }
    }

    // Sort combined real timeline descending by timestamp
    timelineItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivity = timelineItems.slice(0, 15);

    res.json({
      success: true,
      metrics: {
        totalServers: servers.length,
        collectorHealth: healthCounts,
        onlineCollectors: healthCounts.ONLINE,
        staleCollectors: healthCounts.STALE,
        offlineCollectors: healthCounts.OFFLINE,
        disabledCollectors: healthCounts.DISABLED,
        unknownCollectors: healthCounts.UNKNOWN,
        openAlerts,
        alertsBySeverity: alertsSeverityMap,
        totalEvents,
        events24h,
        confirmedCheckpoints,
        totalCheckpoints,
        latestVerification: latestVerifiedServer,
        blockchainStatus: blockchainHealth.status || 'UNAVAILABLE',
        blockchainConnected: blockchainHealth.connected || false,
      },
      serverHealthList,
      recentAlerts,
      recentActivity,
      hourlyIngestion,
      generatedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
};
