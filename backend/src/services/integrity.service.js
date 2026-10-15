import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { Server } from '../models/Server.js';
import { LogEvent } from '../models/LogEvent.js';
import { raiseOrUpdateAlert, autoResolveAlert } from './alert.service.js';
import {
  HASH_VERSION,
  GENESIS_PREVIOUS_HASH,
  GENESIS_SEQUENCE_NUMBER,
  buildCanonicalEventPayload,
  calculateEventHash,
} from '../crypto/canonicalizer.js';

// In-memory per-server lock to serialize concurrent ingestion per server safely
const serverLocks = new Map();

/**
 * Executes an async task while holding an exclusive lock for a given serverId.
 * Prevents race conditions and forked sequences during concurrent batch arrivals.
 */
export async function withServerLock(serverId, task) {
  const previousLock = serverLocks.get(serverId) || Promise.resolve();

  let releaseLock;
  const currentLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  serverLocks.set(
    serverId,
    previousLock.then(() => currentLock).catch(() => currentLock)
  );

  await previousLock;

  try {
    return await task();
  } finally {
    releaseLock();
    if (serverLocks.get(serverId) === currentLock) {
      serverLocks.delete(serverId);
    }
  }
}

/**
 * Appends a batch of validated log events to a server's immutable SHA-256 hash chain.
 * Handles deduplication, atomic sequence allocation, and chain linkage.
 *
 * @param {object} server Mongoose Server document
 * @param {Array<object>} events Array of normalized event objects
 * @returns {Promise<{ accepted: Array<object>, duplicates: Array<string> }>}
 */
export async function appendBatchToChain(server, events) {
  if (!events || events.length === 0) {
    return { accepted: [], duplicates: [] };
  }

  return withServerLock(server.serverId, async () => {
    // 1. Fetch latest record to determine current chain head
    const latestRecord = await IntegrityRecord.findOne({ serverId: server.serverId })
      .sort({ sequenceNumber: -1 })
      .lean();

    let currentSequence = latestRecord ? latestRecord.sequenceNumber : 0;
    let currentHash = latestRecord ? latestRecord.eventHash : GENESIS_PREVIOUS_HASH;

    // 2. Check for pre-existing event IDs to guarantee idempotency
    const candidateEventIds = events.map((e) => e.eventId);
    const existingRecords = await IntegrityRecord.find({
      serverId: server.serverId,
      eventId: { $in: candidateEventIds },
    })
      .select('eventId sequenceNumber eventHash')
      .lean();

    const existingIdMap = new Map(existingRecords.map((r) => [r.eventId, r]));
    const acceptedRecordsToInsert = [];
    const duplicates = [];

    for (const event of events) {
      if (existingIdMap.has(event.eventId)) {
        duplicates.push(event.eventId);
        continue;
      }

      currentSequence += 1;
      const canonicalPayload = buildCanonicalEventPayload(event);
      const previousHash = currentHash;

      const eventHash = calculateEventHash({
        hashVersion: HASH_VERSION,
        serverId: server.serverId,
        sequenceNumber: currentSequence,
        previousHash,
        canonicalPayload,
      });

      const integrityDoc = {
        serverId: server.serverId,
        serverRef: server._id,
        sequenceNumber: currentSequence,
        eventId: event.eventId,
        canonicalPayload,
        previousHash,
        eventHash,
        hashVersion: HASH_VERSION,
        receivedAt: new Date(),
        source: event.source || '',
        message: event.message || '',
        observedAt: event.observedAt ? new Date(event.observedAt) : null,
      };

      acceptedRecordsToInsert.push(integrityDoc);
      currentHash = eventHash;
    }

    if (acceptedRecordsToInsert.length > 0) {
      // Insert new records. Compound unique indexes ensure single-sequence guarantee.
      await IntegrityRecord.insertMany(acceptedRecordsToInsert, { ordered: true });

      // Update server's chain head state
      server.chainHeadSequence = currentSequence;
      server.chainHeadHash = currentHash;
      server.chainHeadUpdatedAt = new Date();
      await server.save();
    }

    return {
      accepted: acceptedRecordsToInsert,
      duplicates,
    };
  });
}

/**
 * Recomputes and verifies the cryptographic integrity of a server's hash chain.
 * Detects payload tampering, hash alteration, broken previous-hash links, and sequence gaps.
 *
 * @param {string} serverId Target server identifier
 * @param {object} [options]
 * @param {number} [options.fromSequence] Optional starting sequence
 * @param {number} [options.toSequence] Optional ending sequence
 * @returns {Promise<object>} Structured verification findings
 */
export async function verifyServerChain(serverId, options = {}) {
  const server = await Server.findOne({ serverId });
  if (!server) {
    const error = new Error(`Server ${serverId} not found`);
    error.status = 404;
    throw error;
  }

  const totalRecordsCount = await IntegrityRecord.countDocuments({ serverId });

  // If server has no records at all
  if (totalRecordsCount === 0) {
    const status = options.fromSequence && options.fromSequence > 1 ? 'INCOMPLETE' : 'VERIFIED';
    return {
      status,
      serverId,
      serverName: server.serverName,
      checkedRange: {
        fromSequence: options.fromSequence || 0,
        toSequence: options.toSequence || 0,
      },
      recordsChecked: 0,
      totalEventsInChain: 0,
      expectedChainHead: GENESIS_PREVIOUS_HASH,
      actualChainHead: GENESIS_PREVIOUS_HASH,
      findings: [
        {
          type: 'EMPTY_CHAIN',
          severity: 'INFO',
          sequenceNumber: null,
          message: 'No log events have been recorded for this server yet.',
        },
      ],
      verifiedAt: new Date().toISOString(),
    };
  }

  // Determine sequence range to verify
  const startSeq = options.fromSequence && options.fromSequence >= 1 ? options.fromSequence : 1;
  const endSeq =
    options.toSequence && options.toSequence >= startSeq
      ? options.toSequence
      : server.chainHeadSequence || totalRecordsCount;

  // Query records in range sorted strictly by sequenceNumber ascending
  const query = {
    serverId,
    sequenceNumber: { $gte: startSeq, $lte: endSeq },
  };

  const records = await IntegrityRecord.find(query)
    .sort({ sequenceNumber: 1 })
    .lean();

  const findings = [];
  let isTampered = false;
  let isIncomplete = false;

  // 1. Check if history before startSeq is missing when startSeq > 1
  let expectedPreviousHash = GENESIS_PREVIOUS_HASH;

  if (startSeq > 1) {
    const precedingRecord = await IntegrityRecord.findOne({
      serverId,
      sequenceNumber: startSeq - 1,
    }).lean();

    if (!precedingRecord) {
      isIncomplete = true;
      findings.push({
        type: 'MISSING_PRECEDING_HISTORY',
        severity: 'WARNING',
        sequenceNumber: startSeq - 1,
        message: `Verification started at sequence ${startSeq}, but previous sequence ${startSeq - 1} was not found to anchor previousHash.`,
      });
      // Fallback: trust the first record's previousHash for partial range
      if (records.length > 0) {
        expectedPreviousHash = records[0].previousHash;
      }
    } else {
      expectedPreviousHash = precedingRecord.eventHash;
    }
  }

  // 2. Check if records array is empty despite non-empty chain
  if (records.length === 0) {
    isIncomplete = true;
    findings.push({
      type: 'RANGE_EMPTY',
      severity: 'WARNING',
      sequenceNumber: startSeq,
      message: `No records found in requested range [${startSeq} .. ${endSeq}]. Total events in chain: ${totalRecordsCount}.`,
    });
  }

  let expectedSeq = startSeq;
  let actualChainHead = expectedPreviousHash;

  // 3. Step-by-step verification of each record in sequence
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Sequence contiguity check
    if (record.sequenceNumber !== expectedSeq) {
      isTampered = true;
      findings.push({
        type: 'SEQUENCE_GAP',
        severity: 'CRITICAL',
        sequenceNumber: expectedSeq,
        message: `Sequence discontinuity detected: expected sequence #${expectedSeq}, but encountered #${record.sequenceNumber}.`,
        expected: expectedSeq,
        actual: record.sequenceNumber,
      });
      expectedSeq = record.sequenceNumber; // Synchronize to inspect remaining
    }

    // Genesis validation on first sequence
    if (record.sequenceNumber === 1 && record.previousHash !== GENESIS_PREVIOUS_HASH) {
      isTampered = true;
      findings.push({
        type: 'INVALID_GENESIS',
        severity: 'CRITICAL',
        sequenceNumber: 1,
        message: `Genesis record sequence #1 has invalid previousHash. Must equal 64 zeros.`,
        expected: GENESIS_PREVIOUS_HASH,
        actual: record.previousHash,
      });
    }

    // Previous hash link validation
    if (record.previousHash !== expectedPreviousHash && !(startSeq > 1 && i === 0 && isIncomplete)) {
      isTampered = true;
      findings.push({
        type: 'BROKEN_CHAIN_LINK',
        severity: 'CRITICAL',
        sequenceNumber: record.sequenceNumber,
        message: `Broken cryptographic link at sequence #${record.sequenceNumber}: previousHash does not match previous record eventHash.`,
        expected: expectedPreviousHash,
        actual: record.previousHash,
      });
    }

    // Payload hash recomputation check
    let recomputedHash;
    try {
      recomputedHash = calculateEventHash({
        hashVersion: record.hashVersion,
        serverId: record.serverId,
        sequenceNumber: record.sequenceNumber,
        previousHash: record.previousHash,
        canonicalPayload: record.canonicalPayload,
      });
    } catch (err) {
      isTampered = true;
      findings.push({
        type: 'HASH_CALCULATION_ERROR',
        severity: 'CRITICAL',
        sequenceNumber: record.sequenceNumber,
        message: `Failed to calculate hash for sequence #${record.sequenceNumber}: ${err.message}`,
      });
      recomputedHash = null;
    }

    if (recomputedHash && recomputedHash !== record.eventHash) {
      isTampered = true;
      findings.push({
        type: 'HASH_MISMATCH',
        severity: 'CRITICAL',
        sequenceNumber: record.sequenceNumber,
        message: `Cryptographic payload tampering detected at sequence #${record.sequenceNumber}! Stored hash differs from recomputed SHA-256 hash.`,
        expected: recomputedHash,
        actual: record.eventHash,
      });
    }

    // Direct database document tampering check: verify MongoDB convenience fields match sealed canonicalPayload
    if (record.canonicalPayload) {
      try {
        const parsed = JSON.parse(record.canonicalPayload);
        if (record.message && parsed.message !== record.message) {
          isTampered = true;
          findings.push({
            type: 'HASH_MISMATCH',
            severity: 'CRITICAL',
            sequenceNumber: record.sequenceNumber,
            message: `Cryptographic payload tampering detected at sequence #${record.sequenceNumber}! Stored document message does not match cryptographically sealed canonicalPayload.`,
            expected: parsed.message,
            actual: record.message,
          });
        }
        if (record.source && parsed.source !== record.source) {
          isTampered = true;
          findings.push({
            type: 'HASH_MISMATCH',
            severity: 'CRITICAL',
            sequenceNumber: record.sequenceNumber,
            message: `Cryptographic source tampering detected at sequence #${record.sequenceNumber}! Stored document source does not match sealed canonicalPayload.`,
            expected: parsed.source,
            actual: record.source,
          });
        }
      } catch (jsonErr) {
        isTampered = true;
        findings.push({
          type: 'HASH_MISMATCH',
          severity: 'CRITICAL',
          sequenceNumber: record.sequenceNumber,
          message: `Malformed canonical payload detected at sequence #${record.sequenceNumber}: ${jsonErr.message}`,
        });
      }
    }

    // Cross-collection consistency check: verify LogEvent reflects the sealed record
    const corLog = await LogEvent.findOne({
      serverId: record.serverId,
      sequenceNumber: record.sequenceNumber,
    }).lean();
    if (corLog) {
      if (corLog.eventHash && corLog.eventHash !== record.eventHash) {
        isTampered = true;
        findings.push({
          type: 'HASH_MISMATCH',
          severity: 'CRITICAL',
          sequenceNumber: record.sequenceNumber,
          message: `Cross-collection log tampering detected at sequence #${record.sequenceNumber}! LogEvent eventHash differs from cryptographically sealed IntegrityRecord.`,
          expected: record.eventHash,
          actual: corLog.eventHash,
        });
      }
      if (corLog.message && corLog.message !== record.message) {
        isTampered = true;
        findings.push({
          type: 'HASH_MISMATCH',
          severity: 'CRITICAL',
          sequenceNumber: record.sequenceNumber,
          message: `Cross-collection log tampering detected at sequence #${record.sequenceNumber}! LogEvent message differs from cryptographically sealed IntegrityRecord.`,
          expected: record.message,
          actual: corLog.message,
        });
      }
    }

    // Advance expectations
    expectedPreviousHash = record.eventHash;
    actualChainHead = record.eventHash;
    expectedSeq += 1;
  }

  // Determine final status
  let overallStatus = 'VERIFIED';
  if (isTampered) {
    overallStatus = 'TAMPERED';
  } else if (isIncomplete || records.length < (endSeq - startSeq + 1)) {
    if (records.length < (endSeq - startSeq + 1)) {
      overallStatus = 'INCOMPLETE';
      findings.push({
        type: 'INCOMPLETE_RANGE',
        severity: 'WARNING',
        sequenceNumber: expectedSeq,
        message: `Examined ${records.length} records, but range expected ${endSeq - startSeq + 1} records.`,
      });
    } else {
      overallStatus = 'INCOMPLETE';
    }
  }

  // Update server document with verification state
  server.lastVerificationStatus = overallStatus;
  server.lastVerifiedAt = new Date();
  server.lastVerifiedRange = {
    fromSequence: startSeq,
    toSequence: endSeq,
    recordsChecked: records.length,
    status: overallStatus,
  };
  await server.save();

  // Immediately raise or auto-resolve security alerts
  if (overallStatus === 'TAMPERED') {
    const primaryFinding = findings.find((f) => f.severity === 'CRITICAL') || findings[0];
    const alertType = primaryFinding?.type === 'SEQUENCE_GAP' ? 'SEQUENCE_GAP' : 'HASH_CHAIN_MISMATCH';
    await raiseOrUpdateAlert({
      alertType,
      severity: 'CRITICAL',
      title: alertType === 'SEQUENCE_GAP'
        ? `Log Deletion / Sequence Gap Detected on ${server.serverName}`
        : `Database Log Tampering Detected on ${server.serverName}`,
      description: primaryFinding?.message || `Cryptographic SHA-256 hash verification failed for ${server.serverName}. Records have been directly altered in MongoDB.`,
      serverId: server.serverId,
      serverName: server.serverName,
      serverRef: server._id,
      relatedSequence: primaryFinding?.sequenceNumber || null,
      evidenceMetadata: {
        lastVerificationStatus: overallStatus,
        findings,
        checkedRange: { fromSequence: startSeq, toSequence: endSeq },
        tamperedSequence: primaryFinding?.sequenceNumber,
        expected: primaryFinding?.expected,
        actual: primaryFinding?.actual,
      },
      dedupKey: `${server.serverId}:${alertType}`,
    });
  } else if (overallStatus === 'INCOMPLETE') {
    await raiseOrUpdateAlert({
      alertType: 'SEQUENCE_GAP',
      severity: 'HIGH',
      title: `Sequence Gap Detected on ${server.serverName}`,
      description: `Historical records are missing or broken between sequence boundaries on ${server.serverName}.`,
      serverId: server.serverId,
      serverName: server.serverName,
      serverRef: server._id,
      evidenceMetadata: { findings },
      dedupKey: `${server.serverId}:SEQUENCE_GAP`,
    });
  } else if (overallStatus === 'VERIFIED' && records.length > 0) {
    await autoResolveAlert(`${server.serverId}:HASH_CHAIN_MISMATCH`, 'Cryptographic hash chain verified with zero tampering.');
    await autoResolveAlert(`${server.serverId}:SEQUENCE_GAP`, 'Log sequence continuity verified.');
  }

  return {
    status: overallStatus,
    serverId: server.serverId,
    serverName: server.serverName,
    checkedRange: {
      fromSequence: startSeq,
      toSequence: records.length > 0 ? records[records.length - 1].sequenceNumber : startSeq,
    },
    recordsChecked: records.length,
    totalEventsInChain: totalRecordsCount,
    expectedChainHead: server.chainHeadHash,
    actualChainHead,
    findings,
    verifiedAt: new Date().toISOString(),
  };
}
