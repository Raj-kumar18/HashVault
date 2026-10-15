import { Router } from 'express';
import {
  createServer,
  getServers,
  getServerById,
  getServerLogs,
  updateServer,
  disableServer,
  deleteServer,
  generateEnrollmentToken,
  rotateCredential,
} from '../controllers/server.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';
import { serverMutationRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Read operations: Accessible by Admin, Analyst, and Viewer (scoped strictly to current user)
router.get('/', requireAuth, getServers);
router.get('/:id', requireAuth, getServerById);
router.get('/:id/logs', requireAuth, getServerLogs);

// Administrative operations: Restricted to Admin role with CSRF validation
router.post(
  '/',
  requireAuth,
  requireRole('Admin'),
  serverMutationRateLimiter,
  verifyCsrfToken,
  createServer
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('Admin'),
  serverMutationRateLimiter,
  verifyCsrfToken,
  updateServer
);

router.post(
  '/:id/disable',
  requireAuth,
  requireRole('Admin'),
  serverMutationRateLimiter,
  verifyCsrfToken,
  disableServer
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('Admin'),
  serverMutationRateLimiter,
  verifyCsrfToken,
  deleteServer
);

router.post(
  '/:id/enrollment-token',
  requireAuth,
  requireRole('Admin'),
  serverMutationRateLimiter,
  verifyCsrfToken,
  generateEnrollmentToken
);

router.post(
  '/:id/rotate-credential',
  requireAuth,
  requireRole('Admin'),
  serverMutationRateLimiter,
  verifyCsrfToken,
  rotateCredential
);

export default router;
