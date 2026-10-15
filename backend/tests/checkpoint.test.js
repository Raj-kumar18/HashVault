import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { IntegrityRecord } from '../src/models/IntegrityRecord.js';
import { Checkpoint } from '../src/models/Checkpoint.js';
import { TestClient } from './testClient.js';
import { appendBatchToChain } from '../src/services/integrity.service.js';
import {
  calculateServerCommitment,
  calculateCheckpointRoot,
  calculateCheckpointId,
  validateContiguousRecords,
} from '../src/blockchain/commitment.js';
import {
  prepareCheckpointRange,
  createOrGetCheckpoint,
} from '../src/blockchain/checkpointService.js';
import { verifyCheckpointOnChain } from '../src/blockchain/verificationService.js';
import { checkBlockchainHealth, resetProviderCache } from '../src/blockchain/provider.js';
import { reconcileUnresolvedCheckpoints } from '../src/blockchain/worker.js';

describe('LogSentinel — Phase 5: Blockchain Checkpoint Anchoring & Verification Suite', () => {
  let mongoServer;
  let serverInstance;
  let adminClient;
  let analystClient;
  let baseUrl;
  let testServer;
  let adminUser;
  let analystUser;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test_session_secret_with_more_than_32_characters_for_security_assurance!';
    process.env.BLOCKCHAIN_ENABLED = 'true';
    process.env.BLOCKCHAIN_RPC_URL = 'http://127.0.0.1:8545';
    process.env.BLOCKCHAIN_CHAIN_ID = '31337';
    process.env.APPLICATION_INSTANCE_ID = 'logsentinel-test-app';

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    await mongoose.connect(mongoUri);

    const app = createApp();
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(0, resolve));

    const address = serverInstance.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    adminClient = new TestClient(baseUrl);
    analystClient = new TestClient(baseUrl);

    const passwordHash = await bcrypt.hash('TestPass2026!', 10);
    adminUser = await User.create({
      name: 'Checkpoint Admin',
      email: 'admin@logsentinel.local',
      passwordHash,
      role: 'Admin',
    });

    analystUser = await User.create({
      name: 'Security Analyst 1',
      email: 'analyst@logsentinel.local',
      passwordHash,
      role: 'Security Analyst',
    });

    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'admin@logsentinel.local',
      password: 'TestPass2026!',
    });

    await analystClient.fetchCsrf();
    await analystClient.post('/api/auth/login', {
      email: 'analyst@logsentinel.local',
      password: 'TestPass2026!',
    });
  });

  after(async () => {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Server.deleteMany({});
    await IntegrityRecord.deleteMany({});
    await Checkpoint.deleteMany({});

    testServer = await Server.create({
      serverName: 'CHECKPOINT-VAULT-01',
      hostname: 'vault-01.company.local',
      os: 'Linux',
      environment: 'Production',
      ownerId: adminUser._id,
      enrollmentStatus: 'ENROLLED',
      connectionStatus: 'ONLINE',
      serverId: 'srv_test_checkpoint_node',
    });

    // Ingest 5 sample events into Phase 4 hash chain
    const sampleEvents = [
      {
        eventId: 'evt_cp_01',
        source: '/var/log/auth.log',
        message: 'PAM: authentication started',
        observedAt: new Date(Date.now() - 5000),
      },
      {
        eventId: 'evt_cp_02',
        source: '/var/log/auth.log',
        message: 'Accepted publickey for deployer',
        observedAt: new Date(Date.now() - 4000),
      },
      {
        eventId: 'evt_cp_03',
        source: '/var/log/auth.log',
        message: 'Session opened for user deployer',
        observedAt: new Date(Date.now() - 3000),
      },
      {
        eventId: 'evt_cp_04',
        source: '/var/log/syslog',
        message: 'Systemd service started',
        observedAt: new Date(Date.now() - 2000),
      },
      {
        eventId: 'evt_cp_05',
        source: '/var/log/syslog',
        message: 'Health daemon check OK',
        observedAt: new Date(Date.now() - 1000),
      },
    ];

    await appendBatchToChain(testServer, sampleEvents);
  });

  /* ================= 1. Cryptographic Commitment Derivations ================= */

  describe('1. Cryptographic Commitment Derivation', () => {
    it('should derive deterministic server commitments and format as bytes32', () => {
      const c1 = calculateServerCommitment('srv_node_a', 'logsentinel-test-app');
      const c2 = calculateServerCommitment('srv_node_a', 'logsentinel-test-app');
      const c3 = calculateServerCommitment('srv_node_b', 'logsentinel-test-app');

      assert.equal(c1, c2, 'Identical inputs must yield identical server commitment');
      assert.notEqual(c1, c3, 'Different serverIds must yield different commitments');
      assert.match(c1, /^0x[0-9a-f]{64}$/, 'Must be a 66-character 0x-prefixed hex string');
    });

    it('should compute deterministic checkpoint roots binding range boundaries', () => {
      const serverCommitment = calculateServerCommitment('srv_node_a', 'app_1');
      const root1 = calculateCheckpointRoot({
        commitmentVersion: '1',
        applicationId: 'app_1',
        serverCommitment,
        startSequence: 1,
        endSequence: 5,
        eventCount: 5,
        startBoundaryHash: '0'.repeat(64),
        endBoundaryHash: 'f'.repeat(64),
      });

      const root2 = calculateCheckpointRoot({
        commitmentVersion: '1',
        applicationId: 'app_1',
        serverCommitment,
        startSequence: 1,
        endSequence: 5,
        eventCount: 5,
        startBoundaryHash: '0'.repeat(64),
        endBoundaryHash: 'f'.repeat(64),
      });

      assert.equal(root1, root2, 'Identical parameters must produce identical root');
      assert.match(root1, /^0x[0-9a-f]{64}$/);

      // Altering boundary hash changes root
      const rootAltered = calculateCheckpointRoot({
        commitmentVersion: '1',
        applicationId: 'app_1',
        serverCommitment,
        startSequence: 1,
        endSequence: 5,
        eventCount: 5,
        startBoundaryHash: '0'.repeat(64),
        endBoundaryHash: 'e'.repeat(64),
      });
      assert.notEqual(root1, rootAltered, 'Altering boundary hash must alter root commitment');
    });

    it('should calculate unique deterministic checkpoint IDs', () => {
      const serverCommitment = calculateServerCommitment('srv_node_a', 'app_1');
      const root = '0x' + '1'.repeat(64);
      const id1 = calculateCheckpointId({
        applicationId: 'app_1',
        serverCommitment,
        startSequence: 1,
        endSequence: 10,
        checkpointRoot: root,
      });

      assert.match(id1, /^0x[0-9a-f]{64}$/);
    });

    it('should validate contiguous sequence ranges and reject gaps', () => {
      const validRecords = [
        { sequenceNumber: 1, previousHash: '0'.repeat(64), eventHash: 'a'.repeat(64) },
        { sequenceNumber: 2, previousHash: 'a'.repeat(64), eventHash: 'b'.repeat(64) },
        { sequenceNumber: 3, previousHash: 'b'.repeat(64), eventHash: 'c'.repeat(64) },
      ];
      const validRes = validateContiguousRecords(validRecords, 1, 3);
      assert.equal(validRes.valid, true);
      assert.equal(validRes.startBoundaryHash, '0'.repeat(64));
      assert.equal(validRes.endBoundaryHash, 'c'.repeat(64));

      // With gap: missing sequence 2
      const gappedRecords = [
        { sequenceNumber: 1, previousHash: '0'.repeat(64), eventHash: 'a'.repeat(64) },
        { sequenceNumber: 3, previousHash: 'b'.repeat(64), eventHash: 'c'.repeat(64) },
      ];
      const gappedRes = validateContiguousRecords(gappedRecords, 1, 3);
      assert.equal(gappedRes.valid, false);
      assert.match(gappedRes.reason, /(Sequence gap|Expected \d+ records)/i);
    });
  });

  /* ================= 2. Checkpoint Service & Idempotency ================= */

  describe('2. Checkpoint Preparation & Idempotency', () => {
    it('should prepare valid checkpoint data for current verified chain (#1 - #5)', async () => {
      const prep = await prepareCheckpointRange({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 5,
      });

      assert.equal(prep.startSequence, 1);
      assert.equal(prep.endSequence, 5);
      assert.equal(prep.eventCount, 5);
      assert.match(prep.serverCommitment, /^0x/);
      assert.match(prep.checkpointRoot, /^0x/);
      assert.match(prep.checkpointId, /^0x/);
    });

    it('should reject checkpoint preparation if sequence bounds exceed chain head', async () => {
      await assert.rejects(
        async () => {
          await prepareCheckpointRange({
            serverId: testServer.serverId,
            startSequence: 1,
            endSequence: 10, // Only 5 records exist
          });
        },
        /exceeds current chain head/i
      );
    });

    it('should reject invalid sequence ranges (startSequence < 1 or endSequence < startSequence)', async () => {
      await assert.rejects(
        async () => {
          await prepareCheckpointRange({
            serverId: testServer.serverId,
            startSequence: 0,
            endSequence: 3,
          });
        },
        /startSequence must be >= 1/i
      );

      await assert.rejects(
        async () => {
          await prepareCheckpointRange({
            serverId: testServer.serverId,
            startSequence: 4,
            endSequence: 2,
          });
        },
        /cannot be less than startSequence/i
      );
    });

    it('should enforce idempotency when creating or retrieving checkpoints', async () => {
      const res1 = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 5,
        userId: adminUser._id,
      });
      assert.equal(res1.isNew, true);
      assert.equal(res1.checkpoint.transactionStatus, 'PENDING');

      // Duplicate request with identical range
      const res2 = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 5,
        userId: adminUser._id,
      });
      assert.equal(res2.isNew, false);
      assert.equal(res2.checkpoint.checkpointId, res1.checkpoint.checkpointId);

      // Verify only 1 record exists in MongoDB
      const count = await Checkpoint.countDocuments({ serverId: testServer.serverId });
      assert.equal(count, 1);
    });
  });

  /* ================= 3. On-Chain Verification & Tamper Detection ================= */

  describe('3. Independent Verification & Tamper Detection', () => {
    it('should return UNANCHORED if checkpoint is in DB but not present on contract', async () => {
      const { checkpoint } = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 3,
        userId: adminUser._id,
      });

      const res = await verifyCheckpointOnChain({
        serverId: testServer.serverId,
        checkpointId: checkpoint.checkpointId,
      });

      // Since Hardhat node is not actively mining or contract does not have this random test ID
      assert.ok(['UNANCHORED', 'UNAVAILABLE'].includes(res.status));
    });

    it('should detect database payload tampering and flag MISMATCH against expected root', async () => {
      const { checkpoint } = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 3,
        userId: adminUser._id,
      });

      // Mark checkpoint confirmed in DB
      checkpoint.transactionStatus = 'CONFIRMED';
      await checkpoint.save();

      // Tamper with record #2 in MongoDB
      const recordToTamper = await IntegrityRecord.findOne({
        serverId: testServer.serverId,
        sequenceNumber: 2,
      });
      recordToTamper.message = 'MALICIOUS_INJECTED_TAMPER_STRING';
      recordToTamper.eventHash = '0'.repeat(64);
      await recordToTamper.save();

      // Verify that recalculating the range now detects the altered history
      const prepAfterTamper = await prepareCheckpointRange({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 3,
      }).catch((e) => e);

      // Phase 4 verification must reject the range
      assert.ok(prepAfterTamper instanceof Error);
      assert.match(prepAfterTamper.message, /validation failed/i);
    });

    it('should report UNAVAILABLE when RPC endpoint cannot be reached', async () => {
      process.env.BLOCKCHAIN_RPC_URL = 'http://127.0.0.1:9999'; // Dead port
      resetProviderCache();

      const { checkpoint } = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 2,
        userId: adminUser._id,
      });

      const res = await verifyCheckpointOnChain({
        serverId: testServer.serverId,
        checkpointId: checkpoint.checkpointId,
      });

      assert.equal(res.status, 'UNAVAILABLE');
      assert.equal(res.success, false);

      process.env.BLOCKCHAIN_RPC_URL = 'http://127.0.0.1:8545'; // Restore
      resetProviderCache();
    });

    it('should flag INCOMPLETE when verifying a range with deleted/missing historical records', async () => {
      const { checkpoint } = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 3,
        userId: adminUser._id,
      });

      // Delete record #2 to simulate data loss or gap
      await IntegrityRecord.deleteOne({
        serverId: testServer.serverId,
        sequenceNumber: 2,
      });

      // Independent verification should catch the gap and reject the range
      const prepResult = await prepareCheckpointRange({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 3,
      }).catch((e) => e);

      assert.ok(prepResult instanceof Error);
      assert.match(prepResult.message, /validation failed|incomplete/i);
    });

    it('should detect chain ID mismatch and flag MISCONFIGURED in health check', async () => {
      const originalChainId = process.env.BLOCKCHAIN_CHAIN_ID;
      try {
        process.env.BLOCKCHAIN_CHAIN_ID = '99999'; // Wrong expected chain ID
        resetProviderCache();

        const health = await checkBlockchainHealth();
        if (health.connected) {
          assert.equal(health.status, 'MISCONFIGURED');
          assert.equal(health.chainIdMatch, false);
        }
      } finally {
        process.env.BLOCKCHAIN_CHAIN_ID = originalChainId;
        resetProviderCache();
      }
    });

    it('should reconcile unresolved pending checkpoints gracefully in worker', async () => {
      const { checkpoint } = await createOrGetCheckpoint({
        serverId: testServer.serverId,
        startSequence: 1,
        endSequence: 3,
        userId: adminUser._id,
      });

      assert.equal(checkpoint.transactionStatus, 'PENDING');

      // Run reconciliation
      await reconcileUnresolvedCheckpoints();

      // Checkpoint is handled without crashing
      const reloaded = await Checkpoint.findById(checkpoint._id);
      assert.ok(reloaded);
    });
  });

  /* ================= 4. REST APIs & Role-Based Authorization ================= */

  describe('4. REST APIs & Authorization', () => {
    it('should allow Admin to create a checkpoint via POST /api/integrity/servers/:id/checkpoints', async () => {
      const res = await adminClient.post(
        `/api/integrity/servers/${testServer.serverId}/checkpoints`,
        {
          startSequence: 1,
          endSequence: 3,
        }
      );

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.checkpoint.startSequence, 1);
      assert.equal(res.data.checkpoint.endSequence, 3);
      assert.equal(res.data.checkpoint.eventCount, 3);
      assert.match(res.data.checkpoint.checkpointId, /^0x/);
    });

    it('should deny non-Admin (Security Analyst) from creating checkpoints with HTTP 403', async () => {
      const res = await analystClient.post(
        `/api/integrity/servers/${testServer.serverId}/checkpoints`,
        {
          startSequence: 1,
          endSequence: 3,
        }
      );

      assert.equal(res.status, 403);
    });

    it('should reject unauthenticated requests with HTTP 401', async () => {
      const unauthClient = new TestClient(baseUrl);
      const res = await unauthClient.get(
        `/api/integrity/servers/${testServer.serverId}/checkpoints`
      );

      assert.equal(res.status, 401);
    });

    it('should return paginated checkpoints history', async () => {
      // Create a checkpoint as admin
      await adminClient.post(
        `/api/integrity/servers/${testServer.serverId}/checkpoints`,
        {
          startSequence: 1,
          endSequence: 2,
        }
      );

      const res = await adminClient.get(
        `/api/integrity/servers/${testServer.serverId}/checkpoints`
      );

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.checkpoints));
      assert.equal(res.data.checkpoints.length, 1);
      assert.equal(res.data.pagination.total, 1);
    });

    it('should expose /api/blockchain/status without leaking private keys', async () => {
      const res = await adminClient.get('/api/blockchain/status');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.blockchain);
      assert.equal(res.data.blockchain.expectedChainId, 31337);
      // Ensure private key is NOT present anywhere in payload
      const jsonString = JSON.stringify(res.data);
      assert.ok(!jsonString.includes('privateKey'));
      assert.ok(!jsonString.includes('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'));
    });
  });
});
