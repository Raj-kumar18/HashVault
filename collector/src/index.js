import { loadConfig, validateConfig, getSafeConfigSummary } from './config.js';
import { logger } from './logger.js';
import { StateStore } from './stateStore.js';
import { ensureEnrolled } from './enrollment.js';
import { PersistentQueue } from './queue.js';
import { Sender } from './sender.js';
import { Heartbeat } from './heartbeat.js';
import { LogReader } from './logReader.js';
import { setupGracefulShutdown } from './shutdown.js';

export async function bootstrapCollector(customConfig = {}) {
  logger.info('Bootstrap', 'Initializing LogSentinel Linux Collector Agent v1.0.0...');

  // 1. Load and validate configuration
  const config = loadConfig(customConfig);
  validateConfig(config);

  logger.info('Bootstrap', 'Configuration loaded:', JSON.stringify(getSafeConfigSummary(config)));

  // 2. Initialize persistent state store
  const stateStore = new StateStore(config.stateDir);

  // 3. Ensure collector enrollment & credentials
  const credential = await ensureEnrolled(config, stateStore);

  // 4. Initialize bounded durable queue
  const queue = new PersistentQueue({
    stateDir: config.stateDir,
    maxQueueBytes: config.maxQueueBytes,
    overflowPolicy: config.overflowPolicy,
  });

  // 5. Initialize event batch sender
  const sender = new Sender({
    backendUrl: config.backendUrl,
    serverId: config.serverId,
    credential,
    queue,
    batchSize: config.batchSize,
    flushIntervalMs: config.flushIntervalMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
  });

  // 6. Initialize periodic heartbeat
  const heartbeat = new Heartbeat({
    backendUrl: config.backendUrl,
    serverId: config.serverId,
    credential,
    intervalMs: config.heartbeatIntervalMs,
    agentVersion: '1.0.0',
    getQueueCount: () => queue.getPendingCount(),
    getLastSendAt: () => sender.lastSuccessfulSendAt,
    getSourcesCount: () => config.sources.length,
  });

  // 7. Initialize log reader for configured sources
  const logReader = new LogReader({
    sources: config.sources,
    serverId: config.serverId,
    stateStore,
    onEvents: (events) => {
      queue.enqueue(events);
      // Trigger prompt flush when new events arrive
      sender.flush();
    },
  });

  // 8. Attach graceful termination signals
  setupGracefulShutdown({ logReader, sender, heartbeat, queue, stateStore });

  // 9. Start background tasks
  sender.start();
  heartbeat.start();
  logReader.start();

  logger.info(
    'Bootstrap',
    `LogSentinel Collector active on server [${config.serverId}]. Monitoring ${config.sources.length} source(s).`
  );

  return { config, stateStore, queue, sender, heartbeat, logReader };
}

// Auto-run if executed directly as main script
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  bootstrapCollector().catch((err) => {
    logger.error('Fatal', `Failed to start collector agent: ${err.message}`);
    process.exit(1);
  });
}
