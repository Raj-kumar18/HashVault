import { Checkpoint } from '../models/Checkpoint.js';
import { executeAnchoringTransaction } from './checkpointService.js';
import { getContract, getProvider } from './provider.js';
import { getBlockchainConfig } from './config.js';

let workerIntervalId = null;
let isReconciling = false;

/**
 * Reconciles unresolved checkpoint transactions on startup or periodic loop.
 */
export async function reconcileUnresolvedCheckpoints() {
  if (isReconciling) return;
  isReconciling = true;

  const config = getBlockchainConfig();
  if (!config.enabled) {
    isReconciling = false;
    return;
  }

  try {
    const unresolved = await Checkpoint.find({
      transactionStatus: { $in: ['PENDING', 'SUBMITTED'] },
      retryCount: { $lt: 10 }, // Limit retries to prevent unbounded spinning
    }).sort({ createdAt: 1 });

    if (unresolved.length === 0) {
      isReconciling = false;
      return;
    }

    console.log(`[CheckpointWorker] Reconciling ${unresolved.length} unresolved checkpoint(s)...`);

    const contract = getContract(getProvider());
    const provider = getProvider();

    for (const cp of unresolved) {
      try {
        // 1. Check if already confirmed on-chain
        const exists = await contract.checkpointExists(cp.checkpointId);
        if (exists) {
          cp.transactionStatus = 'CONFIRMED';
          cp.anchoredAt = cp.anchoredAt || new Date();
          cp.confirmationCount = config.requiredConfirmations;
          cp.lastErrorMessage = null;
          await cp.save();
          console.log(`[CheckpointWorker] Checkpoint ${cp.checkpointId} confirmed on-chain.`);
          continue;
        }

        // 2. If transaction was already broadcast, check receipt
        if (cp.transactionHash) {
          const receipt = await provider.getTransactionReceipt(cp.transactionHash);
          if (receipt) {
            if (receipt.status === 1) {
              cp.transactionStatus = 'CONFIRMED';
              cp.blockNumber = receipt.blockNumber;
              cp.blockHash = receipt.blockHash;
              cp.confirmationCount = config.requiredConfirmations;
              cp.anchoredAt = new Date();
              cp.lastErrorMessage = null;
              await cp.save();
              console.log(`[CheckpointWorker] Found confirmed receipt for tx ${cp.transactionHash}.`);
              continue;
            } else {
              cp.transactionStatus = 'FAILED';
              cp.lastErrorCode = 'RECEIPT_REVERTED';
              await cp.save();
              continue;
            }
          }
        }

        // 3. If still pending, retry submission
        await executeAnchoringTransaction(cp.checkpointId);
      } catch (err) {
        console.warn(
          `[CheckpointWorker] Reconcile attempt failed for ${cp.checkpointId}: ${err.message}`
        );
      }
    }
  } catch (error) {
    console.error(`[CheckpointWorker] Global reconcile error: ${error.message}`);
  } finally {
    isReconciling = false;
  }
}

export function startCheckpointWorker(intervalMs = 30000) {
  if (workerIntervalId) return;

  // Run initial reconciliation after short startup delay
  setTimeout(() => {
    reconcileUnresolvedCheckpoints().catch(() => {});
  }, 2000);

  workerIntervalId = setInterval(() => {
    reconcileUnresolvedCheckpoints().catch(() => {});
  }, intervalMs);
}

export function stopCheckpointWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }
}
