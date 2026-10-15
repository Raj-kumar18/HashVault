import { Router } from 'express';
import { getHealth, getDbHealth } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health
router.get('/', getHealth);

// GET /api/health/db
router.get('/db', getDbHealth);

export default router;
