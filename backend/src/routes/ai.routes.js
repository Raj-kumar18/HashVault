import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';
import {
  createAnalysis,
  listAnalyses,
  getAnalysisById,
  submitFeedback,
  compareAnalyses,
  getAiStatus,
} from '../controllers/ai.controller.js';

const router = Router();

// Rate limiter for investigations to prevent external API exhaustion
const aiAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 investigations per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'AI investigation rate limit reached. Please wait before initiating new investigations.',
  },
});

// All AI routes require authenticated session with Admin or Security Analyst role
router.use(requireAuth);
router.use(requireRole('Admin', 'Analyst', 'Security Analyst'));

// GET /api/ai/status - Safe AI provider readiness check
router.get('/status', getAiStatus);

// POST /api/ai/analyses - Initiate security investigation
router.post(
  '/analyses',
  aiAnalysisLimiter,
  verifyCsrfToken,
  createAnalysis
);

// GET /api/ai/analyses - List paginated historical reports
router.get('/analyses', listAnalyses);

// GET /api/ai/analyses/:analysisId - Fetch individual report
router.get('/analyses/:analysisId', getAnalysisById);

// POST /api/ai/analyses/:analysisId/feedback - Submit feedback
router.post(
  '/analyses/:analysisId/feedback',
  verifyCsrfToken,
  submitFeedback
);

// GET /api/ai/analyses/:analysisId/compare/:otherId - Compare two reports
router.get('/analyses/:analysisId/compare/:otherId', compareAnalyses);

export default router;
