import { Router } from 'express';
import {
  enrollCollector,
  ingestLogs,
  recordHeartbeat,
} from '../controllers/collector.controller.js';
import { requireCollectorAuth } from '../middleware/collectorAuth.js';
import { enrollmentRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * Endpoint for background Linux agent to exchange single-use enrollment token
 * for a persistent server-specific collector credential.
 */
router.post('/enroll', enrollmentRateLimiter, enrollCollector);

/**
 * Endpoint for authenticated collector agent to deliver durable log event batches.
 */
router.post('/logs', requireCollectorAuth, ingestLogs);

/**
 * Endpoint for authenticated collector agent to send periodic heartbeats.
 */
router.post('/heartbeat', requireCollectorAuth, recordHeartbeat);

export default router;

