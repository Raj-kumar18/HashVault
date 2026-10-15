import crypto from 'crypto';
import { Server } from '../models/Server.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { LogEvent } from '../models/LogEvent.js';
import { Alert } from '../models/Alert.js';
import { SimulationRun } from '../models/SimulationRun.js';
import { appendBatchToChain, verifyServerChain } from '../services/integrity.service.js';
import {
  raiseOrUpdateAlert,
  evaluateFleetMonitoring,
  getHeartbeatThresholds,
} from '../services/monitoring.service.js';
import { checkBlockchainHealth, resetProviderCache } from '../blockchain/provider.js';
import { createOrGetCheckpoint } from '../blockchain/checkpointService.js';
import { verifyCheckpointOnChain } from '../blockchain/verificationService.js';

export const SIMULATION_SCENARIOS = [
  {
    id: 'modify_event_payload',
    title: 'Modify Historical Log Payload (Database Tampering)',
    category: 'Integrity Chain',
    severity: 'CRITICAL',
    description:
      'Simulates an unauthorized database attacker rewriting the text message of an existing sealed log record in MongoDB. Tests whether RFC 8785 canonical recomputation detects the HASH_MISMATCH.',
    expectedFinding: 'HASH_MISMATCH',
    targetSubsystem: 'Phase 4 SHA-256 Hash Chain',
  },
  {
    id: 'delete_event_record',
    title: 'Delete Historical Record (Sequence Gap / Record Dropping)',
    category: 'Integrity Chain',
    severity: 'HIGH',
    description:
      'Simulates an attacker deleting a log record to destroy audit evidence. Tests whether sequence monotonicity verification detects the missing sequence number as a SEQUENCE_GAP.',
    expectedFinding: 'SEQUENCE_GAP',
    targetSubsystem: 'Phase 4 Sequential Monotonicity',
  },
  {
    id: 'break_chain_link',
    title: 'Break Cryptographic Chain Link (Previous Hash Corruption)',
    category: 'Integrity Chain',
    severity: 'CRITICAL',
    description:
      'Simulates log injection or reordering by corrupting the previousHash pointer of a subsequent record. Tests whether sequential link verification flags BROKEN_CHAIN_LINK.',
    expectedFinding: 'BROKEN_CHAIN_LINK',
    targetSubsystem: 'Phase 4 Hash Linkage',
  },
  {
    id: 'alter_event_hash',
    title: 'Inject Fabricated Event Hash (Hash Spoofing)',
    category: 'Integrity Chain',
    severity: 'CRITICAL',
    description:
      'Simulates an attacker manually setting a fraudulent SHA-256 hash digest on a stored record. Tests whether independent recalculation exposes the forgery.',
    expectedFinding: 'HASH_MISMATCH',
    targetSubsystem: 'Phase 4 Hash Validation',
  },
  {
    id: 'simulate_stale_collector',
    title: 'Simulate Collector Telemetry Latency / Stale Daemon',
    category: 'Monitoring & Availability',
    severity: 'MEDIUM',
    description:
      'Simulates a network drop or hung collector process by setting lastHeartbeatAt beyond the configured stale threshold (90s). Tests whether the monitoring engine flags COLLECTOR_STALE.',
    expectedFinding: 'COLLECTOR_STALE',
    targetSubsystem: 'Phase 6 Monitoring Daemon',
  },
  {
    id: 'simulate_rpc_outage',
    title: 'Simulate Blockchain RPC Outage (Operational Warning)',
    category: 'Blockchain Infrastructure',
    severity: 'MEDIUM',
    description:
      'Simulates a temporary loss of connectivity to the Ethereum JSON-RPC endpoint. Confirms that LogSentinel reports BLOCKCHAIN_UNAVAILABLE as an operational warning rather than false tampering.',
    expectedFinding: 'BLOCKCHAIN_UNAVAILABLE',
    targetSubsystem: 'Phase 5 Blockchain Connectivity',
  },
  {
    id: 'checkpoint_mismatch_simulation',
    title: 'Tamper Anchored History (On-Chain Audit Mismatch)',
    category: 'Blockchain Anchoring',
    severity: 'CRITICAL',
    description:
      'Modifies an event that was previously anchored in a blockchain checkpoint. Tests whether the independent on-chain audit detects that the reconstructed MongoDB root diverges from the immutable contract root.',
    expectedFinding: 'CHECKPOINT_MISMATCH',
    targetSubsystem: 'Phase 5 On-Chain Verification',
  },
];

/**
 * Validates whether attack simulations are permitted in current environment.
 */
export const isSimulationPermitted = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOW_ATTACK_SIMULATION === 'true';
  }
  return true;
};

/**
 * Creates an isolated disposable test server fixture with initial hash-chain events.
 */
async function createIsolatedTestServerFixture(prefix = 'SIM-FIXTURE') {
  const uniqueTag = crypto.randomBytes(4).toString('hex');
  const server = await Server.create({
    serverName: `${prefix}-${uniqueTag}`,
    hostname: `fixture-${uniqueTag}.test.internal`,
    os: 'Linux',
    environment: 'Development',
    enrollmentStatus: 'ENROLLED',
    connectionStatus: 'ONLINE',
    lastHeartbeatAt: new Date(),
    serverId: `srv_sim_${uniqueTag}`,
    ownerId: '000000000000000000000000', // Fixture pseudo-owner
  });

  // Seed 3 sample sequential events
  const sampleEvents = [
    {
      eventId: `evt_sim_${uniqueTag}_1`,
      source: '/var/log/auth.log',
      message: 'systemd[1]: Started User Manager for UID 1000',
      observedAt: new Date(Date.now() - 3000),
    },
    {
      eventId: `evt_sim_${uniqueTag}_2`,
      source: '/var/log/auth.log',
      message: 'sshd[4102]: Accepted publickey for secops from 192.168.1.50',
      observedAt: new Date(Date.now() - 2000),
    },
    {
      eventId: `evt_sim_${uniqueTag}_3`,
      source: '/var/log/syslog',
      message: 'kernel: audit: type=1400 apparmor="STATUS" operation="profile_load"',
      observedAt: new Date(Date.now() - 1000),
    },
  ];

  await appendBatchToChain(server, sampleEvents);
  return { server, uniqueTag };
}

/**
 * Cleans up disposable test fixtures to prevent database bloat.
 */
async function cleanupTestServerFixture(server) {
  try {
    if (server && server.serverId) {
      await IntegrityRecord.deleteMany({ serverId: server.serverId });
      await LogEvent.deleteMany({ serverId: server.serverId });
      await Alert.deleteMany({ serverId: server.serverId });
      await Server.deleteOne({ _id: server._id });
    }
  } catch (err) {
    console.warn(`[Simulator] Fixture cleanup warning: ${err.message}`);
  }
}

/**
 * Executes a controlled, isolated attack scenario.
 */
export const runControlledAttackScenario = async (scenarioId, user) => {
  if (!isSimulationPermitted()) {
    throw new Error(
      'Controlled attack simulator is strictly disabled in production environments. Set ALLOW_ATTACK_SIMULATION=true to override for authorized drills.'
    );
  }

  const scenario = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown simulation scenario: "${scenarioId}".`);
  }

  const startTime = Date.now();
  let detected = false;
  let observedResult = 'Simulation execution initialized.';
  let findings = [];
  let alertRecord = null;
  let intendedModification = '';
  let verificationPerformed = '';
  let failureDetails = null;
  let tamperedLog = null;

  try {
    switch (scenarioId) {
      case 'modify_event_payload': {
        const { server } = await createIsolatedTestServerFixture('TAMPER-PAYLOAD');
        try {
          intendedModification =
            'Mutated message string of sequence #2 from original sshd log to attacker-injected text.';
          verificationPerformed =
            'Phase 4 verifyServerChain() recalculating RFC 8785 canonical JSON and SHA-256 hash.';

          // Attacker injects tampering into MongoDB record #2
          const record = await IntegrityRecord.findOne({
            serverId: server.serverId,
            sequenceNumber: 2,
          });
          const originalMessage = record.message;
          const originalHash = record.eventHash;
          const originalPrevHash = record.previousHash;
          const originalPayload = record.canonicalPayload;

          record.message = 'MALICIOUS_INJECTED_ATTACKER_PAYLOAD_STRING';
          record.canonicalPayload = record.canonicalPayload.replace(
            /"message":"[^"]*"/,
            '"message":"MALICIOUS_INJECTED_ATTACKER_PAYLOAD_STRING"'
          );
          await record.save();

          tamperedLog = {
            sequenceNumber: 2,
            source: record.source || '/var/log/auth.log',
            tamperType: 'PAYLOAD_MUTATION',
            diagnosticCode: 'HASH_MISMATCH',
            target: `Sequence #2 on ${server.serverName}`,
            original: {
              sequenceNumber: 2,
              source: record.source || '/var/log/auth.log',
              message: originalMessage,
              eventHash: originalHash,
              previousHash: originalPrevHash,
              canonicalPayload: originalPayload,
            },
            tampered: {
              sequenceNumber: 2,
              source: record.source || '/var/log/auth.log',
              message: record.message,
              eventHash: originalHash,
              previousHash: originalPrevHash,
              canonicalPayload: record.canonicalPayload,
            },
            explanation:
              'Attacker directly modified the message payload in MongoDB. The Phase 4 engine recomputed the SHA-256 hash using RFC 8785 canonical serialization and detected that the stored hash diverged from the recomputed hash (HASH_MISMATCH).',
          };

          // Execute Phase 4 verification
          const verification = await verifyServerChain(server.serverId);
          findings = verification.findings || [];

          if (verification.status === 'TAMPERED') {
            detected = true;
            observedResult = `Tampering detected successfully: Flagged TAMPERED with ${findings.length} finding(s).`;
            const alertRes = await raiseOrUpdateAlert({
              alertType: 'HASH_CHAIN_MISMATCH',
              severity: 'CRITICAL',
              title: `[Simulated Drill] Hash Chain Tampering on ${server.serverName}`,
              description: `Controlled attack drill: Alteration of sequence #2 was successfully trapped by Phase 4 canonical validation.`,
              serverId: server.serverId,
              serverName: server.serverName,
              relatedSequence: 2,
              evidenceMetadata: { findings, simulationId: scenarioId, tamperedLog },
              dedupKey: `${server.serverId}:SIM_TAMPER_2`,
            });
            alertRecord = alertRes.alert;
          } else {
            observedResult = `Unexpected: Verification reported ${verification.status}.`;
          }
        } finally {
          await cleanupTestServerFixture(server);
        }
        break;
      }

      case 'delete_event_record': {
        const { server } = await createIsolatedTestServerFixture('DELETE-RECORD');
        try {
          intendedModification =
            'Deleted sequence record #2 from MongoDB, creating a non-contiguous gap (#1, #3).';
          verificationPerformed =
            'Phase 4 verifyServerChain() asserting sequence monotonicity and contiguous sequence numbers.';

          const record = await IntegrityRecord.findOne({
            serverId: server.serverId,
            sequenceNumber: 2,
          });

          tamperedLog = {
            sequenceNumber: 2,
            source: record?.source || '/var/log/auth.log',
            tamperType: 'RECORD_DELETION',
            diagnosticCode: 'SEQUENCE_GAP',
            target: `Sequence #2 on ${server.serverName}`,
            original: {
              sequenceNumber: 2,
              source: record?.source || '/var/log/auth.log',
              message: record?.message || 'sshd[4102]: Accepted publickey for secops from 192.168.1.50',
              eventHash: record?.eventHash,
              previousHash: record?.previousHash,
            },
            tampered: {
              status: 'DELETED_FROM_DATABASE',
              remainingSequences: [1, 3],
            },
            explanation:
              'Attacker purged sequence record #2 to destroy audit trail evidence. The Phase 4 verifier asserted strict sequence monotonicity and immediately caught the missing sequence number as a SEQUENCE_GAP.',
          };

          // Delete record #2
          await IntegrityRecord.deleteOne({ serverId: server.serverId, sequenceNumber: 2 });

          const verification = await verifyServerChain(server.serverId);
          findings = verification.findings || [];

          if (verification.status === 'TAMPERED' || verification.status === 'INCOMPLETE') {
            const hasGapFinding = findings.some((f) => f.type === 'SEQUENCE_GAP' || f.type === 'BROKEN_CHAIN_LINK');
            if (hasGapFinding) {
              detected = true;
              observedResult = `Record deletion trapped successfully: Identified missing sequence #2 (${findings[0]?.type}).`;
              const alertRes = await raiseOrUpdateAlert({
                alertType: 'SEQUENCE_GAP',
                severity: 'HIGH',
                title: `[Simulated Drill] Sequence Gap on ${server.serverName}`,
                description: `Controlled attack drill: Deletion of sequence #2 caught by sequence integrity validator.`,
                serverId: server.serverId,
                serverName: server.serverName,
                relatedSequence: 2,
                evidenceMetadata: { findings, tamperedLog },
                dedupKey: `${server.serverId}:SIM_GAP_2`,
              });
              alertRecord = alertRes.alert;
            }
          }
        } finally {
          await cleanupTestServerFixture(server);
        }
        break;
      }

      case 'break_chain_link': {
        const { server } = await createIsolatedTestServerFixture('BREAK-LINK');
        try {
          intendedModification =
            'Altered previousHash pointer of record #3 to an arbitrary SHA-256 hash.';
          verificationPerformed =
            'Phase 4 verifyServerChain() verifying H_curr[i-1] === H_prev[i].';

          const record = await IntegrityRecord.findOne({
            serverId: server.serverId,
            sequenceNumber: 3,
          });
          const originalPrevHash = record.previousHash;
          record.previousHash = 'e'.repeat(64);
          await record.save();

          tamperedLog = {
            sequenceNumber: 3,
            source: record.source || '/var/log/syslog',
            tamperType: 'CHAIN_LINK_CORRUPTION',
            diagnosticCode: 'BROKEN_CHAIN_LINK',
            target: `Sequence #3 on ${server.serverName}`,
            original: {
              sequenceNumber: 3,
              source: record.source || '/var/log/syslog',
              message: record.message,
              eventHash: record.eventHash,
              previousHash: originalPrevHash,
            },
            tampered: {
              sequenceNumber: 3,
              source: record.source || '/var/log/syslog',
              message: record.message,
              eventHash: record.eventHash,
              previousHash: 'e'.repeat(64),
            },
            explanation:
              'Attacker corrupted the previousHash reference on record #3 (e.g. attempting to splice foreign logs into the sequence). Verification failed because previousHash did not match sequence #2 eventHash.',
          };

          const verification = await verifyServerChain(server.serverId);
          findings = verification.findings || [];

          const hasBrokenLink = findings.some((f) => f.type === 'BROKEN_CHAIN_LINK');
          if (hasBrokenLink) {
            detected = true;
            observedResult = 'Broken previousHash link detected immediately (BROKEN_CHAIN_LINK).';
            const alertRes = await raiseOrUpdateAlert({
              alertType: 'HASH_CHAIN_MISMATCH',
              severity: 'CRITICAL',
              title: `[Simulated Drill] Broken Hash Link on ${server.serverName}`,
              description: `Controlled attack drill: Link divergence at sequence #3 exposed.`,
              serverId: server.serverId,
              serverName: server.serverName,
              relatedSequence: 3,
              evidenceMetadata: { findings, tamperedLog },
              dedupKey: `${server.serverId}:SIM_LINK_3`,
            });
            alertRecord = alertRes.alert;
          }
        } finally {
          await cleanupTestServerFixture(server);
        }
        break;
      }

      case 'alter_event_hash': {
        const { server } = await createIsolatedTestServerFixture('FORGE-HASH');
        try {
          intendedModification =
            'Injected forged eventHash (00000...) into sequence record #1.';
          verificationPerformed =
            'Phase 4 verifyServerChain() validating SHA-256 equality against recalculated payload hash.';

          const record = await IntegrityRecord.findOne({
            serverId: server.serverId,
            sequenceNumber: 1,
          });
          const originalHash = record.eventHash;
          record.eventHash = '0'.repeat(64);
          await record.save();

          tamperedLog = {
            sequenceNumber: 1,
            source: record.source || '/var/log/auth.log',
            tamperType: 'HASH_SPOOFING',
            diagnosticCode: 'HASH_MISMATCH',
            target: `Sequence #1 on ${server.serverName}`,
            original: {
              sequenceNumber: 1,
              source: record.source || '/var/log/auth.log',
              message: record.message,
              eventHash: originalHash,
              previousHash: record.previousHash,
            },
            tampered: {
              sequenceNumber: 1,
              source: record.source || '/var/log/auth.log',
              message: record.message,
              eventHash: '0'.repeat(64),
              previousHash: record.previousHash,
            },
            explanation:
              'Attacker injected a fabricated hash digest (0000...0000) directly into record #1. Recalculating the canonical SHA-256 hash immediately exposed the signature forgery.',
          };

          const verification = await verifyServerChain(server.serverId);
          findings = verification.findings || [];

          const hasHashMismatch = findings.some((f) => f.type === 'HASH_MISMATCH');
          if (hasHashMismatch) {
            detected = true;
            observedResult = 'Forged eventHash detected (HASH_MISMATCH).';
            const alertRes = await raiseOrUpdateAlert({
              alertType: 'HASH_CHAIN_MISMATCH',
              severity: 'CRITICAL',
              title: `[Simulated Drill] Spoofed Hash Detected on ${server.serverName}`,
              description: `Controlled attack drill: Forged SHA-256 signature caught.`,
              serverId: server.serverId,
              serverName: server.serverName,
              relatedSequence: 1,
              evidenceMetadata: { findings, tamperedLog },
              dedupKey: `${server.serverId}:SIM_FORGE_1`,
            });
            alertRecord = alertRes.alert;
          }
        } finally {
          await cleanupTestServerFixture(server);
        }
        break;
      }

      case 'simulate_stale_collector': {
        const { server } = await createIsolatedTestServerFixture('STALE-DAEMON');
        try {
          const { staleThresholdMs, offlineThresholdMs } = getHeartbeatThresholds();
          const targetAge = Math.round((staleThresholdMs + offlineThresholdMs) / 2);

          intendedModification = `Rewrote lastHeartbeatAt timestamp to ${Math.round(targetAge / 1000)} seconds in the past (between stale and offline threshold).`;
          verificationPerformed =
            'Phase 6 evaluateFleetMonitoring() verifying collector freshness window.';

          server.lastHeartbeatAt = new Date(Date.now() - targetAge);
          await server.save();

          tamperedLog = {
            target: `Daemon Heartbeat on ${server.serverName}`,
            tamperType: 'HEARTBEAT_DEGRADATION',
            diagnosticCode: 'COLLECTOR_STALE',
            original: {
              lastHeartbeat: 'Recent (0s ago, ONLINE)',
              collectorHealth: 'ONLINE',
            },
            tampered: {
              lastHeartbeat: `${Math.round(targetAge / 1000)}s ago (exceeded stale window)`,
              collectorHealth: 'STALE',
            },
            explanation:
              'Simulated collector process hang or network blackout. Monitoring scheduler verified heartbeat freshness and triggered a COLLECTOR_STALE operational health alert.',
          };

          const evalResult = await evaluateFleetMonitoring();
          findings = evalResult.findings || [];

          const staleDetected = findings.some(
            (f) =>
              f.serverId === server.serverId &&
              (f.type === 'COLLECTOR_STALE' || f.type === 'COLLECTOR_OFFLINE')
          );

          if (staleDetected) {
            detected = true;
            observedResult =
              'Stale collector daemon detected by monitoring cycle within freshness threshold.';
          } else {
            observedResult = 'Monitoring cycle completed without flagging stale condition.';
          }
        } finally {
          await cleanupTestServerFixture(server);
        }
        break;
      }

      case 'simulate_rpc_outage': {
        intendedModification =
          'Configured temporary unreachable JSON-RPC port to simulate RPC outage.';
        verificationPerformed =
          'Phase 6 evaluateFleetMonitoring() testing checkBlockchainHealth().';

        const originalRpc = process.env.BLOCKCHAIN_RPC_URL;
        try {
          process.env.BLOCKCHAIN_RPC_URL = 'http://127.0.0.1:59998'; // Unbound dead port
          resetProviderCache();

          tamperedLog = {
            target: 'Ethereum JSON-RPC Node',
            tamperType: 'RPC_UNAVAILABILITY',
            diagnosticCode: 'BLOCKCHAIN_UNAVAILABLE',
            original: {
              rpcUrl: originalRpc || 'http://127.0.0.1:8545',
              status: 'READY (Connected)',
            },
            tampered: {
              rpcUrl: 'http://127.0.0.1:59998 (Dead Unbound Port)',
              status: 'UNAVAILABLE (Connection refused)',
            },
            explanation:
              'Simulated unreachable JSON-RPC gateway. Verified that LogSentinel handles network/node drops honestly as operational warnings rather than falsely claiming log tampering.',
          };

          const health = await checkBlockchainHealth();
          if (!health.connected || health.status === 'UNAVAILABLE') {
            detected = true;
            observedResult =
              'RPC outage handled gracefully: Classified as BLOCKCHAIN_UNAVAILABLE (operational warning, not tampering).';
            findings = [health];
          } else {
            detected = false;
            observedResult = `RPC status reported: ${health.status}`;
          }
        } finally {
          process.env.BLOCKCHAIN_RPC_URL = originalRpc;
          resetProviderCache();
        }
        break;
      }

      case 'checkpoint_mismatch_simulation': {
        const { server } = await createIsolatedTestServerFixture('CP-TAMPER');
        try {
          intendedModification =
            'Created checkpoint #1 to #3, marked confirmed, then tampered with MongoDB record #2.';
          verificationPerformed =
            'Phase 5 verifyCheckpointOnChain() asserting onChainRoot === recomputedRoot.';

          const { checkpoint } = await createOrGetCheckpoint({
            serverId: server.serverId,
            startSequence: 1,
            endSequence: 3,
            userId: user?._id || '000000000000000000000000',
          });

          // Simulate database tampering under the anchored range
          const record = await IntegrityRecord.findOne({
            serverId: server.serverId,
            sequenceNumber: 2,
          });
          const originalMessage = record.message;
          const originalHash = record.eventHash;

          record.message = 'TAMPERED_AFTER_BLOCKCHAIN_ANCHOR';
          record.eventHash = 'a'.repeat(64);
          await record.save();

          tamperedLog = {
            sequenceNumber: 2,
            checkpointId: checkpoint.checkpointId,
            tamperType: 'POST_CHECKPOINT_TAMPERING',
            diagnosticCode: 'CHECKPOINT_MISMATCH',
            target: `Sequence #2 on ${server.serverName} (Anchored under Checkpoint ${checkpoint.checkpointId.slice(0, 16)}...)`,
            original: {
              sequenceNumber: 2,
              message: originalMessage,
              eventHash: originalHash,
              anchoredRange: '#1 to #3',
            },
            tampered: {
              sequenceNumber: 2,
              message: 'TAMPERED_AFTER_BLOCKCHAIN_ANCHOR',
              eventHash: 'a'.repeat(64),
            },
            explanation:
              'Attacker altered database records within an already anchored blockchain range. Independent on-chain audit recalculated the local Merkle root and proved divergence from the immutable smart contract root.',
          };

          // Rerun Phase 5 verification
          const verifyRes = await verifyCheckpointOnChain({
            serverId: server.serverId,
            checkpointId: checkpoint.checkpointId,
          });

          findings = verifyRes.findings || [];
          if (verifyRes.status === 'MISMATCH' || verifyRes.status === 'UNANCHORED') {
            detected = true;
            observedResult = `Tampering under anchored checkpoint detected: Verdict ${verifyRes.status}. Recomputed root diverged from on-chain commitment.`;
            const alertRes = await raiseOrUpdateAlert({
              alertType: 'CHECKPOINT_MISMATCH',
              severity: 'CRITICAL',
              title: `[Simulated Drill] On-Chain Commitment Mismatch on ${server.serverName}`,
              description: `Controlled attack drill: Rewriting anchored history failed on-chain audit.`,
              serverId: server.serverId,
              serverName: server.serverName,
              relatedCheckpointId: checkpoint.checkpointId,
              evidenceMetadata: { findings, tamperedLog },
              dedupKey: `${server.serverId}:SIM_CP_MISMATCH`,
            });
            alertRecord = alertRes.alert;
          }
        } finally {
          await cleanupTestServerFixture(server);
        }
        break;
      }
    }
  } catch (error) {
    failureDetails = error.message;
    observedResult = `Simulation encountered execution error: ${error.message}`;
  }

  const durationMs = Date.now() - startTime;

  // Persist audit record in SimulationRun
  const runDoc = await SimulationRun.create({
    scenarioName: scenario.id,
    title: scenario.title,
    testEnvironment: process.env.NODE_ENV || 'development',
    intendedModification,
    verificationPerformed,
    observedResult,
    detected,
    status: failureDetails ? 'FAILED' : 'SUCCESS',
    alertId: alertRecord?.alertId || null,
    findings,
    tamperedLog,
    failureDetails,
    executedBy: user?._id || null,
    executedByName: user?.name || user?.email || 'Admin',
    startedAt: new Date(startTime),
    completedAt: new Date(),
    durationMs,
  });

  return {
    run: runDoc,
    scenario,
    detected,
    observedResult,
    findings,
    tamperedLog,
    alert: alertRecord,
    durationMs,
  };
};
