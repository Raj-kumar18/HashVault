import { Checkpoint } from '../models/Checkpoint.js';
import { Server } from '../models/Server.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { verifyServerChain } from '../services/integrity.service.js';
import { getBlockchainConfig } from './config.js';
import {
  calculateServerCommitment,
  calculateCheckpointRoot,
  calculateCheckpointId,
  formatApplicationId,
  validateContiguousRecords,
} from './commitment.js';
import { getContract, getSigner, getProvider } from './provider.js';

/**
 * Prepares and cryptographically validates the sequence range and commitments for a checkpoint.
 */
export async function prepareCheckpointRange({ serverId, startSequence, endSequence }) {
  const config = getBlockchainConfig();

  const server = await Server.findOne({ serverId });
  if (!server) {
    throw new Error(`Server ${serverId} not found`);
  }

  const chainHead = server.chainHeadSequence || 0;
  if (chainHead < 1) {
    throw new Error(`Server ${serverId} has no sealed log events in its hash chain (chain head is at genesis).`);
  }

  // Determine start sequence if not provided
  let startSeq =
    startSequence !== undefined && startSequence !== null
      ? parseInt(startSequence, 10)
      : null;
  if (startSeq === null || isNaN(startSeq)) {
    const latestConfirmed = await Checkpoint.findOne({
      serverId,
      transactionStatus: 'CONFIRMED',
    }).sort({ endSequence: -1 });

    startSeq = latestConfirmed ? latestConfirmed.endSequence + 1 : 1;
  }

  // Determine end sequence if not provided
  let endSeq = endSequence ? parseInt(endSequence, 10) : chainHead;

  if (startSeq < 1) {
    throw new Error(`startSequence must be >= 1 (received ${startSeq})`);
  }
  if (endSeq < startSeq) {
    throw new Error(`endSequence (${endSeq}) cannot be less than startSequence (${startSeq})`);
  }
  if (endSeq > chainHead) {
    throw new Error(`endSequence (${endSeq}) exceeds current chain head sequence (#${chainHead})`);
  }

  const expectedCount = endSeq - startSeq + 1;

  // Read Phase 4 integrity records in the requested range
  const records = await IntegrityRecord.find({
    serverId,
    sequenceNumber: { $gte: startSeq, $lte: endSeq },
  })
    .sort({ sequenceNumber: 1 })
    .lean();

  // Validate contiguous records without gaps
  const validation = validateContiguousRecords(records, startSeq, endSeq);
  if (!validation.valid) {
    throw new Error(`Checkpoint range validation failed: ${validation.reason}`);
  }

  // Verify Phase 4 cryptographic chain across the range
  const chainVerification = await verifyServerChain(serverId, {
    fromSequence: startSeq,
    toSequence: endSeq,
  });

  if (chainVerification.status !== 'VERIFIED') {
    throw new Error(
      `Cannot anchor checkpoint: Phase 4 cryptographic chain validation failed with status [${chainVerification.status}] (${chainVerification.findings?.length || 0} findings).`
    );
  }

  // Calculate commitments
  const serverCommitment = calculateServerCommitment(serverId, config.applicationId);
  const checkpointRoot = calculateCheckpointRoot({
    commitmentVersion: '1',
    applicationId: config.applicationId,
    serverCommitment,
    startSequence: startSeq,
    endSequence: endSeq,
    eventCount: expectedCount,
    startBoundaryHash: validation.startBoundaryHash,
    endBoundaryHash: validation.endBoundaryHash,
  });

  const checkpointId = calculateCheckpointId({
    applicationId: config.applicationId,
    serverCommitment,
    startSequence: startSeq,
    endSequence: endSeq,
    checkpointRoot,
  });

  return {
    server,
    startSequence: startSeq,
    endSequence: endSeq,
    eventCount: expectedCount,
    startBoundaryHash: validation.startBoundaryHash,
    endBoundaryHash: validation.endBoundaryHash,
    serverCommitment,
    checkpointRoot,
    checkpointId,
    applicationId: config.applicationId,
    config,
  };
}

/**
 * Creates or retrieves an existing checkpoint record (enforcing logical idempotency).
 */
export async function createOrGetCheckpoint({ serverId, startSequence, endSequence, userId }) {
  const prep = await prepareCheckpointRange({ serverId, startSequence, endSequence });

  // 1. Check if checkpoint with this exact ID already exists in MongoDB
  let checkpoint = await Checkpoint.findOne({ checkpointId: prep.checkpointId });
  if (checkpoint) {
    return { checkpoint, isNew: false, prep };
  }

  // 2. Check if a checkpoint covering this exact sequence range already exists
  const existingRange = await Checkpoint.findOne({
    serverId,
    startSequence: prep.startSequence,
    endSequence: prep.endSequence,
  });
  if (existingRange) {
    return { checkpoint: existingRange, isNew: false, prep };
  }

  // 3. Create new checkpoint in MongoDB with PENDING status
  checkpoint = await Checkpoint.create({
    checkpointId: prep.checkpointId,
    applicationId: prep.applicationId,
    serverId,
    serverCommitment: prep.serverCommitment,
    startSequence: prep.startSequence,
    endSequence: prep.endSequence,
    eventCount: prep.eventCount,
    commitmentVersion: '1',
    startBoundaryHash: prep.startBoundaryHash,
    endBoundaryHash: prep.endBoundaryHash,
    checkpointRoot: prep.checkpointRoot,
    networkChainId: prep.config.expectedChainId,
    networkName: prep.config.networkName,
    contractAddress: prep.config.contractAddress,
    transactionStatus: 'PENDING',
    createdBy: userId,
  });

  return { checkpoint, isNew: true, prep };
}

/**
 * Submits the checkpoint anchoring transaction to the smart contract and waits for receipt.
 */
export async function executeAnchoringTransaction(checkpointOrId) {
  const query = typeof checkpointOrId === 'string'
    ? { checkpointId: checkpointOrId }
    : checkpointOrId?.checkpointId
    ? { checkpointId: checkpointOrId.checkpointId }
    : { _id: checkpointOrId?._id };

  const checkpoint = await Checkpoint.findOne(query);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${typeof checkpointOrId === 'string' ? checkpointOrId : checkpointOrId?.checkpointId} not found in database.`);
  }

  if (checkpoint.transactionStatus === 'CONFIRMED') {
    return checkpoint;
  }

  const config = getBlockchainConfig();
  if (!config.enabled) {
    throw new Error('Blockchain anchoring is disabled in configuration.');
  }

  const signer = getSigner();
  const contract = getContract(signer);

  checkpoint.lastAttemptAt = new Date();
  checkpoint.retryCount += 1;

  try {
    // Check if contract already registered this checkpoint
    const alreadyAnchored = await contract.checkpointExists(checkpoint.checkpointId);
    if (alreadyAnchored) {
      const onChainRecord = await contract.getCheckpoint(checkpoint.checkpointId);
      checkpoint.transactionStatus = 'CONFIRMED';
      checkpoint.anchoredAt = new Date(Number(onChainRecord.createdAt) * 1000);
      checkpoint.confirmationCount = config.requiredConfirmations;
      checkpoint.lastErrorMessage = null;
      await checkpoint.save();
      return checkpoint;
    }

    // Submit transaction
    const tx = await contract.anchorCheckpoint(
      checkpoint.checkpointId,
      formatApplicationId(checkpoint.applicationId),
      checkpoint.serverCommitment,
      BigInt(checkpoint.startSequence),
      BigInt(checkpoint.endSequence),
      checkpoint.checkpointRoot
    );

    checkpoint.transactionHash = tx.hash;
    checkpoint.transactionNonce = tx.nonce;
    checkpoint.transactionStatus = 'SUBMITTED';
    await checkpoint.save();

    // Wait for transaction confirmation receipt
    const receipt = await tx.wait(config.requiredConfirmations);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted on-chain (status ${receipt ? receipt.status : 0})`);
    }

    // Verify CheckpointAnchored event from receipt logs
    const event = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === 'CheckpointAnchored');

    if (!event) {
      throw new Error('Transaction succeeded but CheckpointAnchored event was not emitted');
    }

    // Verify event commitments match
    const eventCheckpointId = event.args[0];
    const eventRoot = event.args[4];
    if (
      eventCheckpointId.toLowerCase() !== checkpoint.checkpointId.toLowerCase() ||
      eventRoot.toLowerCase() !== checkpoint.checkpointRoot.toLowerCase()
    ) {
      throw new Error('Receipt event parameters mismatch with checkpoint metadata');
    }

    checkpoint.transactionStatus = 'CONFIRMED';
    checkpoint.blockNumber = receipt.blockNumber;
    checkpoint.blockHash = receipt.blockHash;
    checkpoint.transactionIndex = receipt.index;
    checkpoint.confirmationCount = config.requiredConfirmations;
    checkpoint.anchoredAt = new Date();
    checkpoint.lastErrorMessage = null;
    await checkpoint.save();

    return checkpoint;
  } catch (error) {
    checkpoint.lastErrorMessage = error.message;

    // Check if error is permanent contract revert
    if (
      error.message.includes('ConflictingRangeCommitment') ||
      error.message.includes('UnauthorizedCaller') ||
      error.message.includes('InvalidSequenceRange')
    ) {
      checkpoint.transactionStatus = 'FAILED';
      checkpoint.lastErrorCode = 'PERMANENT_REVERT';
    } else {
      checkpoint.lastErrorCode = 'RPC_ERROR';
    }

    await checkpoint.save();
    throw error;
  }
}
