import { Router } from 'express';
import { getBlockchainStatus } from '../controllers/checkpoint.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Retrieve blockchain RPC provider and contract status (safe summary, no private keys)
router.get('/status', requireAuth, getBlockchainStatus);

export default router;
