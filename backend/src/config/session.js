import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Creates Express session middleware configured with MongoDB store (or MemoryStore fallback).
 */
export const configureSession = () => {
  let store;

  // Prefer reusing active Mongoose connection client, or connect via URI
  const mongoUri = process.env.MONGODB_URI || env.MONGODB_URI;
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    store = MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native',
      touchAfter: 24 * 3600, // lazy session update
    });
  } else if (mongoUri) {
    store = MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native',
      touchAfter: 24 * 3600, // lazy session update
    });
  } else {
    // Development fallback if running without database
    console.warn(
      '[LogSentinel Backend] Using in-memory session store (development fallback).'
    );
    store = new session.MemoryStore();
  }

  const isProduction = env.NODE_ENV === 'production';

  return session({
    name: 'logsentinel.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    rolling: true, // Reset cookie maxAge on every response
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    },
  });
};
