import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { queryLogs, getLogEventDetail } from '../controllers/log.controller.js';

const router = Router();

// Universal Logs Explorer endpoints
// Accessible by Admin and Security Analyst
router.get('/', requireAuth, queryLogs);
router.get('/:eventId', requireAuth, getLogEventDetail);

export default router;
