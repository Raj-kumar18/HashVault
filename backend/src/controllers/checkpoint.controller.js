import { Checkpoint } from '../models/Checkpoint.js';
import { Server } from '../models/Server.js';
import {
  createOrGetCheckpoint,
  executeAnchoringTransaction,
} from '../blockchain/checkpointService.js';
import { verifyCheckpointOnChain } from '../blockchain/verificationService.js';
import { checkBlockchainHealth } from '../blockchain/provider.js';

/**
 * POST /api/integrity/servers/:serverId/checkpoints
 * Creates or retrieves a deterministic checkpoint and anchors it to the blockchain.
 * Restricted to Admin role.
 */
export const createCheckpoint = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { startSequence, endSequence } = req.body || {};

    // Validate server access for current user
    const server = await Server.findOne({
      serverId,
      ownerId: req.user._id,
    });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to access it.',
      });
    }

    const { checkpoint, isNew } = await createOrGetCheckpoint({
      serverId,
      startSequence,
      endSequence,
      userId: req.user._id,
    });

    // If checkpoint is new and pending, attempt immediate anchoring broadcast
    if (checkpoint.transactionStatus === 'PENDING') {
      try {
        await executeAnchoringTransaction(checkpoint.checkpointId);
      } catch (txError) {
        console.warn(
          `[CheckpointController] Immediate anchoring broadcast encountered issue: ${txError.message}. Worker will retry.`
        );
      }
    }

    // Reload latest state from database
    const refreshed = await Checkpoint.findById(checkpoint._id);

    res.status(isNew ? 201 : 200).json({
      success: true,
      isNew,
      checkpoint: refreshed.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/integrity/servers/:serverId/checkpoints
 * Retrieves paginated list of checkpoints for a server.
 * Accessible by Admin and Security Analyst.
 */
export const getCheckpoints = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const server = await Server.findOne({
      serverId,
      ownerId: req.user._id,
    });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to access it.',
      });
    }

    const query = { serverId };
    if (req.query.status) {
      query.transactionStatus = req.query.status;
    }

    const [total, checkpoints] = await Promise.all([
      Checkpoint.countDocuments(query),
      Checkpoint.find(query)
        .sort({ endSequence: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      serverId,
      serverName: server.serverName,
      checkpoints: checkpoints.map((cp) => cp.toSafeObject()),
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
 * GET /api/integrity/servers/:serverId/checkpoints/:checkpointId
 * Retrieves detailed metadata and lifecycle of a specific checkpoint.
 */
export const getCheckpointById = async (req, res, next) => {
  try {
    const { serverId, checkpointId } = req.params;

    const server = await Server.findOne({
      serverId,
      ownerId: req.user._id,
    });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to access it.',
      });
    }

    const checkpoint = await Checkpoint.findOne({ serverId, checkpointId });
    if (!checkpoint) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Checkpoint ${checkpointId} not found for server ${serverId}.`,
      });
    }

    res.status(200).json({
      success: true,
      checkpoint: checkpoint.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/integrity/servers/:serverId/checkpoints/:checkpointId/verify
 * Executes independent cryptographic verification of database records against the on-chain checkpoint.
 * Accessible by Admin and Security Analyst.
 */
export const verifyCheckpoint = async (req, res, next) => {
  try {
    const { serverId, checkpointId } = req.params;

    const server = await Server.findOne({
      serverId,
      ownerId: req.user._id,
    });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Server not found or you do not have permission to access it.',
      });
    }

    const verificationResult = await verifyCheckpointOnChain({
      serverId,
      checkpointId,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      ...verificationResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/blockchain/status
 * Returns current RPC connectivity, chain ID, contract status, and signer details (safe summary).
 */
export const getBlockchainStatus = async (req, res, next) => {
  try {
    const status = await checkBlockchainHealth();
    res.status(200).json({
      success: true,
      blockchain: status,
    });
  } catch (error) {
    next(error);
  }
};
