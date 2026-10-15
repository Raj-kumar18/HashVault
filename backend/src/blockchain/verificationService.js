import { Checkpoint } from '../models/Checkpoint.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { verifyServerChain } from '../services/integrity.service.js';
import { raiseOrUpdateAlert, autoResolveAlert } from '../services/alert.service.js';
import { getContract, getProvider } from './provider.js';
import {
  calculateCheckpointRoot,
  validateContiguousRecords,
} from './commitment.js';

/**
 * Executes independent cryptographic verification comparing active database history
 * with the immutable on-chain checkpoint commitment.
 */
export async function verifyCheckpointOnChain({ serverId, checkpointId, userId = null }) {
  const checkpoint = await Checkpoint.findOne({ serverId, checkpointId });
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found for server ${serverId}.`);
  }

  const findings = [];
  const checkedRange = {
    fromSequence: checkpoint.startSequence,
    toSequence: checkpoint.endSequence,
    recordCount: checkpoint.eventCount,
    startSequence: checkpoint.startSequence,
    endSequence: checkpoint.endSequence,
    eventCount: checkpoint.eventCount,
  };

  // 1. Query the on-chain contract state
  let onChainRecord = null;
  try {
    const contract = getContract(getProvider());
    const exists = await contract.checkpointExists(checkpoint.checkpointId);

    if (!exists) {
      const result = {
        success: true,
        status: 'UNANCHORED',
        message: 'Checkpoint record is not anchored on the configured blockchain contract.',
        checkpointId: checkpoint.checkpointId,
        serverId,
        checkedRange,
        verifiedAt: new Date(),
        findings: [
          {
            code: 'NOT_FOUND_ON_CHAIN',
            message: `Contract at ${checkpoint.contractAddress} has no record for checkpointId ${checkpoint.checkpointId}`,
          },
        ],
      };
      await recordVerificationAttempt(checkpoint, result, userId);
      return result;
    }

    onChainRecord = await contract.getCheckpoint(checkpoint.checkpointId);
  } catch (rpcError) {
    const result = {
      success: false,
      status: 'UNAVAILABLE',
      message: `Blockchain contract cannot currently be reached: ${rpcError.message}`,
      checkpointId: checkpoint.checkpointId,
      serverId,
      checkedRange,
      verifiedAt: new Date(),
      findings: [
        {
          code: 'RPC_UNAVAILABLE',
          message: rpcError.message,
        },
      ],
    };
    await recordVerificationAttempt(checkpoint, result, userId);
    return result;
  }

  const onChainRoot = onChainRecord.checkpointRoot.toLowerCase();
  const onChainServerCommitment = onChainRecord.serverCommitment.toLowerCase();
  const onChainStart = Number(onChainRecord.startSequence);
  const onChainEnd = Number(onChainRecord.endSequence);

  // 2. Validate on-chain metadata consistency against database projection
  if (onChainServerCommitment !== checkpoint.serverCommitment.toLowerCase()) {
    findings.push({
      code: 'SERVER_COMMITMENT_MISMATCH',
      message: 'On-chain server commitment does not match stored checkpoint metadata.',
      expected: onChainServerCommitment,
      actual: checkpoint.serverCommitment.toLowerCase(),
    });
  }
  if (onChainStart !== checkpoint.startSequence || onChainEnd !== checkpoint.endSequence) {
    findings.push({
      code: 'SEQUENCE_BOUNDS_MISMATCH',
      message: `On-chain range [${onChainStart}, ${onChainEnd}] does not match stored range [${checkpoint.startSequence}, ${checkpoint.endSequence}].`,
      expected: `[${onChainStart}, ${onChainEnd}]`,
      actual: `[${checkpoint.startSequence}, ${checkpoint.endSequence}]`,
    });
  }
  if (onChainRoot !== checkpoint.checkpointRoot.toLowerCase()) {
    findings.push({
      code: 'STORED_ROOT_MISMATCH',
      message: 'Stored checkpoint root does not match on-chain root.',
      expected: onChainRoot,
      actual: checkpoint.checkpointRoot.toLowerCase(),
    });
  }

  // 3. Independently load actual Phase 4 log records from database
  const records = await IntegrityRecord.find({
    serverId,
    sequenceNumber: { $gte: checkpoint.startSequence, $lte: checkpoint.endSequence },
  })
    .sort({ sequenceNumber: 1 })
    .lean();

  // Check for completeness and contiguous sequence
  const rangeValidation = validateContiguousRecords(
    records,
    checkpoint.startSequence,
    checkpoint.endSequence
  );

  if (!rangeValidation.valid) {
    findings.push({
      code: 'HISTORY_INCOMPLETE',
      message: `Historical record sequence is incomplete or gapped in database: ${rangeValidation.reason}`,
      expectedCount: checkpoint.eventCount,
      actualCount: records.length,
    });

    const result = {
      success: true,
      status: 'INCOMPLETE',
      message: 'Database history is incomplete or missing records compared to the anchored checkpoint.',
      checkpointId: checkpoint.checkpointId,
      serverId,
      checkedRange,
      onChainRoot,
      recomputedRoot: null,
      verifiedAt: new Date(),
      findings,
    };
    await recordVerificationAttempt(checkpoint, result, userId);
    return result;
  }

  // 4. Validate Phase 4 cryptographic hash chain across the range
  const phase4Verification = await verifyServerChain(serverId, {
    fromSequence: checkpoint.startSequence,
    toSequence: checkpoint.endSequence,
  });

  if (phase4Verification.status !== 'VERIFIED') {
    findings.push({
      code: 'CHAIN_TAMPERED',
      message: `Phase 4 SHA-256 sequential chain failed verification with status [${phase4Verification.status}].`,
      phase4Findings: phase4Verification.findings,
    });
  }

  // 5. Independently recompute checkpoint commitment from current database history
  let recomputedRoot = null;
  try {
    recomputedRoot = calculateCheckpointRoot({
      commitmentVersion: checkpoint.commitmentVersion,
      applicationId: checkpoint.applicationId,
      serverCommitment: checkpoint.serverCommitment,
      startSequence: checkpoint.startSequence,
      endSequence: checkpoint.endSequence,
      eventCount: checkpoint.eventCount,
      startBoundaryHash: rangeValidation.startBoundaryHash,
      endBoundaryHash: rangeValidation.endBoundaryHash,
    }).toLowerCase();
  } catch (calcError) {
    findings.push({
      code: 'RECOMPUTE_FAILED',
      message: `Failed to recalculate commitment: ${calcError.message}`,
    });
  }

  // 6. Compare recomputed root against immutable on-chain commitment
  if (recomputedRoot && recomputedRoot !== onChainRoot) {
    findings.push({
      code: 'COMMITMENT_MISMATCH',
      message:
        'CRITICAL: Cryptographic commitment computed from current database records does not match the immutable on-chain checkpoint root! Records have been tampered, modified, or forged.',
      expected: onChainRoot,
      actual: recomputedRoot,
    });
  }

  const finalStatus = findings.length === 0 ? 'VERIFIED' : 'MISMATCH';

  if (finalStatus === 'MISMATCH') {
    await raiseOrUpdateAlert({
      alertType: 'CHECKPOINT_MISMATCH',
      severity: 'CRITICAL',
      title: `On-Chain Checkpoint Mismatch: Checkpoint #${checkpoint.startSequence} → #${checkpoint.endSequence}`,
      description: `Cryptographic commitment calculated from active MongoDB records does not match immutable smart contract root. Database records have been modified or tampered.`,
      serverId: checkpoint.serverId,
      relatedCheckpointId: checkpoint.checkpointId,
      evidenceMetadata: {
        checkpointId: checkpoint.checkpointId,
        onChainRoot,
        recomputedRoot,
        findings,
      },
      dedupKey: `${checkpoint.serverId}:CHECKPOINT_MISMATCH:${checkpoint.checkpointId}`,
    });
  } else if (finalStatus === 'VERIFIED') {
    await autoResolveAlert(
      `${checkpoint.serverId}:CHECKPOINT_MISMATCH:${checkpoint.checkpointId}`,
      'Database records mathematically match on-chain commitment.'
    );
  }

  const result = {
    success: true,
    status: finalStatus,
    match: finalStatus === 'VERIFIED',
    message:
      finalStatus === 'VERIFIED'
        ? 'Current database records mathematically match the immutable on-chain checkpoint commitment.'
        : `Integrity mismatch detected between database records and on-chain commitment (${findings.length} findings).`,
    checkpointId: checkpoint.checkpointId,
    serverId,
    serverCommitment: checkpoint.serverCommitment,
    startSequence: checkpoint.startSequence,
    endSequence: checkpoint.endSequence,
    eventCount: checkpoint.eventCount,
    checkedRange,
    onChainRoot,
    recomputedRoot,
    onChain: {
      checkpointRoot: onChainRoot,
      anchorBlockNumber: checkpoint.blockNumber,
      transactionHash: checkpoint.transactionHash,
    },
    recomputed: {
      recomputedRoot,
    },
    verifiedAt: new Date(),
    findings,
  };

  await recordVerificationAttempt(checkpoint, result, userId);
  return result;
}

async function recordVerificationAttempt(checkpoint, result, userId) {
  try {
    checkpoint.verificationHistory.push({
      verifiedAt: result.verifiedAt || new Date(),
      status: result.status,
      recomputedRoot: result.recomputedRoot || null,
      onChainRoot: result.onChainRoot || null,
      checkedRange: result.checkedRange,
      findings: result.findings || [],
      verifiedBy: userId,
    });
    await checkpoint.save();
  } catch {
    // Non-fatal recording error
  }
}
