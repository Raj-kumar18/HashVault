import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { startCheckpointWorker, stopCheckpointWorker } from './blockchain/worker.js';
import { startMonitoringScheduler, stopMonitoringScheduler } from './monitoring/scheduler.js';

const app = createApp();

let server;

async function startServer() {
  // Connect to MongoDB if configured
  await connectDB();

  // Start background checkpoint recovery worker
  startCheckpointWorker();

  // Start background fleet monitoring & alert scheduler
  startMonitoringScheduler();

  server = app.listen(env.PORT, () => {
    console.log(`[LogSentinel Backend] Server listening on port ${env.PORT} (environment: ${env.NODE_ENV})`);
    console.log(`[LogSentinel Backend] API Health endpoint: http://localhost:${env.PORT}/api/health`);
    console.log(`[LogSentinel Backend] Database Health endpoint: http://localhost:${env.PORT}/api/health/db`);
  });

  // Clean shutdown handlers
  const gracefulShutdown = async (signal) => {
    console.log(`\n[LogSentinel Backend] Received ${signal}. Initiating graceful shutdown...`);

    stopCheckpointWorker();
    stopMonitoringScheduler();

    if (server) {
      server.close(async () => {
        console.log('[LogSentinel Backend] HTTP server closed.');
        await disconnectDB();
        console.log('[LogSentinel Backend] Shutdown complete. Exiting.');
        process.exit(0);
      });

      // Fail-safe force exit after 5 seconds if connections hang
      setTimeout(() => {
        console.error('[LogSentinel Backend] Graceful shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 5000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((error) => {
  console.error('[LogSentinel Backend] Fatal error during startup:', error);
  process.exit(1);
});
