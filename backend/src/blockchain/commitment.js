import crypto from 'node:crypto';

/**
 * Normalizes a string to a 0x-prefixed 32-byte hex string (bytes32).
 */
export function toBytes32Hex(hexOrBuffer) {
  let hex;
  if (Buffer.isBuffer(hexOrBuffer)) {
    hex = hexOrBuffer.toString('hex');
  } else if (typeof hexOrBuffer === 'string') {
    hex = hexOrBuffer.startsWith('0x') ? hexOrBuffer.slice(2) : hexOrBuffer;
  } else {
    throw new TypeError('Expected string or Buffer for bytes32 conversion');
  }
  if (hex.length !== 64) {
    throw new Error(`Invalid bytes32 length: expected 64 hex chars, got ${hex.length}`);
  }
  return '0x' + hex.toLowerCase();
}

/**
 * Computes an application-scoped, privacy-preserving server commitment (bytes32).
 * Obfuscates serverId and avoids storing predictable internal identifiers on-chain.
 */
export function calculateServerCommitment(serverId, applicationId) {
  if (!serverId || !applicationId) {
    throw new Error('serverId and applicationId are required to compute serverCommitment');
  }
  const payload = `LOGSENTINEL:SERVER:${applicationId}:${serverId}`;
  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  return '0x' + digest;
}

/**
 * Converts a string application identifier into a bytes32 format.
 */
export function formatApplicationId(applicationId) {
  if (!applicationId) throw new Error('applicationId is required');
  const digest = crypto.createHash('sha256').update(`LOGSENTINEL:APP:${applicationId}`, 'utf8').digest('hex');
  return '0x' + digest;
}

/**
 * Calculates a deterministic, domain-separated cryptographic checkpoint commitment root (bytes32).
 * Binds version, application, server commitment, sequence boundaries, event count, and boundary hashes.
 */
export function calculateCheckpointRoot({
  commitmentVersion = '1',
  applicationId,
  serverCommitment,
  startSequence,
  endSequence,
  eventCount,
  startBoundaryHash,
  endBoundaryHash,
}) {
  if (!applicationId || !serverCommitment) {
    throw new Error('applicationId and serverCommitment are required for checkpoint root');
  }
  if (!startSequence || !endSequence || startSequence < 1 || endSequence < startSequence) {
    throw new Error(`Invalid sequence bounds: [${startSequence}, ${endSequence}]`);
  }
  if (!eventCount || eventCount !== endSequence - startSequence + 1) {
    throw new Error(`Event count mismatch: expected ${endSequence - startSequence + 1}, got ${eventCount}`);
  }
  if (!startBoundaryHash || !endBoundaryHash) {
    throw new Error('startBoundaryHash and endBoundaryHash are required for checkpoint root');
  }

  // Canonical domain-separated payload
  const canonicalPayload = [
    'LOGSENTINEL:ROOT',
    commitmentVersion,
    applicationId,
    serverCommitment.toLowerCase(),
    startSequence.toString(),
    endSequence.toString(),
    eventCount.toString(),
    startBoundaryHash.toLowerCase(),
    endBoundaryHash.toLowerCase(),
  ].join(':');

  const digest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
  return '0x' + digest;
}

/**
 * Computes a unique, deterministic checkpoint identifier (bytes32).
 * Prevents duplicate logical checkpoint collision and substitution attacks.
 */
export function calculateCheckpointId({
  applicationId,
  serverCommitment,
  startSequence,
  endSequence,
  checkpointRoot,
}) {
  if (!applicationId || !serverCommitment || !checkpointRoot) {
    throw new Error('applicationId, serverCommitment, and checkpointRoot are required for checkpointId');
  }

  const canonicalPayload = [
    'LOGSENTINEL:CHECKPOINT',
    applicationId,
    serverCommitment.toLowerCase(),
    startSequence.toString(),
    endSequence.toString(),
    checkpointRoot.toLowerCase(),
  ].join(':');

  const digest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
  return '0x' + digest;
}

/**
 * Validates that an array of records forms a contiguous, non-empty sequence range.
 */
export function validateContiguousRecords(records, expectedStart, expectedEnd) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      valid: false,
      reason: 'No records found for the specified range',
    };
  }

  const expectedCount = expectedEnd - expectedStart + 1;
  if (records.length !== expectedCount) {
    return {
      valid: false,
      reason: `Expected ${expectedCount} records in range [${expectedStart}, ${expectedEnd}], but found ${records.length}`,
    };
  }

  // Sort ascending by sequenceNumber
  const sorted = [...records].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  for (let i = 0; i < sorted.length; i++) {
    const expectedSeq = expectedStart + i;
    if (sorted[i].sequenceNumber !== expectedSeq) {
      return {
        valid: false,
        reason: `Sequence gap detected: expected #${expectedSeq}, got #${sorted[i].sequenceNumber}`,
        gapSequence: expectedSeq,
      };
    }
  }

  return {
    valid: true,
    startBoundaryHash: sorted[0].previousHash,
    endBoundaryHash: sorted[sorted.length - 1].eventHash,
    eventCount: sorted.length,
    firstRecord: sorted[0],
    lastRecord: sorted[sorted.length - 1],
  };
}
