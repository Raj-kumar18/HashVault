import crypto from 'crypto';
import { Server } from '../models/Server.js';

/**
 * Middleware ensuring collector requests are authenticated using server-specific credentials.
 * Decoupled entirely from human browser web sessions and CSRF tokens.
 */
export const requireCollectorAuth = async (req, res, next) => {
  try {
    const serverId = req.headers['x-server-id'] || req.headers['x-server-uuid'];

    // Extract Bearer token or custom collector credential header
    let rawCredential = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawCredential = authHeader.slice(7).trim();
    } else if (req.headers['x-collector-credential']) {
      rawCredential = req.headers['x-collector-credential'].trim();
    }

    if (!serverId || !rawCredential) {
      return res.status(401).json({
        error: 'Unauthorized',
        message:
          'Collector authentication required. Please provide X-Server-Id and Authorization: Bearer <credential>.',
        timestamp: new Date().toISOString(),
      });
    }

    // Look up server and include credentialHash
    const server = await Server.findOne({ serverId }).select('+credentialHash');

    if (!server) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Unrecognized server identifier.',
        timestamp: new Date().toISOString(),
      });
    }

    // Prohibit disabled servers immediately
    if (server.enrollmentStatus === 'DISABLED') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This server is disabled. Collector access is permanently denied.',
        timestamp: new Date().toISOString(),
      });
    }

    // Ensure server is enrolled and has an active credential hash
    if (server.enrollmentStatus !== 'ENROLLED' || !server.credentialHash) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Server is not currently enrolled or credential has been rotated/revoked.',
        timestamp: new Date().toISOString(),
      });
    }

    // Compute deterministic SHA-256 hash of candidate credential
    const candidateHash = crypto
      .createHash('sha256')
      .update(rawCredential)
      .digest('hex');

    // Constant-time comparison to prevent timing side-channels
    const bufCandidate = Buffer.from(candidateHash, 'hex');
    const bufStored = Buffer.from(server.credentialHash, 'hex');

    if (
      bufCandidate.length !== bufStored.length ||
      !crypto.timingSafeEqual(bufCandidate, bufStored)
    ) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid collector credential.',
        timestamp: new Date().toISOString(),
      });
    }

    // Attach validated server model to request
    req.server = server;
    next();
  } catch (error) {
    next(error);
  }
};
