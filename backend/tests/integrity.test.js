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
import { TestClient } from './testClient.js';
import {
  canonicalize,
  buildCanonicalEventPayload,
  calculateEventHash,
  GENESIS_PREVIOUS_HASH,
  GENESIS_SEQUENCE_NUMBER,
  HASH_VERSION,
} from '../src/crypto/canonicalizer.js';
import { verifyServerChain } from '../src/services/integrity.service.js';

describe('LogSentinel — Phase 4: Tamper-Evident SHA-256 Hash-Chain Engine & Verification Suite', () => {
  let mongoServer;
  let serverInstance;
  let adminClient;
  let analystClient;
  let baseUrl;
  let testServer;
  let collectorCredential;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test_session_secret_with_more_than_32_characters_for_security_assurance!';

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

    // Create Admin user
    const passwordHash = await bcrypt.hash('AdminSecret2026!', 10);
    const adminUser = await User.create({
      name: 'Integrity Admin',
      email: 'admin@logsentinel.local',
      passwordHash,
      role: 'Admin',
    });

    // Create Security Analyst user
    const analystUser = await User.create({
      name: 'SOC Analyst',
      email: 'analyst@logsentinel.local',
      passwordHash,
      role: 'Security Analyst',
    });

    // Authenticate Admin
    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'admin@logsentinel.local',
      password: 'AdminSecret2026!',
    });

    // Authenticate Analyst
    await analystClient.fetchCsrf();
    await analystClient.post('/api/auth/login', {
      email: 'analyst@logsentinel.local',
      password: 'AdminSecret2026!',
    });
  });

  after(async () => {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await IntegrityRecord.deleteMany({});
    await Server.deleteMany({});

    const uid = Math.random().toString(36).substring(2, 8);
    // Register a fresh test server
    const srvRes = await adminClient.post('/api/servers', {
      serverName: `INTEGRITY-VAULT-${uid}`,
      hostname: `vault-${uid}.corp.internal`,
      os: 'Linux',
      environment: 'Production',
    });
    testServer = srvRes.data.server;

    // Generate enrollment token & enroll to get collector credential
    const tokenRes = await adminClient.post(`/api/servers/${testServer.serverId}/enrollment-token`);
    const enrollmentToken = tokenRes.data.enrollmentToken;

    const enrollRes = await adminClient.post('/api/collector/enroll', {
      token: enrollmentToken,
      serverId: testServer.serverId,
    });
    collectorCredential = enrollRes.data.credential;
  });

  /* ================= 1. Cryptographic Canonicalization & Hashing ================= */

  describe('1. Cryptographic Canonicalization & Hashing', () => {
    it('should produce identical canonical JSON strings regardless of object key ordering', () => {
      const objA = { z: 1, a: 'apple', m: { y: 2, b: 'banana' } };
      const objB = { a: 'apple', m: { b: 'banana', y: 2 }, z: 1 };

      const canonA = canonicalize(objA);
      const canonB = canonicalize(objB);

      assert.equal(canonA, canonB);
      assert.equal(canonA, '{"a":"apple","m":{"b":"banana","y":2},"z":1}');
    });

    it('should change the event hash when any protected field is altered', () => {
      const basePayload = {
        eventId: 'evt_001',
        serverId: 'srv_test',
        batchId: 'batch_01',
        source: '/var/log/syslog',
        sourceOffset: 0,
        message: 'System initialization complete',
        observedAt: '2026-10-11T00:00:00.000Z',
        collectorMetadata: {},
      };

      const canonBase = canonicalize(basePayload);
      const baseHash = calculateEventHash({
        hashVersion: HASH_VERSION,
        serverId: 'srv_test',
        sequenceNumber: 1,
        previousHash: GENESIS_PREVIOUS_HASH,
        canonicalPayload: canonBase,
      });

      assert.equal(baseHash.length, 64);

      // Mutate message
      const tamperedMessage = { ...basePayload, message: 'Malicious modification' };
      const hashTamperedMessage = calculateEventHash({
        hashVersion: HASH_VERSION,
        serverId: 'srv_test',
        sequenceNumber: 1,
        previousHash: GENESIS_PREVIOUS_HASH,
        canonicalPayload: canonicalize(tamperedMessage),
      });
      assert.notEqual(baseHash, hashTamperedMessage);

      // Mutate previousHash
      const hashTamperedPrev = calculateEventHash({
        hashVersion: HASH_VERSION,
        serverId: 'srv_test',
        sequenceNumber: 1,
        previousHash: 'f'.repeat(64),
        canonicalPayload: canonBase,
      });
      assert.notEqual(baseHash, hashTamperedPrev);

      // Mutate sequenceNumber
      const hashTamperedSeq = calculateEventHash({
        hashVersion: HASH_VERSION,
        serverId: 'srv_test',
        sequenceNumber: 2,
        previousHash: GENESIS_PREVIOUS_HASH,
        canonicalPayload: canonBase,
      });
      assert.notEqual(baseHash, hashTamperedSeq);
    });

    it('should calculate valid genesis hash starting with 64 zeros and sequence #1', () => {
      const canon = canonicalize({ test: true });
      const genesisHash = calculateEventHash({
        hashVersion: HASH_VERSION,
        serverId: 'srv_genesis',
        sequenceNumber: GENESIS_SEQUENCE_NUMBER,
        previousHash: GENESIS_PREVIOUS_HASH,
        canonicalPayload: canon,
      });

      assert.ok(/^[0-9a-f]{64}$/.test(genesisHash));
    });
  });

  /* ================= 2. Sequential Ingestion & Concurrency Safety ================= */

  describe('2. Ingestion Integration & Sequence Integrity', () => {
    it('should sequentially chain accepted events and update server chain head', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      // Ingest batch 1 (2 events)
      const res1 = await collectorClient.post('/api/collector/logs', {
        batchId: 'batch_alpha',
        events: [
          { eventId: 'evt_alpha_1', source: '/var/log/auth.log', message: 'User alice logged in' },
          { eventId: 'evt_alpha_2', source: '/var/log/auth.log', message: 'alice elevated privileges' },
        ],
      });

      assert.equal(res1.status, 200);
      assert.equal(res1.data.acceptedCount, 2);
      assert.equal(res1.data.chainHeadSequence, 2);
      assert.ok(res1.data.chainHeadHash);

      // Verify records in DB
      const rec1 = await IntegrityRecord.findOne({ serverId: testServer.serverId, sequenceNumber: 1 });
      const rec2 = await IntegrityRecord.findOne({ serverId: testServer.serverId, sequenceNumber: 2 });

      assert.ok(rec1);
      assert.ok(rec2);
      assert.equal(rec1.previousHash, GENESIS_PREVIOUS_HASH);
      assert.equal(rec2.previousHash, rec1.eventHash);
      assert.equal(rec2.eventHash, res1.data.chainHeadHash);

      // Ingest batch 2 (1 event)
      const res2 = await collectorClient.post('/api/collector/logs', {
        batchId: 'batch_beta',
        events: [
          { eventId: 'evt_beta_1', source: '/var/log/syslog', message: 'Kernel audit event 304' },
        ],
      });

      assert.equal(res2.status, 200);
      assert.equal(res2.data.chainHeadSequence, 3);

      const rec3 = await IntegrityRecord.findOne({ serverId: testServer.serverId, sequenceNumber: 3 });
      assert.equal(rec3.previousHash, rec2.eventHash);
    });

    it('should idempotently deduplicate retried batches without creating new chain records', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      const payload = {
        batchId: 'batch_idemp',
        events: [
          { eventId: 'evt_repeat_1', source: '/var/log/syslog', message: 'First attempt' },
          { eventId: 'evt_repeat_2', source: '/var/log/syslog', message: 'Second event' },
        ],
      };

      // First dispatch
      const firstRes = await collectorClient.post('/api/collector/logs', payload);
      assert.equal(firstRes.status, 200);
      assert.equal(firstRes.data.acceptedCount, 2);
      assert.equal(firstRes.data.duplicateCount, 0);
      assert.equal(firstRes.data.chainHeadSequence, 2);

      // Immediate retry of identical batch
      const retryRes = await collectorClient.post('/api/collector/logs', payload);
      assert.equal(retryRes.status, 200);
      assert.equal(retryRes.data.acceptedCount, 0);
      assert.equal(retryRes.data.duplicateCount, 2);
      assert.equal(retryRes.data.chainHeadSequence, 2); // Chain head unchanged

      const totalCount = await IntegrityRecord.countDocuments({ serverId: testServer.serverId });
      assert.equal(totalCount, 2);
    });

    it('should safely serialize concurrent batch ingestion preventing duplicate sequences or forked chains', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      // Dispatch 3 batches concurrently
      const p1 = collectorClient.post('/api/collector/logs', {
        batchId: 'concurrent_b1',
        events: [{ eventId: 'c_evt_1', source: 'app.log', message: 'Concurrent 1' }],
      });
      const p2 = collectorClient.post('/api/collector/logs', {
        batchId: 'concurrent_b2',
        events: [{ eventId: 'c_evt_2', source: 'app.log', message: 'Concurrent 2' }],
      });
      const p3 = collectorClient.post('/api/collector/logs', {
        batchId: 'concurrent_b3',
        events: [{ eventId: 'c_evt_3', source: 'app.log', message: 'Concurrent 3' }],
      });

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);
      assert.equal(r3.status, 200);

      // Verify strict contiguous sequences 1, 2, 3 in database
      const records = await IntegrityRecord.find({ serverId: testServer.serverId }).sort({ sequenceNumber: 1 });
      assert.equal(records.length, 3);
      assert.equal(records[0].sequenceNumber, 1);
      assert.equal(records[1].sequenceNumber, 2);
      assert.equal(records[2].sequenceNumber, 3);

      // Verify chain linkages
      assert.equal(records[0].previousHash, GENESIS_PREVIOUS_HASH);
      assert.equal(records[1].previousHash, records[0].eventHash);
      assert.equal(records[2].previousHash, records[1].eventHash);
    });
  });

  /* ================= 3. Independent Verification Engine ================= */

  describe('3. Cryptographic Verification & Tamper Detection Engine', () => {
    it('should return VERIFIED for an untouched, genuine chain', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'verify_b1',
        events: [
          { eventId: 'v_1', source: 'syslog', message: 'Message 1' },
          { eventId: 'v_2', source: 'syslog', message: 'Message 2' },
          { eventId: 'v_3', source: 'syslog', message: 'Message 3' },
        ],
      });

      const result = await verifyServerChain(testServer.serverId);
      assert.equal(result.status, 'VERIFIED');
      assert.equal(result.recordsChecked, 3);
      assert.equal(result.findings.length, 0);
    });

    it('should detect modified canonical payload and flag TAMPERED with HASH_MISMATCH', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'tamper_b1',
        events: [
          { eventId: 't_1', source: 'syslog', message: 'Initial line' },
          { eventId: 't_2', source: 'syslog', message: 'Legitimate transaction' },
        ],
      });

      // Directly tamper with stored canonical payload of sequence #2
      await IntegrityRecord.updateOne(
        { serverId: testServer.serverId, sequenceNumber: 2 },
        { $set: { canonicalPayload: '{"forged":"attacker modification"}' } }
      );

      const result = await verifyServerChain(testServer.serverId);
      assert.equal(result.status, 'TAMPERED');
      assert.ok(result.findings.some((f) => f.type === 'HASH_MISMATCH' && f.sequenceNumber === 2));
    });

    it('should detect altered eventHash and flag TAMPERED', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'tamper_b2',
        events: [
          { eventId: 'th_1', source: 'syslog', message: 'Entry 1' },
          { eventId: 'th_2', source: 'syslog', message: 'Entry 2' },
        ],
      });

      // Directly tamper with stored eventHash of sequence #1
      await IntegrityRecord.updateOne(
        { serverId: testServer.serverId, sequenceNumber: 1 },
        { $set: { eventHash: 'a'.repeat(64) } }
      );

      const result = await verifyServerChain(testServer.serverId);
      assert.equal(result.status, 'TAMPERED');
      assert.ok(result.findings.some((f) => f.type === 'HASH_MISMATCH' || f.type === 'BROKEN_CHAIN_LINK'));
    });

    it('should detect broken chain link when previousHash is modified', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'tamper_b3',
        events: [
          { eventId: 'bl_1', source: 'syslog', message: 'Entry 1' },
          { eventId: 'bl_2', source: 'syslog', message: 'Entry 2' },
        ],
      });

      // Modify previousHash on sequence 2
      await IntegrityRecord.updateOne(
        { serverId: testServer.serverId, sequenceNumber: 2 },
        { $set: { previousHash: 'b'.repeat(64) } }
      );

      const result = await verifyServerChain(testServer.serverId);
      assert.equal(result.status, 'TAMPERED');
      assert.ok(result.findings.some((f) => f.type === 'BROKEN_CHAIN_LINK'));
    });

    it('should detect deleted or missing record within sequence and flag SEQUENCE_GAP', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'gap_b1',
        events: [
          { eventId: 'g_1', source: 'syslog', message: 'Seq 1' },
          { eventId: 'g_2', source: 'syslog', message: 'Seq 2 to be deleted' },
          { eventId: 'g_3', source: 'syslog', message: 'Seq 3' },
        ],
      });

      // Simulate attacker deleting sequence #2
      await IntegrityRecord.deleteOne({ serverId: testServer.serverId, sequenceNumber: 2 });

      const result = await verifyServerChain(testServer.serverId);
      assert.equal(result.status, 'TAMPERED');
      assert.ok(result.findings.some((f) => f.type === 'SEQUENCE_GAP' && f.sequenceNumber === 2));
    });

    it('should flag INCOMPLETE when verifying a sub-range without preceding anchor history', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'sub_b1',
        events: [
          { eventId: 's_1', source: 'syslog', message: 'Seq 1' },
          { eventId: 's_2', source: 'syslog', message: 'Seq 2' },
          { eventId: 's_3', source: 'syslog', message: 'Seq 3' },
        ],
      });

      // Delete sequence #1 so verifying sequence 2..3 lacks anchor
      await IntegrityRecord.deleteOne({ serverId: testServer.serverId, sequenceNumber: 1 });

      const result = await verifyServerChain(testServer.serverId, { fromSequence: 2, toSequence: 3 });
      assert.equal(result.status, 'INCOMPLETE');
      assert.ok(result.findings.some((f) => f.type === 'MISSING_PRECEDING_HISTORY'));
    });
  });

  /* ================= 4. Verification APIs & RBAC ================= */

  describe('4. Verification APIs & Role Authorization', () => {
    it('should allow both Admin and Security Analyst to view summary and run verification', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'rbac_b1',
        events: [{ eventId: 'rb_1', source: 'syslog', message: 'Role check log' }],
      });

      // 1. Admin summary & verify
      const adminSummary = await adminClient.get(`/api/integrity/servers/${testServer.serverId}/summary`);
      assert.equal(adminSummary.status, 200);
      assert.equal(adminSummary.data.totalEventsInChain, 1);

      const adminVerify = await adminClient.post(`/api/integrity/servers/${testServer.serverId}/verify`, {});
      assert.equal(adminVerify.status, 200);
      assert.equal(adminVerify.data.status, 'VERIFIED');

      // 2. Security Analyst summary & verify
      const analystSummary = await analystClient.get(`/api/integrity/servers/${testServer.serverId}/summary`);
      assert.equal(analystSummary.status, 200);
      assert.equal(analystSummary.data.totalEventsInChain, 1);

      const analystVerify = await analystClient.post(`/api/integrity/servers/${testServer.serverId}/verify`, {});
      assert.equal(analystVerify.status, 200);
      assert.equal(analystVerify.data.status, 'VERIFIED');
    });

    it('should reject unauthenticated requests to integrity endpoints with HTTP 401', async () => {
      const unauthClient = new TestClient(baseUrl);
      const res = await unauthClient.get(`/api/integrity/servers/${testServer.serverId}/summary`);
      assert.equal(res.status, 401);
    });

    it('should return paginated events and single sequence detail', async () => {
      const collectorClient = new TestClient(baseUrl);
      collectorClient.setHeaders({
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${collectorCredential}`,
      });

      await collectorClient.post('/api/collector/logs', {
        batchId: 'paginate_b1',
        events: [
          { eventId: 'p_1', source: 'auth.log', message: 'Event 1' },
          { eventId: 'p_2', source: 'auth.log', message: 'Event 2' },
        ],
      });

      // Paginated list
      const listRes = await analystClient.get(`/api/integrity/servers/${testServer.serverId}/events?page=1&limit=10`);
      assert.equal(listRes.status, 200);
      assert.equal(listRes.data.events.length, 2);
      assert.equal(listRes.data.pagination.total, 2);

      // Single sequence detail
      const detailRes = await analystClient.get(`/api/integrity/servers/${testServer.serverId}/events/1`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.data.event.sequenceNumber, 1);
      assert.ok(detailRes.data.event.canonicalPayload);
      assert.equal(detailRes.data.event.previousHash, GENESIS_PREVIOUS_HASH);
    });
  });
});
