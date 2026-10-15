import { User } from '../models/User.js';

/**
 * Middleware ensuring the client has an active authenticated session.
 * Rejects unauthenticated requests with HTTP 401.
 */
export const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in.',
        timestamp: new Date().toISOString(),
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      // User may have been removed from the database
      req.session.destroy(() => {});
      res.clearCookie('logsentinel.sid');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User session is no longer valid.',
        timestamp: new Date().toISOString(),
      });
    }

    // Attach full Mongoose user document to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware enforcing Role-Based Access Control (RBAC).
 * Rejects requests with HTTP 403 if the user does not possess one of the allowed roles.
 *
 * NOTE on Multi-Tenant Isolation:
 * Role checks alone determine broad functional capability (Admin vs Analyst vs Viewer).
 * Future phases will layer object-level ownership checks (e.g. server UUID, tenant organization ID)
 * to ensure users cannot access cross-tenant or cross-organization assets even within the same role.
 *
 * @param {...string} allowedRoles Roles permitted to access the resource ('Admin', 'Analyst', 'Viewer')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required before checking permissions.',
        timestamp: new Date().toISOString(),
      });
    }

    const userRole = req.user.role;
    const isAuthorized = allowedRoles.some((role) => {
      if (role === userRole) return true;
      if (
        (role === 'Security Analyst' && userRole === 'Analyst') ||
        (role === 'Analyst' && userRole === 'Security Analyst')
      ) {
        return true;
      }
      return false;
    });

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Resource requires role [${allowedRoles.join(
          ', '
        )}], but current role is [${userRole}].`,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};
