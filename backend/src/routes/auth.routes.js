import { Router } from 'express';
import {
  getCsrfToken,
  signup,
  login,
  logout,
  getMe,
  testProtected,
  testAnalystOnly,
  testAdminOnly,
} from '../controllers/auth.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// CSRF token retrieval
router.get('/csrf-token', getCsrfToken);

// Authentication workflows with rate limiting and CSRF protection
router.post('/signup', authRateLimiter, verifyCsrfToken, signup);
router.post('/login', authRateLimiter, verifyCsrfToken, login);
router.post('/logout', verifyCsrfToken, logout);

// Profile endpoint
router.get('/me', requireAuth, getMe);

// RBAC demonstration endpoints
router.get('/test/protected', requireAuth, testProtected);
router.get('/test/analyst-only', requireAuth, requireRole('Admin', 'Analyst'), testAnalystOnly);
router.get('/test/admin-only', requireAuth, requireRole('Admin'), testAdminOnly);

export default router;
