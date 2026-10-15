import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { LogEvent } from '../src/models/LogEvent.js';
import { TestClient } from './testClient.js';
import { bootstrapCollector } from '../../collector/src/index.js';

describe('LogSentinel — Phase 3: End-to-End Collector Agent Integration Test', () => {
  let mongoServer;
  let serverInstance;
  let adminClient;
  let baseUrl;
  let testServerId;
  let enrollmentToken;
  let tmpStateDir;
  let sampleLogPath;
  let runningCollector;

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
    baseUrl = `http://127.0.0.1:${address.port}/api`;

    adminClient = new TestClient(`http://127.0.0.1:${address.port}`);

    // Create Admin user
    const passwordHash = await bcrypt.hash('TestSecurePass2026!', 10);
    await User.create({
      name: 'E2E Admin',
      email: 'admin@logsentinel.local',
      passwordHash,
      role: 'Admin',
    });

    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'admin@logsentinel.local',
      password: 'TestSecurePass2026!',
    });

    // Register server
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'E2E-TEST-NODE',
      hostname: 'e2e-node.local',
      os: 'Linux',
      environment: 'Production',
    });
    testServerId = srvRes.data.server.serverId;

    // Generate enrollment token
    const tokenRes = await adminClient.post(`/api/servers/${testServerId}/enrollment-token`);
    enrollmentToken = tokenRes.data.enrollmentToken;

    // Setup temporary state and log directories
    tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logsentinel-e2e-state-'));
    sampleLogPath = path.join(tmpStateDir, 'app.log');
    fs.writeFileSync(sampleLogPath, 'Initial pre-existing line\n', 'utf8');
  });

  after(async () => {
    if (runningCollector) {
      if (runningCollector.logReader) runningCollector.logReader.stop();
      if (runningCollector.sender) runningCollector.sender.stop();
      if (runningCollector.heartbeat) runningCollector.heartbeat.stop();
    }

    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    try {
      fs.rmSync(tmpStateDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('should auto-enroll, tail log file, stream batches, and send heartbeats to backend', async () => {
    // Start collector agent with enrollment token and log source
    runningCollector = await bootstrapCollector({
      backendUrl: baseUrl,
      serverId: testServerId,
      enrollmentToken: enrollmentToken,
      stateDir: tmpStateDir,
      sources: [{ path: sampleLogPath, pollIntervalMs: 200 }],
      batchSize: 10,
      flushIntervalMs: 200,
      heartbeatIntervalMs: 1000,
    });

    // 1. Verify credential was saved in stateDir/credentials.json
    const credsPath = path.join(tmpStateDir, 'credentials.json');
    assert.ok(fs.existsSync(credsPath));
    const savedCreds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    assert.ok(savedCreds.credential.startsWith('col_sec_'));
    assert.equal(savedCreds.serverId, testServerId);

    // 2. Append new lines to sample log
    const line1 = '2026-10-11T00:00:01Z [AUTH] User alice logged in via SSH';
    const line2 = '2026-10-11T00:00:02Z [SUDO] alice executed sudo -i';
    fs.appendFileSync(sampleLogPath, `${line1}\n${line2}\n`, 'utf8');

    // Wait for collector to poll and sender to flush
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 3. Verify backend received and persisted both log lines
    const events = await LogEvent.find({ serverId: testServerId }).sort({ observedAt: 1 });
    assert.ok(events.length >= 2);
    const messages = events.map((e) => e.message);
    assert.ok(messages.includes(line1));
    assert.ok(messages.includes(line2));

    // 4. Verify server status in backend is ONLINE with real lastHeartbeatAt
    const serverRecord = await Server.findOne({ serverId: testServerId });
    assert.equal(serverRecord.enrollmentStatus, 'ENROLLED');
    assert.ok(serverRecord.lastHeartbeatAt);
    assert.equal(serverRecord.toSafeObject().connectionStatus, 'ONLINE');

    // 5. Query logs through web API endpoint GET /api/servers/:id/logs
    const logsRes = await adminClient.get(`/api/servers/${testServerId}/logs`);
    assert.equal(logsRes.status, 200);
    assert.ok(logsRes.data.logs.length >= 2);
  });
});
