import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for sensitive authentication endpoints (Login / Signup).
 * Limits to 10 attempts per 15 minutes window per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    timestamp: new Date().toISOString(),
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Rate limiter for server creation, disablement, and credential rotation.
 */
export const serverMutationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'Too many server configuration attempts. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Rate limiter for collector enrollment exchange.
 */
export const enrollmentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'Too many collector enrollment attempts. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  skip: () => process.env.NODE_ENV === 'test',
});

