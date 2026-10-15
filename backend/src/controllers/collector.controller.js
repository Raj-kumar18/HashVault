import crypto from 'crypto';
import { EnrollmentToken } from '../models/EnrollmentToken.js';
import { Server } from '../models/Server.js';
import { LogEvent } from '../models/LogEvent.js';
import { appendBatchToChain } from '../services/integrity.service.js';

/**
 * Exchange an enrollment token for a server-specific collector credential.
 * POST /api/collector/enroll
 */
export const enrollCollector = async (req, res, next) => {
  try {
    const { token, serverId } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Enrollment token is required.',
      });
    }

    const cleanToken = token.trim();
    const tokenHash = EnrollmentToken.hashToken(cleanToken);

    // Atomically find, validate and consume token to prevent race conditions & double-use
    const tokenDoc = await EnrollmentToken.findOneAndUpdate(
      {
        tokenHash,
        isConsumed: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          isConsumed: true,
          consumedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!tokenDoc) {
      // Diagnostic check for precise security feedback
      const existingToken = await EnrollmentToken.findOne({ tokenHash });
      if (!existingToken) {
        return res.status(400).json({
          error: 'InvalidToken',
          message: 'The enrollment token is invalid.',
        });
      }

      if (existingToken.isConsumed) {
        return res.status(400).json({
          error: 'TokenAlreadyConsumed',
          message: 'The enrollment token has already been consumed. Tokens are strictly single-use.',
        });
      }

      if (existingToken.expiresAt <= new Date()) {
        return res.status(400).json({
          error: 'TokenExpired',
          message: 'The enrollment token has expired. Please generate a new token from the dashboard.',
        });
      }

      return res.status(400).json({
        error: 'InvalidToken',
        message: 'The enrollment token could not be verified.',
      });
    }

    // If serverId was provided by client, confirm it matches the token binding
    if (serverId && typeof serverId === 'string' && serverId.trim() !== tokenDoc.serverId) {
      return res.status(400).json({
        error: 'TokenMismatch',
        message: 'Enrollment token is not bound to the specified server identifier.',
      });
    }

    // Retrieve server and verify it is not disabled
    const server = await Server.findById(tokenDoc.serverRef);
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'The server bound to this token no longer exists.',
      });
    }

    if (server.enrollmentStatus === 'DISABLED') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This server is disabled. Collector enrollment is prohibited.',
      });
    }

    // Generate random server-specific collector credential (col_sec_ + 32 random bytes hex)
    const rawCredential = `col_sec_${crypto.randomBytes(32).toString('hex')}`;
    const credentialHash = crypto.createHash('sha256').update(rawCredential).digest('hex');

    // Update server with credential hash and mark enrolled
    server.credentialHash = credentialHash;
    server.enrollmentStatus = 'ENROLLED';
    server.connectionStatus = 'UNKNOWN'; // Do not declare online until actual heartbeat in Phase 3
    server.credentialVersion = (server.credentialVersion || 1) + 1;
    await server.save();

    console.log(`[Audit] Collector successfully enrolled for server ${server.serverId} (credential v${server.credentialVersion})`);

    // Return the raw credential ONLY ONCE over this TLS-protected enrollment response
    res.status(200).json({
      success: true,
      message: 'Collector enrolled successfully.',
      serverId: server.serverId,
      serverName: server.serverName,
      credential: rawCredential,
      credentialVersion: server.credentialVersion,
      instructions:
        'Store this collector credential securely in your collector configuration (e.g., /etc/logsentinel/collector.env). This credential is required for Phase 3 heartbeat and log streaming.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ingest a batch of normalized log events from an authenticated collector agent.
 * POST /api/collector/logs
 */
export const ingestLogs = async (req, res, next) => {
  try {
    const server = req.server;
    const { batchId, events, sentAt } = req.body;

    if (!batchId || typeof batchId !== 'string' || !batchId.trim()) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'batchId is required and must be a valid string.',
      });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'events must be a non-empty array of normalized log records.',
      });
    }

    if (events.length > 500) {
      return res.status(400).json({
        error: 'PayloadTooLarge',
        message: 'Maximum batch size is 500 events per ingestion request.',
      });
    }

    // Validate individual event items
    const preparedEvents = [];
    const candidateEventIds = [];

    for (let i = 0; i < events.length; i++) {
      const item = events[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Event at index ${i} must be a valid object.`,
        });
      }

      if (!item.source || typeof item.source !== 'string') {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Event at index ${i} is missing required string property 'source'.`,
        });
      }

      if (typeof item.message !== 'string') {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Event at index ${i} is missing required string property 'message'.`,
        });
      }

      const observedAt = item.observedAt ? new Date(item.observedAt) : new Date();
      if (isNaN(observedAt.getTime())) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Event at index ${i} has invalid date property 'observedAt'.`,
        });
      }

      const eventId =
        item.eventId && typeof item.eventId === 'string' && item.eventId.trim()
          ? item.eventId.trim()
          : `evt_${crypto.randomBytes(12).toString('hex')}`;

      candidateEventIds.push(eventId);
      preparedEvents.push({
        eventId,
        serverId: server.serverId,
        serverRef: server._id,
        batchId: batchId.trim(),
        source: item.source.trim(),
        sourceOffset: typeof item.sourceOffset === 'number' ? item.sourceOffset : 0,
        message: item.message,
        observedAt,
        ingestedAt: new Date(),
        collectorMetadata: item.collectorMetadata || {},
      });
    }

    // Sequential SHA-256 hash chaining, sequence allocation, and deduplication
    const { accepted, duplicates } = await appendBatchToChain(server, preparedEvents);

    // Persist LogEvent entries for telemetry indexing
    if (accepted.length > 0) {
      const logEventsToInsert = accepted.map((item) => ({
        eventId: item.eventId,
        serverId: server.serverId,
        serverRef: server._id,
        batchId: batchId.trim(),
        source: item.source,
        sourceOffset: 0,
        message: item.message,
        observedAt: item.observedAt || new Date(),
        ingestedAt: new Date(),
        collectorMetadata: {},
        sequenceNumber: item.sequenceNumber,
        eventHash: item.eventHash,
      }));

      await LogEvent.insertMany(logEventsToInsert, { ordered: false });
    }

    // Update server heartbeat and online status
    server.lastHeartbeatAt = new Date();
    server.connectionStatus = 'ONLINE';
    await server.save();

    console.log(
      `[Collector Ingestion] Server ${server.serverId}: batch ${batchId} acknowledged (${accepted.length} accepted, ${duplicates.length} duplicates, chainHeadSeq: ${server.chainHeadSequence})`
    );

    res.status(200).json({
      success: true,
      acknowledgedBatchId: batchId,
      acceptedCount: accepted.length,
      duplicateCount: duplicates.length,
      totalReceived: events.length,
      chainHeadSequence: server.chainHeadSequence,
      chainHeadHash: server.chainHeadHash,
      ingestedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record an authenticated heartbeat from a collector agent.
 * POST /api/collector/heartbeat
 */
export const recordHeartbeat = async (req, res, next) => {
  try {
    const server = req.server;
    const { agentVersion, currentHealth, pendingQueueCount, diagnostics } = req.body || {};

    server.lastHeartbeatAt = new Date();
    server.connectionStatus = 'ONLINE';
    await server.save();

    console.log(
      `[Collector Heartbeat] Server ${server.serverId} heartbeat recorded (v${agentVersion || 'unknown'}, health: ${currentHealth || 'HEALTHY'}, pending: ${pendingQueueCount || 0})`
    );

    res.status(200).json({
      success: true,
      serverId: server.serverId,
      serverName: server.serverName,
      status: server.enrollmentStatus,
      connectionStatus: 'ONLINE',
      acknowledgedAt: new Date().toISOString(),
      freshnessWindowSeconds: 120,
    });
  } catch (error) {
    next(error);
  }
};
