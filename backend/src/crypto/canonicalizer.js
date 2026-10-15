import crypto from 'crypto';

export const HASH_VERSION = '1';
export const GENESIS_PREVIOUS_HASH = '0'.repeat(64);
export const GENESIS_SEQUENCE_NUMBER = 1;

/**
 * Deterministically canonicalizes a JavaScript value into a stable JSON string.
 * - Object keys are sorted alphabetically (ASCII order) recursively.
 * - Dates are converted to ISO strings.
 * - Numbers, booleans, strings, null, and arrays preserve their deterministic format.
 * - Undefined object values are excluded; undefined array items are converted to null.
 * 
 * @param {any} value
 * @returns {string} Canonical JSON string
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined') {
      return 'null';
    }
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    const elements = value.map((item) =>
      typeof item === 'undefined' ? 'null' : canonicalize(item)
    );
    return `[${elements.join(',')}]`;
  }

  // Object: sort keys in strict lexicographical order
  const keys = Object.keys(value).sort();
  const entries = [];

  for (const key of keys) {
    const val = value[key];
    if (typeof val !== 'undefined') {
      entries.push(`${JSON.stringify(key)}:${canonicalize(val)}`);
    }
  }

  return `{${entries.join(',')}}`;
}

/**
 * Constructs the canonical event payload object to be hashed into the chain.
 *
 * @param {object} event Raw or normalized log event
 * @returns {string} Canonical JSON string of protected event fields
 */
export function buildCanonicalEventPayload(event) {
  const payloadToProtect = {
    eventId: event.eventId,
    serverId: event.serverId,
    batchId: event.batchId,
    source: event.source,
    sourceOffset: typeof event.sourceOffset === 'number' ? event.sourceOffset : 0,
    message: event.message,
    observedAt: event.observedAt instanceof Date ? event.observedAt.toISOString() : new Date(event.observedAt).toISOString(),
    collectorMetadata: event.collectorMetadata || {},
  };

  return canonicalize(payloadToProtect);
}

/**
 * Calculates the SHA-256 event hash from unambiguous representation of:
 * - Hash format/version
 * - Server identifier
 * - Sequence number
 * - Previous event hash
 * - Canonical event payload
 *
 * @param {object} params
 * @param {string} [params.hashVersion]
 * @param {string} params.serverId
 * @param {number} params.sequenceNumber
 * @param {string} params.previousHash
 * @param {string} params.canonicalPayload
 * @returns {string} 64-character lowercase hexadecimal SHA-256 hash
 */
export function calculateEventHash({
  hashVersion = HASH_VERSION,
  serverId,
  sequenceNumber,
  previousHash,
  canonicalPayload,
}) {
  if (!serverId || typeof serverId !== 'string') {
    throw new Error('IntegrityError: serverId is required for hash calculation');
  }
  if (typeof sequenceNumber !== 'number' || !Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error('IntegrityError: sequenceNumber must be a positive integer');
  }
  if (!previousHash || typeof previousHash !== 'string' || previousHash.length !== 64) {
    throw new Error('IntegrityError: previousHash must be a 64-character hex string');
  }
  if (typeof canonicalPayload !== 'string') {
    throw new Error('IntegrityError: canonicalPayload must be a string');
  }

  const rawInput = `${hashVersion}:${serverId}:${sequenceNumber}:${previousHash}:${canonicalPayload}`;
  return crypto.createHash('sha256').update(rawInput, 'utf8').digest('hex');
}
