import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listScenarios,
  runScenario,
} from '../controllers/simulation.controller.js';

const router = Router();

// List scenarios and past runs (Admin and Security Analyst)
router.get('/', requireAuth, listScenarios);

// Execute controlled attack scenario (Admin only)
router.post('/:scenario/run', requireAuth, requireRole('Admin'), runScenario);

export default router;
