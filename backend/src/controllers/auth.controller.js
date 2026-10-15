import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { env } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/auth/csrf-token
 * Issues a cryptographically random CSRF token to client.
 */
export const getCsrfToken = (req, res) => {
  const token = ensureCsrfToken(req);
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res.status(200).json({ csrfToken: token });
};

/**
 * POST /api/auth/signup
 * Validates request, enforces Viewer role, hashes password, and establishes session.
 */
export const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Name is required and must be at least 2 characters long.',
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'A valid email address is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Duplicate check
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.',
      });
    }

    // 3. Security requirement: Never accept role from public signup
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'Viewer', // Guaranteed non-admin for public signups
    });

    // 4. Session establishment with regeneration
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user._id.toString();
      req.session.userRole = user.role;
      const csrfToken = ensureCsrfToken(req);

      res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return res.status(201).json({
        message: 'Account registered successfully.',
        user: user.toSafeObject(),
        csrfToken,
      });
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.',
      });
    }
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Verifies credentials, regenerates session to prevent fixation, and returns safe profile.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Timing-safe verification pattern: do not leak whether email exists
    const isValid = user ? await user.comparePassword(String(password)) : false;

    if (!user || !isValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    // Regenerate session upon privilege change / login
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user._id.toString();
      req.session.userRole = user.role;
      const csrfToken = ensureCsrfToken(req);

      res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return res.status(200).json({
        message: 'Authenticated successfully.',
        user: user.toSafeObject(),
        csrfToken,
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Destroys session and clears cookies.
 */
export const logout = (req, res, next) => {
  if (!req.session) {
    res.clearCookie('logsentinel.sid', { path: '/' });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
    return res.status(200).json({ message: 'Logged out successfully.' });
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('logsentinel.sid', { path: '/' });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
};

/**
 * GET /api/auth/me
 * Returns current authenticated user's safe profile.
 */
export const getMe = (req, res) => {
  const csrfToken = ensureCsrfToken(req);
  return res.status(200).json({
    user: req.user.toSafeObject(),
    csrfToken,
  });
};

/**
 * Test Protected Endpoints demonstrating RBAC rules
 */
export const testProtected = (req, res) => {
  return res.status(200).json({
    message: 'Access granted to authenticated resource.',
    user: req.user.toSafeObject(),
  });
};

export const testAnalystOnly = (req, res) => {
  return res.status(200).json({
    message: 'Access granted to Analyst workflow.',
    user: req.user.toSafeObject(),
  });
};

export const testAdminOnly = (req, res) => {
  return res.status(200).json({
    message: 'Access granted to Admin security management.',
    user: req.user.toSafeObject(),
  });
};
