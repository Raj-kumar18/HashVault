import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSecurityOverview } from '../controllers/overview.controller.js';

const router = Router();

// Endpoint for real Security Operations Center dashboard overview
// Accessible by Admin and Security Analyst
router.get('/', requireAuth, getSecurityOverview);

export default router;
