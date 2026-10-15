import crypto from 'crypto';
import os from 'node:os';

const AGENT_VERSION = '1.0.0';

/**
 * Normalizes raw log lines into the canonical LogSentinel event envelope.
 * Strictly passive string processing; never interprets or executes log contents.
 */
export function normalizeLogLine(rawLine, sourcePath, byteOffset, serverId) {
  const message = typeof rawLine === 'string' ? rawLine : String(rawLine);
  const offset = typeof byteOffset === 'number' ? byteOffset : 0;
  // Deterministic eventId ensures duplicate reads of the exact same line at the same offset generate identical IDs
  const lineDigest = crypto
    .createHash('sha256')
    .update(`${serverId || ''}:${sourcePath}:${offset}:${message}`)
    .digest('hex')
    .slice(0, 24);

  return {
    eventId: `evt_${lineDigest}`,
    source: sourcePath,
    observedAt: new Date().toISOString(),
    message,
    sourceOffset: offset,
    collectorMetadata: {
      hostname: os.hostname(),
      agentVersion: AGENT_VERSION,
      serverId: serverId || '',
      pid: process.pid,
    },
  };
}
