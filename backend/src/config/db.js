import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Returns accurate MongoDB connection status based on mongoose readyState.
 * readyState meanings:
 * 0 = disconnected
 * 1 = connected
 * 2 = connecting
 * 3 = disconnecting
 */
export const getDbState = () => {
  const readyState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    connected: readyState === 1,
    status: states[readyState] || 'unknown',
    readyState,
  };
};

export const connectDB = async () => {
  if (!env.MONGODB_URI) {
    console.warn(
      '[LogSentinel Backend] MONGODB_URI is not set. Starting in database-detached mode.'
    );
    return;
  }

  try {
    console.log('[LogSentinel Backend] Attempting to connect to MongoDB...');
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[LogSentinel Backend] MongoDB connected successfully.');
  } catch (error) {
    console.error(
      `[LogSentinel Backend] Primary MongoDB connection error: ${error.message}`
    );
    if (env.NODE_ENV === 'production') {
      throw error;
    }

    // Development resilience: start local in-memory MongoDB fallback with pre-seeded demo accounts
    try {
      console.log('[LogSentinel Backend] Starting local in-memory MongoDB fallback for seamless local development...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const memoryServer = await MongoMemoryServer.create();
      const fallbackUri = memoryServer.getUri();
      process.env.MONGODB_URI = fallbackUri;

      await mongoose.connect(fallbackUri);
      console.log('[LogSentinel Backend] Local in-memory MongoDB connected successfully at:', fallbackUri);

      // Auto-seed demo Admin and Analyst accounts
      const bcrypt = (await import('bcryptjs')).default;
      const { User } = await import('../models/User.js');
      const adminHash = await bcrypt.hash('LogSentinel@Admin2026', 10);
      const analystHash = await bcrypt.hash(process.env.DEMO_ANALYST_PASSWORD || 'LogSentinel@Analyst2026', 10);

      await User.findOneAndUpdate(
        { email: 'admin@logsentinel.local' },
        { name: 'Security Administrator', email: 'admin@logsentinel.local', passwordHash: adminHash, role: 'Admin' },
        { upsert: true, new: true }
      );
      await User.findOneAndUpdate(
        { email: 'analyst@logsentinel.local' },
        { name: 'SOC Analyst', email: 'analyst@logsentinel.local', passwordHash: analystHash, role: 'Analyst' },
        { upsert: true, new: true }
      );
      console.log('[LogSentinel Backend] Demo accounts seeded: Admin (admin@logsentinel.local) & Analyst (analyst@logsentinel.local).');
    } catch (fallbackError) {
      console.error('[LogSentinel Backend] Failed to initialize local MongoDB fallback:', fallbackError.message);
    }
  }
};

export const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('[LogSentinel Backend] MongoDB connection closed.');
    }
  } catch (error) {
    console.error(`[LogSentinel Backend] Error closing MongoDB connection: ${error.message}`);
  }
};
