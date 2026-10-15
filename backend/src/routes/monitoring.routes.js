import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getOverview,
  getServers,
  triggerCycle,
} from '../controllers/monitoring.controller.js';

const router = Router();

// Overview accessible by both Admin and Security Analyst
router.get('/overview', requireAuth, getOverview);

// Server-level monitoring list accessible by both Admin and Security Analyst
router.get('/servers', requireAuth, getServers);

// Manual monitoring cycle trigger (Admin only)
router.post('/cycle', requireAuth, requireRole('Admin'), triggerCycle);

export default router;
