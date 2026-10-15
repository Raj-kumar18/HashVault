import { Server } from '../models/Server.js';
import { Alert } from '../models/Alert.js';
import { Checkpoint } from '../models/Checkpoint.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { checkBlockchainHealth } from '../blockchain/provider.js';
import { calculateCheckpointRoot } from '../blockchain/commitment.js';
import { verifyServerChain } from './integrity.service.js';
import {
  raiseOrUpdateAlert,
  autoResolveAlert,
  acknowledgeAlert,
  resolveAlert,
} from './alert.service.js';

export {
  raiseOrUpdateAlert,
  autoResolveAlert,
  acknowledgeAlert,
  resolveAlert,
};

export const getHeartbeatThresholds = () => {
  const staleThresholdMs = Math.max(
    15000,
    parseInt(process.env.HEARTBEAT_STALE_THRESHOLD_MS || '90000', 10) // 90 seconds default
  );
  const offlineThresholdMs = Math.max(
    staleThresholdMs + 10000,
    parseInt(process.env.HEARTBEAT_OFFLINE_THRESHOLD_MS || '300000', 10) // 5 minutes default
  );
  return { staleThresholdMs, offlineThresholdMs };
};

/**
 * Computes deterministic collector health state based on actual heartbeat timestamp.
 * Returns: 'ONLINE' | 'STALE' | 'OFFLINE' | 'DISABLED' | 'UNKNOWN'
 */
export const computeCollectorHealth = (server) => {
  if (!server) return 'UNKNOWN';

  if (server.enrollmentStatus === 'DISABLED') {
    return 'DISABLED';
  }

  if (!server.lastHeartbeatAt) {
    return 'UNKNOWN';
  }

  const { staleThresholdMs, offlineThresholdMs } = getHeartbeatThresholds();
  const lastHeartbeatMs = new Date(server.lastHeartbeatAt).getTime();
  const ageMs = Date.now() - lastHeartbeatMs;

  if (ageMs > offlineThresholdMs) {
    return 'OFFLINE';
  }
  if (ageMs > staleThresholdMs) {
    return 'STALE';
  }
  return 'ONLINE';
};

/**
 * Runs a single monitoring cycle across all servers and subsystems.
 */
export const evaluateFleetMonitoring = async () => {
  const servers = await Server.find({}).sort({ createdAt: -1 });
  const findings = [];
  const { staleThresholdMs, offlineThresholdMs } = getHeartbeatThresholds();

  for (const server of servers) {
    const health = computeCollectorHealth(server);
    const staleDedupKey = `${server.serverId}:COLLECTOR_STALE`;
    const offlineDedupKey = `${server.serverId}:COLLECTOR_OFFLINE`;
    const disabledDedupKey = `${server.serverId}:COLLECTOR_DISABLED`;

    // 1. Collector Heartbeat Health Evaluation
    if (health === 'OFFLINE') {
      const ageSeconds = server.lastHeartbeatAt
        ? Math.round((Date.now() - new Date(server.lastHeartbeatAt).getTime()) / 1000)
        : null;

      await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_OFFLINE',
        severity: 'HIGH',
        title: `Collector Offline on ${server.serverName}`,
        description: `Server ${server.serverName} (${server.serverId}) has not transmitted a heartbeat for ${ageSeconds}s (threshold: ${Math.round(offlineThresholdMs / 1000)}s).`,
        serverId: server.serverId,
        serverName: server.serverName,
        serverRef: server._id,
        evidenceMetadata: {
          lastHeartbeatAt: server.lastHeartbeatAt,
          ageSeconds,
          thresholdSeconds: Math.round(offlineThresholdMs / 1000),
          hostname: server.hostname,
        },
        dedupKey: offlineDedupKey,
      });

      // Auto-resolve stale alert since it escalated to offline
      await autoResolveAlert(staleDedupKey, 'Escalated to OFFLINE.');
      findings.push({ serverId: server.serverId, type: 'COLLECTOR_OFFLINE' });
    } else if (health === 'STALE') {
      const ageSeconds = Math.round(
        (Date.now() - new Date(server.lastHeartbeatAt).getTime()) / 1000
      );

      await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_STALE',
        severity: 'MEDIUM',
        title: `Collector Stale on ${server.serverName}`,
        description: `Collector on ${server.serverName} is experiencing telemetry delivery latency (${ageSeconds}s since last heartbeat).`,
        serverId: server.serverId,
        serverName: server.serverName,
        serverRef: server._id,
        evidenceMetadata: {
          lastHeartbeatAt: server.lastHeartbeatAt,
          ageSeconds,
          thresholdSeconds: Math.round(staleThresholdMs / 1000),
        },
        dedupKey: staleDedupKey,
      });
      findings.push({ serverId: server.serverId, type: 'COLLECTOR_STALE' });
    } else if (health === 'DISABLED') {
      await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_DISABLED',
        severity: 'INFO',
        title: `Server Collector Disabled: ${server.serverName}`,
        description: `Server ${server.serverName} is explicitly decommissioned/disabled. Telemetry ingestion is prohibited.`,
        serverId: server.serverId,
        serverName: server.serverName,
        serverRef: server._id,
        evidenceMetadata: {
          disabledAt: server.disabledAt,
        },
        dedupKey: disabledDedupKey,
      });
    } else if (health === 'ONLINE') {
      // Auto-resolve any stale or offline alerts if collector resumed transmitting
      await autoResolveAlert(staleDedupKey, 'Collector heartbeat resumed within freshness window.');
      await autoResolveAlert(offlineDedupKey, 'Collector heartbeat resumed within freshness window.');
    }

    // 2. Active Cryptographic Hash Chain Audit
    let auditResult = null;
    const recordsCount = await IntegrityRecord.countDocuments({ serverId: server.serverId });

    if (recordsCount > 0) {
      try {
        auditResult = await verifyServerChain(server.serverId);
      } catch (auditErr) {
        console.error(`[FleetMonitoring] Failed to verify chain for ${server.serverId}:`, auditErr.message);
      }
    }

    const verificationStatus = auditResult ? auditResult.status : server.lastVerificationStatus;

    if (verificationStatus === 'TAMPERED') {
      const chainDedupKey = `${server.serverId}:HASH_CHAIN_MISMATCH`;
      const primaryFinding = auditResult?.findings?.find((f) => f.severity === 'CRITICAL') || auditResult?.findings?.[0];
      const desc = primaryFinding?.message
        ? `Database tampering detected on ${server.serverName}: ${primaryFinding.message}`
        : `Cryptographic SHA-256 hash chain verification failed for ${server.serverName}. Sequence records or links have been retroactively altered in MongoDB.`;

      await raiseOrUpdateAlert({
        alertType: 'HASH_CHAIN_MISMATCH',
        severity: 'CRITICAL',
        title: `Database Tampering Detected on ${server.serverName}`,
        description: desc,
        serverId: server.serverId,
        serverName: server.serverName,
        serverRef: server._id,
        relatedSequence: primaryFinding?.sequenceNumber || null,
        evidenceMetadata: {
          lastVerificationStatus: 'TAMPERED',
          lastVerifiedAt: new Date(),
          findings: auditResult?.findings || [],
          tamperedSequence: primaryFinding?.sequenceNumber,
          expected: primaryFinding?.expected,
          actual: primaryFinding?.actual,
        },
        dedupKey: chainDedupKey,
      });
      findings.push({ serverId: server.serverId, type: 'HASH_CHAIN_MISMATCH', details: auditResult?.findings });
    } else if (verificationStatus === 'INCOMPLETE') {
      const gapDedupKey = `${server.serverId}:SEQUENCE_GAP`;
      await raiseOrUpdateAlert({
        alertType: 'SEQUENCE_GAP',
        severity: 'HIGH',
        title: `Sequence Gap Detected on ${server.serverName}`,
        description: `Historical records are missing or broken between sequence boundaries on ${server.serverName}.`,
        serverId: server.serverId,
        serverName: server.serverName,
        serverRef: server._id,
        evidenceMetadata: {
          lastVerifiedRange: server.lastVerifiedRange,
          findings: auditResult?.findings || [],
        },
        dedupKey: gapDedupKey,
      });
      findings.push({ serverId: server.serverId, type: 'SEQUENCE_GAP' });
    } else if (verificationStatus === 'VERIFIED' && recordsCount > 0) {
      await autoResolveAlert(`${server.serverId}:HASH_CHAIN_MISMATCH`, 'Cryptographic hash chain verified with zero tampering.');
      await autoResolveAlert(`${server.serverId}:SEQUENCE_GAP`, 'Log sequence continuity verified.');
    }

    // 3. Active On-Chain Checkpoint Audit against current DB history
    if (verificationStatus === 'VERIFIED' && recordsCount > 0) {
      const latestConfirmedCp = await Checkpoint.findOne({
        serverId: server.serverId,
        transactionStatus: 'CONFIRMED',
      }).sort({ endSequence: -1 });

      if (latestConfirmedCp && latestConfirmedCp.checkpointRoot) {
        const cpRecords = await IntegrityRecord.find({
          serverId: server.serverId,
          sequenceNumber: { $gte: latestConfirmedCp.startSequence, $lte: latestConfirmedCp.endSequence },
        }).sort({ sequenceNumber: 1 }).lean();

        if (cpRecords.length === latestConfirmedCp.eventCount) {
          try {
            const recomputedCpRoot = calculateCheckpointRoot({
              commitmentVersion: latestConfirmedCp.commitmentVersion,
              applicationId: latestConfirmedCp.applicationId,
              serverCommitment: latestConfirmedCp.serverCommitment,
              startSequence: latestConfirmedCp.startSequence,
              endSequence: latestConfirmedCp.endSequence,
              eventCount: latestConfirmedCp.eventCount,
              startBoundaryHash: cpRecords[0].previousHash,
              endBoundaryHash: cpRecords[cpRecords.length - 1].eventHash,
            }).toLowerCase();

            if (recomputedCpRoot !== latestConfirmedCp.checkpointRoot.toLowerCase()) {
              const cpDedupKey = `${server.serverId}:CHECKPOINT_MISMATCH:${latestConfirmedCp.checkpointId}`;
              await raiseOrUpdateAlert({
                alertType: 'CHECKPOINT_MISMATCH',
                severity: 'CRITICAL',
                title: `On-Chain Checkpoint Mismatch: ${server.serverName}`,
                description: `Database records for range [#${latestConfirmedCp.startSequence} - #${latestConfirmedCp.endSequence}] diverge from immutable on-chain smart contract checkpoint root! Records have been tampered in MongoDB.`,
                serverId: server.serverId,
                serverName: server.serverName,
                serverRef: server._id,
                relatedCheckpointId: latestConfirmedCp.checkpointId,
                evidenceMetadata: {
                  checkpointId: latestConfirmedCp.checkpointId,
                  onChainRoot: latestConfirmedCp.checkpointRoot,
                  recomputedRoot: recomputedCpRoot,
                },
                dedupKey: cpDedupKey,
              });
              findings.push({ serverId: server.serverId, type: 'CHECKPOINT_MISMATCH' });
            } else {
              await autoResolveAlert(
                `${server.serverId}:CHECKPOINT_MISMATCH:${latestConfirmedCp.checkpointId}`,
                'Database records match on-chain checkpoint commitment.'
              );
            }
          } catch {
            // Non-fatal
          }
        }
      }
    }
  }

  // 3. Blockchain Checkpoints & Provider Availability Evaluation
  const rpcDedupKey = 'global:BLOCKCHAIN_UNAVAILABLE';
  try {
    const blockchainHealth = await checkBlockchainHealth();
    if (blockchainHealth.enabled) {
      if (!blockchainHealth.connected || blockchainHealth.status === 'UNAVAILABLE') {
        await raiseOrUpdateAlert({
          alertType: 'BLOCKCHAIN_UNAVAILABLE',
          severity: 'MEDIUM',
          title: 'Blockchain RPC Provider Unavailable',
          description: `HashVault cannot reach configured JSON-RPC node (${blockchainHealth.networkName || 'Ethereum'}). Checkpoint anchoring and on-chain verification are temporarily paused.`,
          evidenceMetadata: blockchainHealth,
          dedupKey: rpcDedupKey,
        });
        findings.push({ type: 'BLOCKCHAIN_UNAVAILABLE' });
      } else {
        await autoResolveAlert(rpcDedupKey, 'Blockchain RPC provider connection re-established.');
      }
    }
  } catch (err) {
    await raiseOrUpdateAlert({
      alertType: 'BLOCKCHAIN_UNAVAILABLE',
      severity: 'MEDIUM',
      title: 'Blockchain RPC Connectivity Error',
      description: `RPC connection test failed: ${err.message}.`,
      evidenceMetadata: { error: err.message },
      dedupKey: rpcDedupKey,
    });
  }

  // 4. Failed Checkpoint Transactions Evaluation
  const failedCheckpoints = await Checkpoint.find({ transactionStatus: 'FAILED' }).limit(10);
  for (const cp of failedCheckpoints) {
    const cpDedupKey = `${cp.serverId}:CHECKPOINT_TRANSACTION_FAILED:${cp.checkpointId}`;
    await raiseOrUpdateAlert({
      alertType: 'CHECKPOINT_TRANSACTION_FAILED',
      severity: 'HIGH',
      title: `Checkpoint Transaction Reverted: [${cp.startSequence} - ${cp.endSequence}]`,
      description: `Blockchain transaction for checkpoint ${cp.checkpointId.slice(0, 10)}... failed on-chain (${cp.lastErrorCode || 'REVERTED'}).`,
      serverId: cp.serverId,
      relatedCheckpointId: cp.checkpointId,
      evidenceMetadata: {
        lastErrorCode: cp.lastErrorCode,
        transactionHash: cp.transactionHash,
        startSequence: cp.startSequence,
        endSequence: cp.endSequence,
      },
      dedupKey: cpDedupKey,
    });
    findings.push({ checkpointId: cp.checkpointId, type: 'CHECKPOINT_TRANSACTION_FAILED' });
  }

  return {
    evaluatedServersCount: servers.length,
    findingsCount: findings.length,
    findings,
    evaluatedAt: new Date(),
  };
};

/**
 * Returns comprehensive system monitoring overview.
 */
export const getMonitoringOverview = async () => {
  const servers = await Server.find({}).lean();
  const { staleThresholdMs, offlineThresholdMs } = getHeartbeatThresholds();

  const healthCounts = {
    ONLINE: 0,
    STALE: 0,
    OFFLINE: 0,
    DISABLED: 0,
    UNKNOWN: 0,
  };

  let totalChainEvents = 0;

  for (const server of servers) {
    const health = computeCollectorHealth(server);
    healthCounts[health] = (healthCounts[health] || 0) + 1;
    totalChainEvents += server.chainHeadSequence || 0;
  }

  const alertCountsBySeverity = {
    CRITICAL: await Alert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'CRITICAL' }),
    HIGH: await Alert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'HIGH' }),
    MEDIUM: await Alert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'MEDIUM' }),
    LOW: await Alert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'LOW' }),
    INFO: await Alert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'INFO' }),
  };

  const totalOpenAlerts = Object.values(alertCountsBySeverity).reduce((a, b) => a + b, 0);

  const blockchainHealth = await checkBlockchainHealth();

  const recentAlerts = await Alert.find({})
    .sort({ detectedAt: -1 })
    .limit(5)
    .lean();

  return {
    collectorHealth: healthCounts,
    totalServers: servers.length,
    totalChainEvents,
    openAlertsCount: totalOpenAlerts,
    alertsBySeverity: alertCountsBySeverity,
    thresholds: {
      staleSeconds: Math.round(staleThresholdMs / 1000),
      offlineSeconds: Math.round(offlineThresholdMs / 1000),
    },
    blockchainHealth,
    recentAlerts,
    generatedAt: new Date(),
  };
};

/**
 * Returns detailed per-server monitoring records.
 */
export const getMonitoredServers = async () => {
  const servers = await Server.find({}).sort({ serverName: 1 }).lean();

  return servers.map((server) => {
    const health = computeCollectorHealth(server);
    const lastHeartbeatAgeSeconds = server.lastHeartbeatAt
      ? Math.round((Date.now() - new Date(server.lastHeartbeatAt).getTime()) / 1000)
      : null;

    return {
      serverId: server.serverId,
      serverName: server.serverName,
      hostname: server.hostname,
      os: server.os,
      environment: server.environment,
      enrollmentStatus: server.enrollmentStatus,
      collectorHealth: health,
      lastHeartbeatAt: server.lastHeartbeatAt,
      lastHeartbeatAgeSeconds,
      chainHeadSequence: server.chainHeadSequence || 0,
      chainHeadHash: server.chainHeadHash,
      lastVerificationStatus: server.lastVerificationStatus || 'NOT_VERIFIED',
      lastVerifiedAt: server.lastVerifiedAt,
      disabledAt: server.disabledAt,
    };
  });
};
