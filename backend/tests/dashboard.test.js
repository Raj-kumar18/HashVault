import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { LogEvent } from '../src/models/LogEvent.js';
import { Alert } from '../src/models/Alert.js';
import { Checkpoint } from '../src/models/Checkpoint.js';
import { IntegrityRecord } from '../src/models/IntegrityRecord.js';
import { TestClient } from './testClient.js';

describe('LogSentinel — Phase 7: Dashboard Overview & Logs Explorer Suite', () => {
  let mongoServer;
  let serverInstance;
  let baseUrl;
  let adminClient;
  let analystClient;
  let unauthClient;
  let adminUser;
  let analystUser;
  let testServer1;
  let testServer2;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test_session_secret_with_more_than_32_characters_for_security_assurance!';
    process.env.HEARTBEAT_STALE_THRESHOLD_MS = '30000';
    process.env.HEARTBEAT_OFFLINE_THRESHOLD_MS = '60000';

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
    unauthClient = new TestClient(baseUrl);

    // Create Admin user
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
    adminUser = await User.create({
      name: 'Dashboard Administrator',
      email: 'dash-admin@logsentinel.test',
      passwordHash: adminPasswordHash,
      role: 'Admin',
    });

    // Create Security Analyst user
    const analystPasswordHash = await bcrypt.hash('AnalystPass123!', 10);
    analystUser = await User.create({
      name: 'Dashboard Analyst',
      email: 'dash-analyst@logsentinel.test',
      passwordHash: analystPasswordHash,
      role: 'Security Analyst',
    });

    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'dash-admin@logsentinel.test',
      password: 'AdminPass123!',
    });

    await analystClient.fetchCsrf();
    await analystClient.post('/api/auth/login', {
      email: 'dash-analyst@logsentinel.test',
      password: 'AnalystPass123!',
    });
  });

  after(async () => {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Server.deleteMany({});
    await LogEvent.deleteMany({});
    await Alert.deleteMany({});
    await Checkpoint.deleteMany({});
    await IntegrityRecord.deleteMany({});

    // Seed server 1 (Online)
    testServer1 = await Server.create({
      serverId: 'srv_dash_01',
      serverName: 'EDGE-GATEWAY-01',
      hostname: 'edge01.internal',
      os: 'Linux',
      environment: 'Production',
      ownerId: adminUser._id,
      enrollmentStatus: 'ENROLLED',
      lastHeartbeatAt: new Date(Date.now() - 5000), // 5 seconds ago -> ONLINE
      chainHeadSequence: 3,
      lastVerificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
    });

    // Seed server 2 (Stale)
    testServer2 = await Server.create({
      serverId: 'srv_dash_02',
      serverName: 'DB-REPLICA-01',
      hostname: 'db01.internal',
      os: 'Linux',
      environment: 'Staging',
      ownerId: adminUser._id,
      enrollmentStatus: 'ENROLLED',
      lastHeartbeatAt: new Date(Date.now() - 40000), // 40 seconds ago -> STALE
      chainHeadSequence: 1,
      lastVerificationStatus: 'NOT_VERIFIED',
    });

    // Seed log events for server 1
    await LogEvent.create([
      {
        eventId: 'evt_dash_01',
        serverId: testServer1.serverId,
        serverRef: testServer1._id,
        batchId: 'batch_dash_01',
        source: '/var/log/syslog',
        message: 'System initialization started',
        sequenceNumber: 1,
        eventHash: 'a'.repeat(64),
        observedAt: new Date(Date.now() - 3600000),
        ingestedAt: new Date(Date.now() - 3600000),
      },
      {
        eventId: 'evt_dash_02',
        serverId: testServer1.serverId,
        serverRef: testServer1._id,
        batchId: 'batch_dash_01',
        source: '/var/log/auth.log',
        message: 'SSH authentication accepted for admin',
        sequenceNumber: 2,
        eventHash: 'b'.repeat(64),
        observedAt: new Date(Date.now() - 1800000),
        ingestedAt: new Date(Date.now() - 1800000),
      },
      {
        eventId: 'evt_dash_03',
        serverId: testServer1.serverId,
        serverRef: testServer1._id,
        batchId: 'batch_dash_01',
        source: '/var/log/auth.log',
        message: 'Sudo command executed by root',
        sequenceNumber: 3,
        eventHash: 'c'.repeat(64),
        observedAt: new Date(Date.now() - 60000),
        ingestedAt: new Date(Date.now() - 60000),
      },
    ]);

    // Seed alerts
    await Alert.create({
      alertId: 'alt_dash_01',
      alertType: 'COLLECTOR_STALE',
      severity: 'MEDIUM',
      status: 'OPEN',
      title: 'Stale Collector on DB-REPLICA-01',
      description: 'Collector has not reported in 40s',
      serverId: testServer2.serverId,
      serverName: testServer2.serverName,
      dedupKey: `${testServer2.serverId}:COLLECTOR_STALE`,
      detectedAt: new Date(),
    });

    // Seed checkpoint
    await Checkpoint.create({
      checkpointId: '0x' + '11'.repeat(32),
      applicationId: 'logsentinel-test',
      serverId: testServer1.serverId,
      serverCommitment: '0x' + '22'.repeat(32),
      startSequence: 1,
      endSequence: 2,
      eventCount: 2,
      startBoundaryHash: '0x' + '33'.repeat(32),
      endBoundaryHash: '0x' + '44'.repeat(32),
      checkpointRoot: '0x' + '55'.repeat(32),
      networkChainId: 31337,
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      transactionStatus: 'CONFIRMED',
      transactionHash: '0x' + '66'.repeat(32),
      blockNumber: 104,
      createdBy: adminUser._id,
    });
  });

  describe('1. Security Overview API (GET /api/overview)', () => {
    it('should reject unauthenticated requests with HTTP 401', async () => {
      const res = await unauthClient.get('/api/overview');
      assert.equal(res.status, 401);
    });

    it('should return comprehensive, real persisted overview metrics for Admin', async () => {
      const res = await adminClient.get('/api/overview');
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);

      const { metrics, serverHealthList, recentAlerts, recentActivity } = res.data;

      // Real metrics calculations
      assert.equal(metrics.totalServers, 2);
      assert.equal(metrics.onlineCollectors, 1); // srv_dash_01
      assert.equal(metrics.staleCollectors, 1);  // srv_dash_02
      assert.equal(metrics.offlineCollectors, 0);
      assert.equal(metrics.totalEvents, 3);
      assert.equal(metrics.events24h, 3);
      assert.equal(metrics.confirmedCheckpoints, 1);
      assert.equal(metrics.openAlerts, 1);
      assert.equal(metrics.alertsBySeverity.MEDIUM, 1);

      // Latest verification record
      assert.ok(metrics.latestVerification);
      assert.equal(metrics.latestVerification.serverId, testServer1.serverId);
      assert.equal(metrics.latestVerification.status, 'VERIFIED');

      // Server health table data
      assert.equal(serverHealthList.length, 2);
      const srv1 = serverHealthList.find((s) => s.serverId === testServer1.serverId);
      assert.equal(srv1.collectorHealth, 'ONLINE');
      assert.equal(srv1.chainHeadSequence, 3);
      assert.equal(srv1.lastVerificationStatus, 'VERIFIED');

      // Recent alerts & real activity stream
      assert.equal(recentAlerts.length, 1);
      assert.ok(recentActivity.length > 0);
      assert.ok(recentActivity.some((a) => a.type === 'SECURITY_ALERT'));
      assert.ok(recentActivity.some((a) => a.type === 'BLOCKCHAIN_CHECKPOINT'));
    });

    it('should allow Security Analyst to access overview with accurate scoping', async () => {
      const res = await analystClient.get('/api/overview');
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
    });
  });

  describe('2. Universal Logs Explorer API (GET /api/logs)', () => {
    it('should reject unauthenticated requests with HTTP 401', async () => {
      const res = await unauthClient.get('/api/logs');
      assert.equal(res.status, 401);
    });

    it('should return paginated logs across authorized servers with metadata', async () => {
      const res = await adminClient.get('/api/logs?page=1&limit=10');
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.logs.length, 3);
      assert.equal(res.data.pagination.total, 3);
      assert.equal(res.data.pagination.page, 1);
      assert.ok(res.data.availableServers.length > 0);
      assert.ok(res.data.availableSources.includes('/var/log/syslog'));
      assert.ok(res.data.availableSources.includes('/var/log/auth.log'));
    });

    it('should filter logs by source correctly', async () => {
      const res = await adminClient.get('/api/logs?source=/var/log/auth.log');
      assert.equal(res.status, 200);
      assert.equal(res.data.logs.length, 2);
      assert.ok(res.data.logs.every((l) => l.source === '/var/log/auth.log'));
    });

    it('should filter logs by text search matching message', async () => {
      const res = await adminClient.get('/api/logs?search=Sudo');
      assert.equal(res.status, 200);
      assert.equal(res.data.logs.length, 1);
      assert.equal(res.data.logs[0].eventId, 'evt_dash_03');
    });

    it('should filter logs by sequence range [2, 3]', async () => {
      const res = await adminClient.get('/api/logs?minSequence=2&maxSequence=3');
      assert.equal(res.status, 200);
      assert.equal(res.data.logs.length, 2);
      assert.ok(res.data.logs.every((l) => l.sequenceNumber >= 2 && l.sequenceNumber <= 3));
    });

    it('should retrieve deep event detail with cryptographic proof on GET /api/logs/:eventId', async () => {
      // Seed integrity record for evt_dash_02
      await IntegrityRecord.create({
        serverId: testServer1.serverId,
        serverRef: testServer1._id,
        sequenceNumber: 2,
        eventId: 'evt_dash_02',
        canonicalPayload: '{"message":"SSH authentication accepted for admin"}',
        previousHash: 'a'.repeat(64),
        eventHash: 'b'.repeat(64),
        hashVersion: 'sha256-rfc8785-v1',
      });

      const res = await adminClient.get('/api/logs/evt_dash_02');
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.event.eventId, 'evt_dash_02');
      assert.ok(res.data.event.cryptographicProof);
      assert.equal(res.data.event.cryptographicProof.sequenceNumber, 2);
      assert.equal(res.data.event.cryptographicProof.eventHash, 'b'.repeat(64));
    });

    it('should return HTTP 404 for non-existent log event', async () => {
      const res = await adminClient.get('/api/logs/non_existent_evt');
      assert.equal(res.status, 404);
      assert.equal(res.data.error, 'NotFound');
    });
  });
});
