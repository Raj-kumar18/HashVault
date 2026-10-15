import fs from 'node:fs';
import path from 'node:path';
import { setLogLevel } from './logger.js';

export const DEFAULT_CONFIG = {
  backendUrl: 'http://localhost:5001/api',
  serverId: '',
  enrollmentToken: '',
  credential: '',
  sources: [],
  batchSize: 50,
  flushIntervalMs: 2000,
  heartbeatIntervalMs: 30000,
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 30000,
  stateDir: path.resolve(process.cwd(), '.state'),
  maxQueueBytes: 50 * 1024 * 1024, // 50 MB bound
  overflowPolicy: 'drop-oldest', // 'drop-oldest' or 'reject-incoming'
  logLevel: 'info',
};

/**
 * Resolves config file path based on priority:
 * 1. CLI flag --config <path>
 * 2. Environment variable LOGSENTINEL_CONFIG
 * 3. System path /etc/logsentinel/collector.json
 * 4. Local ./config/config.json
 */
export function resolveConfigFilePath() {
  const args = process.argv.slice(2);
  const configFlagIndex = args.indexOf('--config');
  if (configFlagIndex !== -1 && args[configFlagIndex + 1]) {
    return path.resolve(args[configFlagIndex + 1]);
  }

  if (process.env.LOGSENTINEL_CONFIG) {
    return path.resolve(process.env.LOGSENTINEL_CONFIG);
  }

  const systemPath = '/etc/logsentinel/collector.json';
  if (fs.existsSync(systemPath)) {
    return systemPath;
  }

  const localPath = path.resolve(process.cwd(), 'config/config.json');
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  return null;
}

/**
 * Parses supported CLI flags:
 * --server / --serverId <id>
 * --enroll / --token / --enrollmentToken <token>
 * --backend / --backendUrl <url>
 * --sources <path1,path2>
 * --stateDir <dir>
 */
export function parseCliArgs() {
  const args = process.argv.slice(2);
  const cli = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === '--server' || arg === '--serverId') && next && !next.startsWith('--')) {
      cli.serverId = next.trim();
      i++;
    } else if (
      (arg === '--enroll' || arg === '--token' || arg === '--enrollmentToken') &&
      next &&
      !next.startsWith('--')
    ) {
      cli.enrollmentToken = next.trim();
      i++;
    } else if ((arg === '--backend' || arg === '--backendUrl') && next && !next.startsWith('--')) {
      cli.backendUrl = next.trim();
      i++;
    } else if (arg === '--sources' && next && !next.startsWith('--')) {
      cli.sources = next.split(',').map((s) => ({ path: s.trim() }));
      i++;
    } else if (arg === '--stateDir' && next && !next.startsWith('--')) {
      cli.stateDir = path.resolve(next.trim());
      i++;
    }
  }
  return cli;
}

/**
 * Loads configuration from file and overrides with environment variables and CLI arguments.
 */
export function loadConfig(customOverrides = {}) {
  let fileConfig = {};
  const configFilePath = customOverrides.configFilePath || resolveConfigFilePath();

  if (configFilePath && fs.existsSync(configFilePath)) {
    try {
      const raw = fs.readFileSync(configFilePath, 'utf8');
      fileConfig = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse configuration file at ${configFilePath}: ${err.message}`);
    }
  }

  // Environment variable overrides
  const envConfig = {};
  if (process.env.LOGSENTINEL_BACKEND_URL || process.env.BACKEND_URL) {
    envConfig.backendUrl = process.env.LOGSENTINEL_BACKEND_URL || process.env.BACKEND_URL;
  }
  if (process.env.LOGSENTINEL_SERVER_ID || process.env.SERVER_ID) {
    envConfig.serverId = process.env.LOGSENTINEL_SERVER_ID || process.env.SERVER_ID;
  }
  if (process.env.LOGSENTINEL_ENROLLMENT_TOKEN || process.env.ENROLLMENT_TOKEN) {
    envConfig.enrollmentToken = process.env.LOGSENTINEL_ENROLLMENT_TOKEN || process.env.ENROLLMENT_TOKEN;
  }
  if (process.env.LOGSENTINEL_CREDENTIAL || process.env.COLLECTOR_CREDENTIAL) {
    envConfig.credential = process.env.LOGSENTINEL_CREDENTIAL || process.env.COLLECTOR_CREDENTIAL;
  }
  if (process.env.LOGSENTINEL_STATE_DIR || process.env.STATE_DIR) {
    envConfig.stateDir = path.resolve(process.env.LOGSENTINEL_STATE_DIR || process.env.STATE_DIR);
  }
  if (process.env.LOGSENTINEL_BATCH_SIZE) {
    envConfig.batchSize = parseInt(process.env.LOGSENTINEL_BATCH_SIZE, 10);
  }
  if (process.env.LOGSENTINEL_FLUSH_INTERVAL_MS) {
    envConfig.flushIntervalMs = parseInt(process.env.LOGSENTINEL_FLUSH_INTERVAL_MS, 10);
  }
  if (process.env.LOGSENTINEL_HEARTBEAT_INTERVAL_MS) {
    envConfig.heartbeatIntervalMs = parseInt(process.env.LOGSENTINEL_HEARTBEAT_INTERVAL_MS, 10);
  }
  if (process.env.LOGSENTINEL_MAX_QUEUE_BYTES) {
    envConfig.maxQueueBytes = parseInt(process.env.LOGSENTINEL_MAX_QUEUE_BYTES, 10);
  }
  if (process.env.LOGSENTINEL_OVERFLOW_POLICY) {
    envConfig.overflowPolicy = process.env.LOGSENTINEL_OVERFLOW_POLICY;
  }
  if (process.env.LOGSENTINEL_LOG_LEVEL) {
    envConfig.logLevel = process.env.LOGSENTINEL_LOG_LEVEL;
  }
  if (process.env.LOGSENTINEL_SOURCES) {
    try {
      envConfig.sources = JSON.parse(process.env.LOGSENTINEL_SOURCES);
    } catch {
      envConfig.sources = process.env.LOGSENTINEL_SOURCES.split(',').map((s) => ({
        path: s.trim(),
      }));
    }
  }

  // CLI argument overrides
  const cliConfig = parseCliArgs();

  // Merge: defaults < fileConfig < envConfig < cliConfig < customOverrides
  const merged = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
    ...cliConfig,
    ...customOverrides,
  };

  // Normalize sources: accept array of string paths or objects
  if (Array.isArray(merged.sources)) {
    merged.sources = merged.sources.map((s) => {
      if (typeof s === 'string') {
        return { path: path.resolve(s), pollIntervalMs: 1000 };
      }
      return {
        path: path.resolve(s.path),
        pollIntervalMs: s.pollIntervalMs || 1000,
      };
    });
  } else {
    merged.sources = [];
  }

  // Ensure stateDir is absolute
  merged.stateDir = path.resolve(merged.stateDir);

  // Apply log level
  setLogLevel(merged.logLevel);

  return merged;
}

/**
 * Validates configuration at startup and fails closed if invalid.
 */
export function validateConfig(config) {
  if (!config.backendUrl || typeof config.backendUrl !== 'string') {
    throw new Error('Config ValidationError: backendUrl is required.');
  }

  try {
    const url = new URL(config.backendUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('backendUrl protocol must be HTTP or HTTPS.');
    }
  } catch (err) {
    throw new Error(`Config ValidationError: Invalid backendUrl format (${err.message})`);
  }

  if (!config.serverId || typeof config.serverId !== 'string' || !config.serverId.trim()) {
    throw new Error('Config ValidationError: serverId is required.');
  }

  if (config.batchSize <= 0 || config.batchSize > 500) {
    throw new Error('Config ValidationError: batchSize must be between 1 and 500.');
  }

  if (config.flushIntervalMs < 100) {
    throw new Error('Config ValidationError: flushIntervalMs must be at least 100ms.');
  }

  if (config.heartbeatIntervalMs < 1000) {
    throw new Error('Config ValidationError: heartbeatIntervalMs must be at least 1000ms.');
  }

  if (!['drop-oldest', 'reject-incoming'].includes(config.overflowPolicy)) {
    throw new Error('Config ValidationError: overflowPolicy must be drop-oldest or reject-incoming.');
  }

  return true;
}

/**
 * Returns safe diagnostic view of configuration with all secrets redacted.
 */
export function getSafeConfigSummary(config) {
  return {
    backendUrl: config.backendUrl,
    serverId: config.serverId,
    isEnrolled: Boolean(config.credential),
    hasEnrollmentToken: Boolean(config.enrollmentToken),
    sourcesCount: config.sources.length,
    sources: config.sources.map((s) => s.path),
    batchSize: config.batchSize,
    flushIntervalMs: config.flushIntervalMs,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    stateDir: config.stateDir,
    maxQueueBytes: config.maxQueueBytes,
    overflowPolicy: config.overflowPolicy,
    logLevel: config.logLevel,
  };
}
