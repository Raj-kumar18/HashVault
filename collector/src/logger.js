/**
 * Safe, structured logger with automatic secret redaction.
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel = LOG_LEVELS.info;

/**
 * Configure global collector log level ('debug', 'info', 'warn', 'error')
 */
export function setLogLevel(level) {
  if (level && LOG_LEVELS[level.toLowerCase()] !== undefined) {
    currentLevel = LOG_LEVELS[level.toLowerCase()];
  }
}

/**
 * Redact sensitive secrets from log messages.
 * Matches:
 * - ent_[hex] (enrollment tokens)
 * - col_sec_[hex] (collector credentials)
 * - Bearer [token]
 */
export function redact(text) {
  if (typeof text !== 'string') {
    if (text instanceof Error) {
      return text.stack ? redact(text.stack) : redact(text.message);
    }
    if (typeof text === 'object') {
      try {
        return redact(JSON.stringify(text));
      } catch {
        return String(text);
      }
    }
    return String(text);
  }

  return text
    .replace(/ent_[a-fA-F0-9]{24,64}/g, 'ent_***REDACTED***')
    .replace(/col_sec_[a-fA-F0-9]{32,64}/g, 'col_sec_***REDACTED***')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1***REDACTED***')
    .replace(/("credential":\s*")[^"]+(")/gi, '$1***REDACTED***$2')
    .replace(/("token":\s*")[^"]+(")/gi, '$1***REDACTED***$2');
}

function formatMessage(level, component, message, meta) {
  const timestamp = new Date().toISOString();
  const compTag = component ? `[${component}]` : '[Collector]';
  const cleanMsg = redact(message);
  const metaStr = meta ? ` ${redact(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${compTag} ${cleanMsg}${metaStr}`;
}

export const logger = {
  debug(component, message, meta) {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', component, message, meta));
    }
  },

  info(component, message, meta) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.info(formatMessage('info', component, message, meta));
    }
  },

  warn(component, message, meta) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', component, message, meta));
    }
  },

  error(component, message, meta) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatMessage('error', component, message, meta));
    }
  },
};
