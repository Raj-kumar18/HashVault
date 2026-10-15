import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { EnrollmentToken } from '../src/models/EnrollmentToken.js';
import { LogEvent } from '../src/models/LogEvent.js';
import { TestClient } from './testClient.js';

describe('LogSentinel — Phase 3: Backend Collector Ingestion & Heartbeat Test Suite', () => {
  let mongoServer;
  let serverInstance;
  let adminClient;
  let collectorClient;
  let baseUrl;

  let adminUser;
  let testServer;
  let rawCollectorCredential;

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
    collectorClient = new TestClient(baseUrl);
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
    await User.deleteMany({});
    await Server.deleteMany({});
    await EnrollmentToken.deleteMany({});
    await LogEvent.deleteMany({});

    adminClient.clearCookies();
    collectorClient.clearCookies();

    // Create Admin user
    const passwordHash = await bcrypt.hash('TestSecurePass2026!', 10);
    adminUser = await User.create({
      name: 'Ingestion Admin',
      email: 'admin@logsentinel.local',
      passwordHash,
      role: 'Admin',
    });

    // Authenticate Admin
    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'admin@logsentinel.local',
      password: 'TestSecurePass2026!',
    });

    // Register a server
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'INGESTION-NODE-01',
      hostname: 'ingest-01.company.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    // Generate enrollment token
    const tokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    const rawToken = tokenRes.data.enrollmentToken;

    // Enroll collector
    const enrollRes = await collectorClient.post('/api/collector/enroll', {
      token: rawToken,
      serverId,
    });

    rawCollectorCredential = enrollRes.data.credential;
    testServer = await Server.findOne({ serverId });
  });

  /* ================= 1. Collector Authentication ================= */

  it('1. should reject log ingestion with missing authentication headers', async () => {
    const unauthClient = new TestClient(baseUrl);
    const res = await unauthClient.post('/api/collector/logs', {
      batchId: 'batch_test_01',
      events: [{ source: '/var/log/auth.log', message: 'test line' }],
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.error, 'Unauthorized');
  });

  it('2. should reject log ingestion with invalid collector credential', async () => {
    const res = await collectorClient.post(
      '/api/collector/logs',
      {
        batchId: 'batch_test_01',
        events: [{ source: '/var/log/auth.log', message: 'test line' }],
      },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: 'Bearer col_sec_wrong_credential_invalid_hex',
      }
    );

    assert.equal(res.status, 401);
    assert.equal(res.data.error, 'Unauthorized');
  });

  it('3. should reject collector requests when server is disabled', async () => {
    // Disable the server
    await adminClient.post(`/api/servers/${testServer.serverId}/disable`);

    const res = await collectorClient.post(
      '/api/collector/logs',
      {
        batchId: 'batch_test_01',
        events: [{ source: '/var/log/auth.log', message: 'test line' }],
      },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );

    assert.equal(res.status, 403);
    assert.equal(res.data.error, 'Forbidden');
  });

  /* ================= 2. Durable Log Ingestion ================= */

  it('4. should durably persist log batches and return acknowledgement', async () => {
    const events = [
      {
        eventId: 'evt_ingest_001',
        source: '/var/log/auth.log',
        sourceOffset: 100,
        message: 'Accepted publickey for ubuntu from 192.168.1.50 port 45212',
        observedAt: new Date().toISOString(),
        collectorMetadata: { hostname: 'ingest-01.company.local', agentVersion: '1.0.0' },
      },
      {
        eventId: 'evt_ingest_002',
        source: '/var/log/auth.log',
        sourceOffset: 180,
        message: 'pam_unix(sshd:session): session opened for user ubuntu',
        observedAt: new Date().toISOString(),
      },
    ];

    const res = await collectorClient.post(
      '/api/collector/logs',
      {
        batchId: 'batch_first_001',
        sentAt: new Date().toISOString(),
        events,
      },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.acknowledgedBatchId, 'batch_first_001');
    assert.equal(res.data.acceptedCount, 2);
    assert.equal(res.data.duplicateCount, 0);

    // Verify events in database
    const savedEvents = await LogEvent.find({ serverId: testServer.serverId }).sort({ sourceOffset: 1 });
    assert.equal(savedEvents.length, 2);
    assert.equal(savedEvents[0].eventId, 'evt_ingest_001');
    assert.equal(savedEvents[0].message, events[0].message);
    assert.equal(savedEvents[1].eventId, 'evt_ingest_002');

    // Verify server heartbeat and status updated
    const updatedServer = await Server.findOne({ serverId: testServer.serverId });
    assert.ok(updatedServer.lastHeartbeatAt);
    assert.equal(updatedServer.toSafeObject().connectionStatus, 'ONLINE');
  });

  it('5. should idempotently deduplicate previously ingested events', async () => {
    const events = [
      {
        eventId: 'evt_dedup_001',
        source: '/var/log/syslog',
        message: 'systemd[1]: Starting Daily apt upgrade...',
        observedAt: new Date().toISOString(),
      },
      {
        eventId: 'evt_dedup_002',
        source: '/var/log/syslog',
        message: 'systemd[1]: apt-daily-upgrade.service: Deactivated successfully.',
        observedAt: new Date().toISOString(),
      },
    ];

    // First ingestion
    const firstRes = await collectorClient.post(
      '/api/collector/logs',
      { batchId: 'batch_d1', events },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );
    assert.equal(firstRes.status, 200);
    assert.equal(firstRes.data.acceptedCount, 2);
    assert.equal(firstRes.data.duplicateCount, 0);

    // Re-transmission with duplicate event evt_dedup_001 and a new event evt_dedup_003
    const mixedEvents = [
      events[0], // Duplicate!
      {
        eventId: 'evt_dedup_003',
        source: '/var/log/syslog',
        message: 'CRON[1234]: (root) CMD (/usr/local/bin/backup.sh)',
        observedAt: new Date().toISOString(),
      },
    ];

    const secondRes = await collectorClient.post(
      '/api/collector/logs',
      { batchId: 'batch_d2', events: mixedEvents },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );

    assert.equal(secondRes.status, 200);
    assert.equal(secondRes.data.acceptedCount, 1); // Only evt_dedup_003 accepted
    assert.equal(secondRes.data.duplicateCount, 1); // evt_dedup_001 marked duplicate

    // Total in database must be exactly 3 events
    const count = await LogEvent.countDocuments({ serverId: testServer.serverId });
    assert.equal(count, 3);
  });

  it('6. should reject batches exceeding maximum size limit', async () => {
    const hugeEvents = Array.from({ length: 501 }, (_, i) => ({
      eventId: `evt_overflow_${i}`,
      source: '/var/log/test.log',
      message: `Event line ${i}`,
      observedAt: new Date().toISOString(),
    }));

    const res = await collectorClient.post(
      '/api/collector/logs',
      { batchId: 'batch_overflow', events: hugeEvents },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );

    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'PayloadTooLarge');
  });

  /* ================= 3. Heartbeat & Freshness Derivation ================= */

  it('7. should record authenticated heartbeats and mark server ONLINE', async () => {
    const res = await collectorClient.post(
      '/api/collector/heartbeat',
      {
        agentVersion: '1.0.0',
        currentHealth: 'HEALTHY',
        pendingQueueCount: 0,
        diagnostics: { uptimeSeconds: 300, memoryUsageMb: 42.5, sourcesMonitored: 2 },
      },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.connectionStatus, 'ONLINE');
    assert.ok(res.data.acknowledgedAt);

    // Verify in Server query
    const dbServer = await Server.findOne({ serverId: testServer.serverId });
    assert.ok(dbServer.lastHeartbeatAt);
    assert.equal(dbServer.toSafeObject().connectionStatus, 'ONLINE');
  });

  it('8. should derive OFFLINE status when heartbeat freshness window expires', async () => {
    // Manually set lastHeartbeatAt to 5 minutes ago (threshold is 2 minutes)
    await Server.updateOne(
      { serverId: testServer.serverId },
      { $set: { lastHeartbeatAt: new Date(Date.now() - 5 * 60 * 1000) } }
    );

    const srv = await Server.findOne({ serverId: testServer.serverId });
    assert.equal(srv.toSafeObject().connectionStatus, 'OFFLINE');
  });

  /* ================= 4. Web User Log Query ================= */

  it('9. should allow authorized web users to retrieve ingested server logs via GET /api/servers/:id/logs', async () => {
    // Ingest 2 events
    await collectorClient.post(
      '/api/collector/logs',
      {
        batchId: 'batch_web_query',
        events: [
          { eventId: 'evt_log_1', source: '/var/log/auth.log', message: 'Web query line 1' },
          { eventId: 'evt_log_2', source: '/var/log/syslog', message: 'Web query line 2' },
        ],
      },
      {
        'X-Server-Id': testServer.serverId,
        Authorization: `Bearer ${rawCollectorCredential}`,
      }
    );

    // Admin queries server logs
    const res = await adminClient.get(`/api/servers/${testServer.serverId}/logs`);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.logs.length, 2);
    assert.equal(res.data.pagination.total, 2);
  });
});
