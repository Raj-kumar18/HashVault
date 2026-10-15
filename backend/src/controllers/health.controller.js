import { getDbState } from '../config/db.js';

/**
 * Health check endpoint: GET /api/health
 * Returns application name, API status, and timestamp.
 */
export const getHealth = (req, res) => {
  const dbState = getDbState();
  return res.status(200).json({
    status: 'ok',
    name: 'HashVault',
    version: '1.0.0',
    phase: 'Phase 9 — Production-Readiness Assessment & Final Delivery',
    timestamp: new Date().toISOString(),
    db: {
      status: dbState.status,
      connected: dbState.connected,
    },
  });
};

/**
 * Database health check endpoint: GET /api/health/db
 * Accurately reports MongoDB connection status via Mongoose readyState.
 */
export const getDbHealth = (req, res) => {
  const dbState = getDbState();
  const statusCode = dbState.connected ? 200 : 503;

  return res.status(statusCode).json({
    name: 'HashVault',
    database: dbState.status,
    connected: dbState.connected,
    readyState: dbState.readyState,
    timestamp: new Date().toISOString(),
    message: dbState.connected
      ? 'MongoDB connection is active and healthy.'
      : 'MongoDB is currently disconnected or unreachable.',
  });
};
