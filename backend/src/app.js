import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { configureSession } from './config/session.js';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  // Trust first proxy when deployed behind reverse proxy in production
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // CORS configuration
  const allowedOrigins = [
    env.CORS_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, server-to-server)
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith('http://localhost:')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );

  // Cookie parsing
  app.use(cookieParser());

  // Request parsing with bounded payload limits (protect against large body DOS)
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Session management
  app.use(configureSession());

  // Root endpoint info
  app.get('/', (req, res) => {
    res.json({
      name: 'HashVault API',
      tagline: 'Every Log. Verifiable Trust.',
      version: '1.0.0',
      phase: 'Phase 9 — Production-Readiness Assessment & Final Delivery',
      endpoints: {
        health: '/api/health',
        dbHealth: '/api/health/db',
        csrf: '/api/auth/csrf-token',
        signup: '/api/auth/signup',
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        me: '/api/auth/me',
        servers: '/api/servers',
        collectorEnroll: '/api/collector/enroll',
        collectorLogs: '/api/collector/logs',
        collectorHeartbeat: '/api/collector/heartbeat',
        integritySummary: '/api/integrity/servers/:serverId/summary',
        integrityEvents: '/api/integrity/servers/:serverId/events',
        integrityVerify: '/api/integrity/servers/:serverId/verify',
        aiAnalyses: '/api/ai/analyses',
        aiStatus: '/api/ai/status',
      },
    });
  });

  // Mount API modular routes
  app.use('/api', apiRouter);

  // 404 Not Found handler
  app.use(notFoundHandler);

  // Centralized Error handler
  app.use(errorHandler);

  return app;
};
