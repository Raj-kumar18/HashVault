import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listAlerts,
  getAlert,
  acknowledge,
  resolve,
  streamAlerts,
} from '../controllers/alert.controller.js';

const router = Router();

// Server-Sent Events live stream for instant real-time tamper alerts
router.get('/stream', requireAuth, streamAlerts);

// List alerts (Admin and Security Analyst)
router.get('/', requireAuth, listAlerts);

// Single alert detail (Admin and Security Analyst)
router.get('/:alertId', requireAuth, getAlert);

// Acknowledge alert (Admin and Security Analyst)
router.post('/:alertId/acknowledge', requireAuth, acknowledge);

// Resolve alert (Admin and Security Analyst)
router.post('/:alertId/resolve', requireAuth, resolve);

export default router;
