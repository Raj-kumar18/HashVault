import { LogEvent } from '../models/LogEvent.js';
import { Server } from '../models/Server.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';

/**
 * Universal Logs Explorer Controller.
 * Queries persisted log events across all servers authorized for the current user.
 * Supports bounded server-side pagination, full-text regex search, source, sequence, and date filtering.
 *
 * GET /api/logs
 */
export const queryLogs = async (req, res, next) => {
  try {
    const userFilter = req.user ? { ownerId: req.user._id } : {};
    const servers = await Server.find(userFilter).select('serverId serverName hostname environment').lean();
    const serverMap = new Map();
    servers.forEach((s) => serverMap.set(s.serverId, s));

    const authorizedServerIds = servers.map((s) => s.serverId);

    const {
      page = 1,
      limit = 25,
      search,
      serverId,
      source,
      startDate,
      endDate,
      minSequence,
      maxSequence,
      sortBy = 'observedAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // 1. Server scope filter
    if (serverId && typeof serverId === 'string' && serverId.trim() && serverId !== 'all') {
      if (!authorizedServerIds.includes(serverId.trim())) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to view logs for the requested server.',
        });
      }
      query.serverId = serverId.trim();
    } else {
      query.serverId = { $in: authorizedServerIds };
    }

    // 2. Source filter
    if (source && typeof source === 'string' && source.trim() && source !== 'all') {
      query.source = source.trim();
    }

    // 3. Search query (matches message or eventId)
    if (search && typeof search === 'string' && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { message: { $regex: sanitized, $options: 'i' } },
        { eventId: { $regex: sanitized, $options: 'i' } },
      ];
    }

    // 4. Date range filter
    if (startDate || endDate) {
      query.observedAt = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) {
          query.observedAt.$gte = d;
        }
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) {
          query.observedAt.$lte = d;
        }
      }
      if (Object.keys(query.observedAt).length === 0) {
        delete query.observedAt;
      }
    }

    // 5. Sequence range filter
    if (minSequence !== undefined || maxSequence !== undefined) {
      query.sequenceNumber = {};
      if (minSequence !== undefined && !isNaN(parseInt(minSequence, 10))) {
        query.sequenceNumber.$gte = parseInt(minSequence, 10);
      }
      if (maxSequence !== undefined && !isNaN(parseInt(maxSequence, 10))) {
        query.sequenceNumber.$lte = parseInt(maxSequence, 10);
      }
      if (Object.keys(query.sequenceNumber).length === 0) {
        delete query.sequenceNumber;
      }
    }

    // 6. Pagination & Sorting
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const allowedSortFields = ['observedAt', 'ingestedAt', 'sequenceNumber'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'observedAt';
    const direction = sortOrder === 'asc' ? 1 : -1;
    // Secondary tie-breaker prevents duplicate items appearing across pagination boundaries on identical timestamps
    const sortObj = {
      [safeSortField]: direction,
      ...(safeSortField !== 'sequenceNumber' ? { sequenceNumber: direction } : {}),
      _id: direction,
    };

    const [logs, total, distinctSources] = await Promise.all([
      LogEvent.find(query).sort(sortObj).skip(skip).limit(limitNum).lean(),
      LogEvent.countDocuments(query),
      LogEvent.distinct('source', { serverId: { $in: authorizedServerIds } }),
    ]);

    // Attach server metadata to each log item
    const enrichedLogs = logs.map((log) => {
      const srv = serverMap.get(log.serverId);
      return {
        ...log,
        serverName: srv ? srv.serverName : log.serverId,
        hostname: srv ? srv.hostname : 'unknown',
        environment: srv ? srv.environment : 'unknown',
      };
    });

    res.json({
      success: true,
      logs: enrichedLogs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      availableServers: servers.map((s) => ({
        serverId: s.serverId,
        serverName: s.serverName,
        hostname: s.hostname,
        environment: s.environment,
      })),
      availableSources: distinctSources.filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve deep forensic detail for a specific event by eventId or sequenceNumber.
 * Includes associated IntegrityRecord canonical payload, event hash, and previous hash.
 *
 * GET /api/logs/:eventId
 */
export const getLogEventDetail = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const log = await LogEvent.findOne({ eventId }).lean();
    if (!log) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Log event record not found.',
      });
    }

    // Verify user owns the server
    const server = await Server.findOne({
      serverId: log.serverId,
      ownerId: req.user._id,
    }).lean();

    if (!server) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to inspect this log event.',
      });
    }

    // Find cryptographic integrity record if available
    const integrity = await IntegrityRecord.findOne({
      serverId: log.serverId,
      eventId: log.eventId,
    }).lean();

    res.json({
      success: true,
      event: {
        ...log,
        serverName: server.serverName,
        hostname: server.hostname,
        environment: server.environment,
        cryptographicProof: integrity
          ? {
              sequenceNumber: integrity.sequenceNumber,
              canonicalPayload: integrity.canonicalPayload,
              previousHash: integrity.previousHash,
              eventHash: integrity.eventHash,
              hashVersion: integrity.hashVersion,
              receivedAt: integrity.receivedAt,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
