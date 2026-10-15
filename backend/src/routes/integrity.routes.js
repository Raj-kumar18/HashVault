import { Router } from 'express';
import {
  getIntegritySummary,
  getIntegrityEvents,
  getIntegrityEventBySequence,
  runIntegrityVerification,
} from '../controllers/integrity.controller.js';
import {
  createCheckpoint,
  getCheckpoints,
  getCheckpointById,
  verifyCheckpoint,
} from '../controllers/checkpoint.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';

const router = Router();

// Enforce authentication and authorized roles (Admin, Security Analyst, Analyst) for all integrity endpoints
router.use(requireAuth);
router.use(requireRole('Admin', 'Security Analyst', 'Analyst'));

// Summary endpoint
router.get('/servers/:serverId/summary', getIntegritySummary);

// Paginated events list
router.get('/servers/:serverId/events', getIntegrityEvents);

// Single record inspection
router.get('/servers/:serverId/events/:sequenceNumber', getIntegrityEventBySequence);

// Cryptographic chain verification trigger
router.post('/servers/:serverId/verify', verifyCsrfToken, runIntegrityVerification);

// ==================== Phase 5 Blockchain Checkpoints ====================

// Checkpoint creation & anchoring (Admin only)
router.post(
  '/servers/:serverId/checkpoints',
  requireRole('Admin'),
  verifyCsrfToken,
  createCheckpoint
);

// Checkpoints history listing (Admin & Security Analyst)
router.get('/servers/:serverId/checkpoints', getCheckpoints);

// Checkpoint detail inspection (Admin & Security Analyst)
router.get('/servers/:serverId/checkpoints/:checkpointId', getCheckpointById);

// Independent on-chain checkpoint verification trigger (Admin & Security Analyst)
router.post(
  '/servers/:serverId/checkpoints/:checkpointId/verify',
  verifyCsrfToken,
  verifyCheckpoint
);

export default router;
