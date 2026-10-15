import { logger } from './logger.js';

export function setupGracefulShutdown({ logReader, sender, heartbeat, queue, stateStore }) {
  let isShuttingDown = false;

  async function handleSignal(signal) {
    if (isShuttingDown) {
      logger.warn('Shutdown', `Received ${signal} again. Forcing immediate termination.`);
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info('Shutdown', `Received ${signal}. Initiating graceful collector shutdown...`);

    // Safety watchdog: hard exit after 5 seconds if graceful drain stalls
    const forceExitTimer = setTimeout(() => {
      logger.error('Shutdown', 'Graceful shutdown timed out after 5s. Exiting process.');
      process.exit(1);
    }, 5000);

    try {
      // 1. Stop log reading
      if (logReader) {
        logReader.stop();
      }

      // 2. Stop periodic heartbeat
      if (heartbeat) {
        heartbeat.stop();
      }

      // 3. Stop periodic sender and attempt final drain of pending queue
      if (sender) {
        sender.stop();
        logger.info('Shutdown', 'Flushing remaining queue events to backend...');
        await sender.flushRemaining(3000);
      }

      // 4. Ensure queue and state are persisted to disk
      if (queue) {
        queue.saveToDisk();
      }

      clearTimeout(forceExitTimer);
      logger.info('Shutdown', 'Collector state preserved. Clean shutdown complete.');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExitTimer);
      logger.error('Shutdown', `Error during graceful shutdown: ${err.message}`);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}
