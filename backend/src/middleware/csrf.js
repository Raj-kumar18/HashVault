import crypto from 'crypto';

/**
 * Middleware to generate and attach CSRF token to session.
 */
export const ensureCsrfToken = (req) => {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
};

/**
 * CSRF Protection Middleware for state-changing requests.
 * Requires X-CSRF-Token or X-XSRF-Token header on POST, PUT, PATCH, DELETE.
 */
export const verifyCsrfToken = (req, res, next) => {
  // Safe HTTP methods do not change state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Allow bypass in explicit automated testing if header is set
  if (
    process.env.NODE_ENV === 'test' &&
    req.headers['x-test-bypass-csrf'] === 'true'
  ) {
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const clientToken =
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body?._csrf;

  if (!sessionToken || !clientToken || sessionToken !== clientToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token. Please fetch /api/auth/csrf-token and include the X-CSRF-Token header.',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};
