import crypto from 'crypto';
import mongoose from 'mongoose';
import { Server, SERVER_OS, SERVER_ENVIRONMENTS } from '../models/Server.js';
import { EnrollmentToken } from '../models/EnrollmentToken.js';
import { LogEvent } from '../models/LogEvent.js';
import { Alert } from '../models/Alert.js';
import { Checkpoint } from '../models/Checkpoint.js';

// Helper to escape user input in regex searches
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Register a new server for the authenticated user.
 * POST /api/servers
 */
export const createServer = async (req, res, next) => {
  try {
    const { serverName, hostname, os, environment, description } = req.body;

    // Validate required fields
    if (!serverName || typeof serverName !== 'string' || serverName.trim().length < 2) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Server name is required and must be at least 2 characters.',
      });
    }

    if (!hostname || typeof hostname !== 'string' || hostname.trim().length < 2) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Hostname is required and must be at least 2 characters.',
      });
    }

    if (!SERVER_OS.includes(os)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: `Operating system must be one of: ${SERVER_OS.join(', ')}.`,
      });
    }

    if (!SERVER_ENVIRONMENTS.includes(environment)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: `Environment must be one of: ${SERVER_ENVIRONMENTS.join(', ')}.`,
      });
    }

    // Check for duplicate server name or hostname within the user's scope
    const existingServer = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverName: serverName.trim() },
        { hostname: hostname.trim().toLowerCase() },
      ],
      enrollmentStatus: { $ne: 'DISABLED' },
    });

    if (existingServer) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An active server with this name or hostname already exists in your fleet.',
      });
    }

    const server = new Server({
      serverName: serverName.trim(),
      hostname: hostname.trim().toLowerCase(),
      os,
      environment,
      description: typeof description === 'string' ? description.trim() : '',
      ownerId: req.user._id, // Strict backend ownership enforcement
      enrollmentStatus: 'PENDING_ENROLLMENT',
      connectionStatus: 'UNKNOWN',
    });

    await server.save();

    console.log(`[Audit] Server created: ${server.serverId} (${server.serverName}) by User ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Server registered successfully.',
      server: server.toSafeObject(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Server identifier conflict. Please try again.',
      });
    }
    next(error);
  }
};

/**
 * List servers scoped to the authenticated user.
 * GET /api/servers
 */
export const getServers = async (req, res, next) => {
  try {
    const {
      search,
      os,
      environment,
      enrollmentStatus,
      connectionStatus,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { ownerId: req.user._id };

    // Search filter across serverName and hostname
    if (search && typeof search === 'string' && search.trim()) {
      const sanitized = escapeRegex(search.trim());
      query.$or = [
        { serverName: { $regex: sanitized, $options: 'i' } },
        { hostname: { $regex: sanitized, $options: 'i' } },
      ];
    }

    // OS filter
    if (os && SERVER_OS.includes(os)) {
      query.os = os;
    }

    // Environment filter
    if (environment && SERVER_ENVIRONMENTS.includes(environment)) {
      query.environment = environment;
    }

    // Status filter
    if (enrollmentStatus) {
      query.enrollmentStatus = enrollmentStatus;
    }

    if (connectionStatus) {
      query.connectionStatus = connectionStatus;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    const allowedSortFields = ['createdAt', 'serverName', 'hostname', 'lastHeartbeatAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;

    const [servers, total] = await Promise.all([
      Server.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Server.countDocuments(query),
    ]);

    res.json({
      success: true,
      servers: servers.map((s) => s.toSafeObject()),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a specific server by serverId or _id scoped to current user.
 * GET /api/servers/:id
 */
export const getServerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    };

    const server = await Server.findOne(query);

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to access it.',
      });
    }

    res.json({
      success: true,
      server: server.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update allowed metadata fields for a server.
 * PATCH /api/servers/:id
 */
export const updateServer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const server = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    });

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to modify it.',
      });
    }

    const { serverName, hostname, os, environment, description } = req.body;

    // Apply allowed updates only
    if (serverName !== undefined) {
      if (typeof serverName !== 'string' || serverName.trim().length < 2) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Server name must be at least 2 characters long.',
        });
      }
      server.serverName = serverName.trim();
    }

    if (hostname !== undefined) {
      if (typeof hostname !== 'string' || hostname.trim().length < 2) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Hostname must be at least 2 characters long.',
        });
      }
      server.hostname = hostname.trim().toLowerCase();
    }

    if (os !== undefined) {
      if (!SERVER_OS.includes(os)) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Operating system must be one of: ${SERVER_OS.join(', ')}.`,
        });
      }
      server.os = os;
    }

    if (environment !== undefined) {
      if (!SERVER_ENVIRONMENTS.includes(environment)) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `Environment must be one of: ${SERVER_ENVIRONMENTS.join(', ')}.`,
        });
      }
      server.environment = environment;
    }

    if (description !== undefined) {
      server.description = typeof description === 'string' ? description.trim() : '';
    }

    await server.save();

    console.log(`[Audit] Server updated: ${server.serverId} by User ${req.user._id}`);

    res.json({
      success: true,
      message: 'Server metadata updated successfully.',
      server: server.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable a server and revoke all collector credentials.
 * POST /api/servers/:id/disable
 */
export const disableServer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const server = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    });

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to disable it.',
      });
    }

    server.enrollmentStatus = 'DISABLED';
    server.connectionStatus = 'OFFLINE';
    server.disabledAt = new Date();
    server.credentialHash = null;
    server.credentialVersion = (server.credentialVersion || 1) + 1;

    // Invalidate all pending unconsumed enrollment tokens
    await EnrollmentToken.updateMany(
      { serverRef: server._id, isConsumed: false },
      { $set: { isConsumed: true, consumedAt: new Date() } }
    );

    await server.save();

    console.log(`[Audit] Server disabled & credentials revoked: ${server.serverId} by User ${req.user._id}`);

    res.json({
      success: true,
      message: 'Server disabled and collector credentials revoked.',
      server: server.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a short-lived (15-min), single-use enrollment token.
 * POST /api/servers/:id/enrollment-token
 */
export const generateEnrollmentToken = async (req, res, next) => {
  try {
    const { id } = req.params;

    const server = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    });

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to generate an enrollment token.',
      });
    }

    if (server.enrollmentStatus === 'DISABLED') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Cannot generate an enrollment token for a disabled server.',
      });
    }

    // Invalidate any existing active tokens for this server
    await EnrollmentToken.updateMany(
      { serverRef: server._id, isConsumed: false },
      { $set: { isConsumed: true, consumedAt: new Date() } }
    );

    // Generate cryptographically secure random token
    const rawToken = `ent_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = EnrollmentToken.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute TTL

    const tokenDoc = new EnrollmentToken({
      tokenHash,
      serverId: server.serverId,
      serverRef: server._id,
      ownerId: req.user._id,
      expiresAt,
      isConsumed: false,
    });

    await tokenDoc.save();

    console.log(`[Audit] Enrollment token generated for server ${server.serverId} by User ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Enrollment token generated successfully. Valid for 15 minutes.',
      enrollmentToken: rawToken, // Returned ONLY once in this response
      serverId: server.serverId,
      serverName: server.serverName,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 900,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke existing collector credential and issue a new enrollment token.
 * POST /api/servers/:id/rotate-credential
 */
export const rotateCredential = async (req, res, next) => {
  try {
    const { id } = req.params;

    const server = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    });

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to rotate credentials.',
      });
    }

    if (server.enrollmentStatus === 'DISABLED') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Cannot rotate credentials for a disabled server.',
      });
    }

    // Revoke existing credential and reset enrollment status
    server.credentialHash = null;
    server.enrollmentStatus = 'PENDING_ENROLLMENT';
    server.connectionStatus = 'UNKNOWN';
    server.credentialVersion = (server.credentialVersion || 1) + 1;
    await server.save();

    // Invalidate previous active tokens
    await EnrollmentToken.updateMany(
      { serverRef: server._id, isConsumed: false },
      { $set: { isConsumed: true, consumedAt: new Date() } }
    );

    // Issue a fresh enrollment token
    const rawToken = `ent_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = EnrollmentToken.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const tokenDoc = new EnrollmentToken({
      tokenHash,
      serverId: server.serverId,
      serverRef: server._id,
      ownerId: req.user._id,
      expiresAt,
      isConsumed: false,
    });

    await tokenDoc.save();

    console.log(`[Audit] Credential rotated for server ${server.serverId} (v${server.credentialVersion}) by User ${req.user._id}`);

    res.json({
      success: true,
      message: 'Collector credentials revoked. A new enrollment token has been issued.',
      enrollmentToken: rawToken,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 900,
      server: server.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve ingested logs for an authorized server.
 * GET /api/servers/:id/logs
 */
export const getServerLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, source } = req.query;

    const server = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    });

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to access its logs.',
      });
    }

    const query = { serverId: server.serverId };
    if (source && typeof source === 'string' && source.trim()) {
      query.source = source.trim();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      LogEvent.find(query).sort({ observedAt: -1, sequenceNumber: -1, _id: -1 }).skip(skip).limit(limitNum).lean(),
      LogEvent.countDocuments(query),
    ]);

    res.json({
      success: true,
      serverId: server.serverId,
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently decommission and delete a server and its associated tokens from the fleet.
 * DELETE /api/servers/:id
 */
export const deleteServer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const server = await Server.findOne({
      ownerId: req.user._id,
      $or: [
        { serverId: id },
        ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ],
    });

    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to delete it.',
      });
    }

    const targetServerId = server.serverId;

    // Delete associated tokens, logs, alerts, checkpoints, and the server document
    await Promise.all([
      Server.deleteOne({ _id: server._id }),
      EnrollmentToken.deleteMany({ serverId: targetServerId }),
      LogEvent.deleteMany({ serverId: targetServerId }),
      Alert.deleteMany({ serverId: targetServerId }),
      Checkpoint.deleteMany({ serverId: targetServerId }),
    ]);

    res.json({
      success: true,
      message: `Server [${server.serverName}] (${targetServerId}) permanently removed from fleet.`,
      deletedServerId: targetServerId,
    });
  } catch (error) {
    next(error);
  }
};

