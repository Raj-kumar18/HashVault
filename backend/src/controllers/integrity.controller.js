import { Server } from '../models/Server.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { verifyServerChain } from '../services/integrity.service.js';
import { GENESIS_PREVIOUS_HASH } from '../crypto/canonicalizer.js';

/**
 * GET /api/integrity/servers/:serverId/summary
 * Returns chain metadata, head hash, event totals, and latest verification status.
 */
export const getIntegritySummary = async (req, res, next) => {
  try {
    const { serverId } = req.params;

    const server = await Server.findOne({ serverId });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Server ${serverId} not found.`,
      });
    }

    const totalEvents = await IntegrityRecord.countDocuments({ serverId });

    // Fetch the latest record if exists
    const latestRecord = await IntegrityRecord.findOne({ serverId })
      .sort({ sequenceNumber: -1 })
      .lean();

    res.status(200).json({
      success: true,
      serverId: server.serverId,
      serverName: server.serverName,
      hostname: server.hostname,
      environment: server.environment,
      totalEventsInChain: totalEvents,
      chainHeadSequence: latestRecord ? latestRecord.sequenceNumber : 0,
      chainHeadHash: latestRecord ? latestRecord.eventHash : GENESIS_PREVIOUS_HASH,
      chainHeadUpdatedAt: latestRecord ? latestRecord.createdAt : null,
      genesisHash: GENESIS_PREVIOUS_HASH,
      lastVerificationStatus: server.lastVerificationStatus || 'NOT_VERIFIED',
      lastVerifiedAt: server.lastVerifiedAt || null,
      lastVerifiedRange: server.lastVerifiedRange || null,
      connectionStatus: server.toSafeObject().connectionStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/integrity/servers/:serverId/events
 * Returns paginated, searchable list of sequential integrity records for a server.
 */
export const getIntegrityEvents = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const server = await Server.findOne({ serverId });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Server ${serverId} not found.`,
      });
    }

    const query = { serverId };

    // Sequence range filtering
    if (req.query.fromSequence) {
      const fromSeq = parseInt(req.query.fromSequence, 10);
      if (!isNaN(fromSeq)) query.sequenceNumber = { ...query.sequenceNumber, $gte: fromSeq };
    }
    if (req.query.toSequence) {
      const toSeq = parseInt(req.query.toSequence, 10);
      if (!isNaN(toSeq)) query.sequenceNumber = { ...query.sequenceNumber, $lte: toSeq };
    }

    // Text search by eventId, message, or source
    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const q = req.query.search.trim();
      query.$or = [
        { eventId: { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } },
        { source: { $regex: q, $options: 'i' } },
      ];
    }

    const [total, records] = await Promise.all([
      IntegrityRecord.countDocuments(query),
      IntegrityRecord.find(query)
        .sort({ sequenceNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      serverId: server.serverId,
      serverName: server.serverName,
      events: records.map((r) => ({
        id: r._id.toString(),
        sequenceNumber: r.sequenceNumber,
        eventId: r.eventId,
        previousHash: r.previousHash,
        eventHash: r.eventHash,
        hashVersion: r.hashVersion,
        receivedAt: r.receivedAt,
        source: r.source,
        message: r.message,
        observedAt: r.observedAt,
        canonicalPayloadLength: r.canonicalPayload ? r.canonicalPayload.length : 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/integrity/servers/:serverId/events/:sequenceNumber
 * Retrieves the full integrity record at a specific sequence, including canonical payload.
 */
export const getIntegrityEventBySequence = async (req, res, next) => {
  try {
    const { serverId, sequenceNumber } = req.params;
    const seq = parseInt(sequenceNumber, 10);

    if (isNaN(seq) || seq < 1) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'sequenceNumber must be a positive integer.',
      });
    }

    const record = await IntegrityRecord.findOne({
      serverId,
      sequenceNumber: seq,
    }).lean();

    if (!record) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Integrity record for server ${serverId} at sequence #${seq} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      event: {
        id: record._id.toString(),
        serverId: record.serverId,
        sequenceNumber: record.sequenceNumber,
        eventId: record.eventId,
        canonicalPayload: record.canonicalPayload,
        previousHash: record.previousHash,
        eventHash: record.eventHash,
        hashVersion: record.hashVersion,
        receivedAt: record.receivedAt,
        source: record.source,
        message: record.message,
        observedAt: record.observedAt,
        createdAt: record.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/integrity/servers/:serverId/verify
 * Executes cryptographic chain verification for the requested server and range.
 */
export const runIntegrityVerification = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { fromSequence, toSequence } = req.body || {};

    const options = {};
    if (typeof fromSequence === 'number' && fromSequence >= 1) {
      options.fromSequence = fromSequence;
    }
    if (typeof toSequence === 'number' && toSequence >= 1) {
      options.toSequence = toSequence;
    }

    const verificationResult = await verifyServerChain(serverId, options);

    res.status(200).json({
      success: true,
      ...verificationResult,
    });
  } catch (error) {
    next(error);
  }
};
