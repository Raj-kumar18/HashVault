import { EventEmitter } from 'node:events';
import { Alert } from '../models/Alert.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { LogEvent } from '../models/LogEvent.js';

export const alertEvents = new EventEmitter();
// Allow multiple SSE clients without warning
alertEvents.setMaxListeners(100);

/**
 * Creates or updates an active alert using a deduplication key.
 * Prevents alert fatigue and infinite duplication of ongoing incidents.
 */
export const raiseOrUpdateAlert = async ({
  alertType,
  severity = 'MEDIUM',
  title,
  description,
  serverId = null,
  serverName = null,
  serverRef = null,
  relatedSequence = null,
  relatedCheckpointId = null,
  evidenceMetadata = {},
  dedupKey,
}) => {
  if (!dedupKey) {
    dedupKey = `${serverId || 'global'}:${alertType}:${relatedSequence || relatedCheckpointId || 'active'}`;
  }

  // 1. Check if an alert with this dedupKey is currently OPEN or ACKNOWLEDGED
  let activeAlert = await Alert.findOne({
    dedupKey,
    status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
  });

  if (activeAlert) {
    activeAlert.occurrenceCount += 1;
    activeAlert.lastOccurredAt = new Date();
    activeAlert.evidenceMetadata = evidenceMetadata;
    // Upgrade severity if new evidence is more severe
    if (severity === 'CRITICAL' && activeAlert.severity !== 'CRITICAL') {
      activeAlert.severity = 'CRITICAL';
    }
    await activeAlert.save();

    alertEvents.emit('alert', {
      type: 'ALERT_UPDATED',
      isNew: false,
      alert: activeAlert.toObject ? activeAlert.toObject() : activeAlert,
    });

    return { alert: activeAlert, isNew: false };
  }

  // 2. Check if this incident was already investigated & marked RESOLVED
  // Do NOT automatically resurrect or spam a new OPEN alert if it was resolved
  const resolvedAlert = await Alert.findOne({
    dedupKey,
    status: 'RESOLVED',
  }).sort({ resolvedAt: -1, detectedAt: -1 });

  if (resolvedAlert) {
    resolvedAlert.occurrenceCount += 1;
    resolvedAlert.lastOccurredAt = new Date();
    resolvedAlert.evidenceMetadata = evidenceMetadata;
    await resolvedAlert.save();

    return { alert: resolvedAlert, isNew: false };
  }

  // 3. Create fresh open alert if none currently exists
  const newAlert = await Alert.create({
    alertType,
    severity,
    status: 'OPEN',
    title,
    description,
    serverId,
    serverName,
    serverRef,
    relatedSequence,
    relatedCheckpointId,
    evidenceMetadata,
    dedupKey,
    detectedAt: new Date(),
    lastOccurredAt: new Date(),
    occurrenceCount: 1,
  });

  alertEvents.emit('alert', {
    type: 'ALERT_RAISED',
    isNew: true,
    alert: newAlert.toObject ? newAlert.toObject() : newAlert,
  });

  return { alert: newAlert, isNew: true };
};

/**
 * Automatically resolves an active alert when the condition has cleared.
 */
export const autoResolveAlert = async (dedupKey, resolutionNotes = 'Condition automatically cleared.') => {
  const activeAlert = await Alert.findOne({
    dedupKey,
    status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
  });

  if (activeAlert) {
    activeAlert.status = 'RESOLVED';
    activeAlert.resolvedAt = new Date();
    activeAlert.resolutionNotes = resolutionNotes;
    await activeAlert.save();

    alertEvents.emit('alert', {
      type: 'ALERT_RESOLVED',
      alert: activeAlert.toObject ? activeAlert.toObject() : activeAlert,
    });

    return activeAlert;
  }
  return null;
};

/**
 * Acknowledges an active alert. Accessible by Admin and Security Analyst.
 */
export const acknowledgeAlert = async (alertId, user) => {
  const alert = await Alert.findOne({ alertId });
  if (!alert) {
    throw new Error(`Alert ${alertId} not found`);
  }

  if (alert.status === 'RESOLVED') {
    throw new Error('Cannot acknowledge a resolved alert.');
  }

  alert.status = 'ACKNOWLEDGED';
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = user?._id || null;
  alert.acknowledgedByName = user?.name || user?.email || 'User';
  await alert.save();

  alertEvents.emit('alert', {
    type: 'ALERT_ACKNOWLEDGED',
    alert: alert.toObject ? alert.toObject() : alert,
  });

  return alert;
};

/**
 * Resolves an active alert. Accessible by Admin and Security Analyst.
 * Automatically reconciles any cross-collection tampered LogEvent back to sealed IntegrityRecord truth.
 */
export const resolveAlert = async (alertId, user, resolutionNotes = 'Investigated and marked resolved.') => {
  const alert = await Alert.findOne({ alertId });
  if (!alert) {
    throw new Error(`Alert ${alertId} not found`);
  }

  alert.status = 'RESOLVED';
  alert.resolvedAt = new Date();
  alert.resolvedBy = user?._id || null;
  alert.resolvedByName = user?.name || user?.email || 'User';
  alert.resolutionNotes = resolutionNotes;
  await alert.save();

  // If this alert was due to cross-collection tampering or database log mismatch,
  // reconcile/heal the LogEvent with the cryptographically sealed IntegrityRecord
  try {
    const seq = alert.relatedSequence || alert.evidenceMetadata?.tamperedSequence;
    if (alert.serverId && seq) {
      const integrityRec = await IntegrityRecord.findOne({
        serverId: alert.serverId,
        sequenceNumber: seq,
      }).lean();

      if (integrityRec) {
        await LogEvent.updateOne(
          { serverId: alert.serverId, sequenceNumber: seq },
          {
            $set: {
              message: integrityRec.message,
              eventHash: integrityRec.eventHash,
            },
          }
        );
      }

      // Re-verify the server chain to update server verification status from TAMPERED to VERIFIED
      const { verifyServerChain } = await import('./integrity.service.js');
      await verifyServerChain(alert.serverId).catch(() => {});
    }
  } catch (healErr) {
    console.warn('[AlertService] Failed to auto-reconcile log event on resolve:', healErr.message);
  }

  alertEvents.emit('alert', {
    type: 'ALERT_RESOLVED',
    alert: alert.toObject ? alert.toObject() : alert,
  });

  return alert;
};

