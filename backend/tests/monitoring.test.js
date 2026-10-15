import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { Alert } from '../src/models/Alert.js';
import { SimulationRun } from '../src/models/SimulationRun.js';
import { TestClient } from './testClient.js';
import {
  computeCollectorHealth,
  raiseOrUpdateAlert,
  autoResolveAlert,
  acknowledgeAlert,
  resolveAlert,
  evaluateFleetMonitoring,
  getMonitoringOverview,
  getMonitoredServers,
} from '../src/services/monitoring.service.js';
import { runMonitoringCycle } from '../src/monitoring/scheduler.js';
import {
  runControlledAttackScenario,
  isSimulationPermitted,
} from '../src/simulation/simulator.service.js';

describe('LogSentinel — Phase 6: Monitoring Engine, Security Alerts & Attack Simulator Suite', () => {
  let mongoServer;
  let serverInstance;
  let adminClient;
  let analystClient;
  let baseUrl;
  let adminUser;
  let analystUser;
  let testServer;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test_session_secret_with_more_than_32_characters_for_security_assurance!';
    process.env.HEARTBEAT_STALE_THRESHOLD_MS = '30000'; // 30s for test
    process.env.HEARTBEAT_OFFLINE_THRESHOLD_MS = '60000'; // 60s for test

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
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
    adminUser = await User.create({
      name: 'SecOps Administrator',
      email: 'secops-admin@logsentinel.test',
      passwordHash: adminPasswordHash,
      role: 'Admin',
    });

    // Create Security Analyst user
    const analystPasswordHash = await bcrypt.hash('AnalystPass123!', 10);
    analystUser = await User.create({
      name: 'Security Analyst One',
      email: 'analyst@logsentinel.test',
      passwordHash: analystPasswordHash,
      role: 'Security Analyst',
    });

    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'secops-admin@logsentinel.test',
      password: 'AdminPass123!',
    });

    await analystClient.fetchCsrf();
    await analystClient.post('/api/auth/login', {
      email: 'analyst@logsentinel.test',
      password: 'AnalystPass123!',
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
    await Server.deleteMany({});
    await Alert.deleteMany({});
    await SimulationRun.deleteMany({});

    testServer = await Server.create({
      serverName: 'MONITORED-SRV-01',
      hostname: 'mon-01.company.local',
      os: 'Linux',
      environment: 'Production',
      ownerId: adminUser._id,
      enrollmentStatus: 'ENROLLED',
      connectionStatus: 'ONLINE',
      lastHeartbeatAt: new Date(),
      serverId: 'srv_mon_test_01',
      chainHeadSequence: 5,
    });
  });

  /* ================= 1. Collector Health Monitoring ================= */

  describe('1. Collector Health Calculation & State Machine', () => {
    it('should calculate ONLINE when heartbeat is within freshness window', () => {
      const server = {
        enrollmentStatus: 'ENROLLED',
        lastHeartbeatAt: new Date(Date.now() - 5000), // 5s ago
      };
      assert.equal(computeCollectorHealth(server), 'ONLINE');
    });

    it('should calculate STALE when heartbeat exceeds stale threshold', () => {
      const server = {
        enrollmentStatus: 'ENROLLED',
        lastHeartbeatAt: new Date(Date.now() - 40000), // 40s ago (> 30s threshold)
      };
      assert.equal(computeCollectorHealth(server), 'STALE');
    });

    it('should calculate OFFLINE when heartbeat exceeds offline threshold', () => {
      const server = {
        enrollmentStatus: 'ENROLLED',
        lastHeartbeatAt: new Date(Date.now() - 80000), // 80s ago (> 60s threshold)
      };
      assert.equal(computeCollectorHealth(server), 'OFFLINE');
    });

    it('should calculate DISABLED when server is explicitly decommissioned', () => {
      const server = {
        enrollmentStatus: 'DISABLED',
        lastHeartbeatAt: new Date(),
      };
      assert.equal(computeCollectorHealth(server), 'DISABLED');
    });

    it('should calculate UNKNOWN when server has never sent a heartbeat', () => {
      const server = {
        enrollmentStatus: 'ENROLLED',
        lastHeartbeatAt: null,
      };
      assert.equal(computeCollectorHealth(server), 'UNKNOWN');
    });
  });

  /* ================= 2. Alert Generation & Deduplication ================= */

  describe('2. Security Alert Generation & Deduplication Engine', () => {
    it('should raise an initial OPEN alert and deduplicate subsequent occurrences', async () => {
      const res1 = await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_STALE',
        severity: 'MEDIUM',
        title: 'Collector Stale on MONITORED-SRV-01',
        description: 'No heartbeat received for 45 seconds.',
        serverId: testServer.serverId,
        serverName: testServer.serverName,
        dedupKey: `${testServer.serverId}:COLLECTOR_STALE`,
      });

      assert.equal(res1.isNew, true);
      assert.equal(res1.alert.status, 'OPEN');
      assert.equal(res1.alert.occurrenceCount, 1);

      // Re-raise same condition
      const res2 = await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_STALE',
        severity: 'MEDIUM',
        title: 'Collector Stale on MONITORED-SRV-01',
        description: 'Still no heartbeat received.',
        serverId: testServer.serverId,
        serverName: testServer.serverName,
        dedupKey: `${testServer.serverId}:COLLECTOR_STALE`,
      });

      assert.equal(res2.isNew, false);
      assert.equal(res2.alert._id.toString(), res1.alert._id.toString());
      assert.equal(res2.alert.occurrenceCount, 2);

      // Assert only 1 document in database
      const count = await Alert.countDocuments({ serverId: testServer.serverId });
      assert.equal(count, 1);
    });

    it('should auto-resolve active alerts when condition clears', async () => {
      const dedupKey = `${testServer.serverId}:COLLECTOR_STALE`;
      await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_STALE',
        severity: 'MEDIUM',
        title: 'Collector Stale',
        description: 'Heartbeat delay.',
        serverId: testServer.serverId,
        dedupKey,
      });

      const resolved = await autoResolveAlert(dedupKey, 'Heartbeat resumed.');
      assert.ok(resolved);
      assert.equal(resolved.status, 'RESOLVED');
      assert.ok(resolved.resolvedAt);

      const dbAlert = await Alert.findOne({ dedupKey });
      assert.equal(dbAlert.status, 'RESOLVED');
    });

    it('should allow acknowledging and resolving alerts with audit attribution', async () => {
      const { alert } = await raiseOrUpdateAlert({
        alertType: 'INGESTION_FAILURE',
        severity: 'HIGH',
        title: 'Ingestion Failure on node',
        description: 'Failed batch parser.',
        serverId: testServer.serverId,
        dedupKey: 'test:ingest_fail',
      });

      // Acknowledge by Analyst
      const acked = await acknowledgeAlert(alert.alertId, analystUser);
      assert.equal(acked.status, 'ACKNOWLEDGED');
      assert.equal(acked.acknowledgedByName, analystUser.name);

      // Resolve by Admin
      const resolved = await resolveAlert(
        alert.alertId,
        adminUser,
        'Parsed bad syslog encoding manually.'
      );
      assert.equal(resolved.status, 'RESOLVED');
      assert.equal(resolved.resolvedByName, adminUser.name);
      assert.equal(resolved.resolutionNotes, 'Parsed bad syslog encoding manually.');
    });
  });

  /* ================= 3. Monitoring Cycle Evaluation ================= */

  describe('3. Fleet Monitoring Evaluation Cycle', () => {
    it('should detect stale collectors and raise COLLECTOR_STALE during cycle', async () => {
      testServer.lastHeartbeatAt = new Date(Date.now() - 40000); // 40s ago (> 30s)
      await testServer.save();

      const res = await evaluateFleetMonitoring();
      assert.equal(res.evaluatedServersCount, 1);
      assert.ok(res.findings.some((f) => f.type === 'COLLECTOR_STALE'));

      const alert = await Alert.findOne({ serverId: testServer.serverId, alertType: 'COLLECTOR_STALE' });
      assert.ok(alert);
      assert.equal(alert.status, 'OPEN');
      assert.equal(alert.severity, 'MEDIUM');
    });

    it('should detect offline collectors and escalate to COLLECTOR_OFFLINE', async () => {
      testServer.lastHeartbeatAt = new Date(Date.now() - 70000); // 70s ago (> 60s)
      await testServer.save();

      const res = await evaluateFleetMonitoring();
      assert.ok(res.findings.some((f) => f.type === 'COLLECTOR_OFFLINE'));

      const alert = await Alert.findOne({ serverId: testServer.serverId, alertType: 'COLLECTOR_OFFLINE' });
      assert.ok(alert);
      assert.equal(alert.severity, 'HIGH');
    });

    it('should flag HASH_CHAIN_MISMATCH when server verification status is TAMPERED', async () => {
      testServer.lastVerificationStatus = 'TAMPERED';
      testServer.lastVerifiedAt = new Date();
      await testServer.save();

      const res = await evaluateFleetMonitoring();
      assert.ok(res.findings.some((f) => f.type === 'HASH_CHAIN_MISMATCH'));

      const alert = await Alert.findOne({ serverId: testServer.serverId, alertType: 'HASH_CHAIN_MISMATCH' });
      assert.ok(alert);
      assert.equal(alert.severity, 'CRITICAL');
    });

    it('should provide comprehensive overview aggregation', async () => {
      const overview = await getMonitoringOverview();
      assert.equal(overview.totalServers, 1);
      assert.ok(overview.collectorHealth);
      assert.ok(overview.alertsBySeverity);
      assert.equal(typeof overview.openAlertsCount, 'number');
    });

    it('should run background monitoring scheduler cycle idempotently', async () => {
      const res = await runMonitoringCycle();
      assert.ok(res);
      assert.equal(res.evaluatedServersCount, 1);
    });
  });

  /* ================= 4. Controlled Attack Simulator ================= */

  describe('4. Controlled Attack Simulator Scenarios & Safety Controls', () => {
    it('should allow simulations in test/dev environment', () => {
      assert.equal(isSimulationPermitted(), true);
    });

    it('should simulate payload tampering and detect HASH_MISMATCH via Phase 4 engine', async () => {
      const sim = await runControlledAttackScenario('modify_event_payload', adminUser);

      assert.equal(sim.detected, true);
      assert.match(sim.observedResult, /Tampering detected successfully/i);
      assert.ok(sim.findings.some((f) => f.type === 'HASH_MISMATCH'));
      assert.ok(sim.alert);
      assert.equal(sim.alert.alertType, 'HASH_CHAIN_MISMATCH');

      // Assert SimulationRun was recorded
      const runRecord = await SimulationRun.findById(sim.run._id);
      assert.ok(runRecord);
      assert.equal(runRecord.detected, true);
      assert.equal(runRecord.status, 'SUCCESS');
    });

    it('should simulate event deletion and detect SEQUENCE_GAP via Phase 4 engine', async () => {
      const sim = await runControlledAttackScenario('delete_event_record', adminUser);

      assert.equal(sim.detected, true);
      assert.match(sim.observedResult, /Record deletion trapped/i);
      assert.ok(sim.findings.some((f) => f.type === 'SEQUENCE_GAP' || f.type === 'BROKEN_CHAIN_LINK'));
      assert.ok(sim.alert);
      assert.equal(sim.alert.alertType, 'SEQUENCE_GAP');
    });

    it('should simulate chain link corruption and detect BROKEN_CHAIN_LINK', async () => {
      const sim = await runControlledAttackScenario('break_chain_link', adminUser);

      assert.equal(sim.detected, true);
      assert.match(sim.observedResult, /Broken previousHash link detected/i);
      assert.ok(sim.findings.some((f) => f.type === 'BROKEN_CHAIN_LINK'));
    });

    it('should simulate event hash spoofing and detect HASH_MISMATCH', async () => {
      const sim = await runControlledAttackScenario('alter_event_hash', adminUser);

      assert.equal(sim.detected, true);
      assert.match(sim.observedResult, /Forged eventHash detected/i);
    });

    it('should simulate stale collector daemon and raise COLLECTOR_STALE alert', async () => {
      const sim = await runControlledAttackScenario('simulate_stale_collector', adminUser);

      assert.equal(sim.detected, true);
      assert.match(sim.observedResult, /Stale collector daemon detected/i);
    });

    it('should simulate RPC outage as operational warning (BLOCKCHAIN_UNAVAILABLE, not tampering)', async () => {
      const sim = await runControlledAttackScenario('simulate_rpc_outage', adminUser);

      assert.equal(sim.detected, true);
      assert.match(sim.observedResult, /BLOCKCHAIN_UNAVAILABLE/i);
    });
  });

  /* ================= 5. REST APIs & Role Authorization ================= */

  describe('5. REST APIs & Role Authorization', () => {
    it('should expose GET /api/monitoring/overview to authenticated users', async () => {
      const res = await analystClient.get('/api/monitoring/overview');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.monitoring);
      assert.ok(res.data.scheduler);
    });

    it('should expose GET /api/monitoring/servers to authenticated users', async () => {
      const res = await analystClient.get('/api/monitoring/servers');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.servers));
      assert.equal(res.data.servers.length, 1);
    });

    it('should allow both Admin and Security Analyst to list alerts and inspect single alert', async () => {
      await raiseOrUpdateAlert({
        alertType: 'COLLECTOR_STALE',
        title: 'Test Alert For Listing',
        description: 'Test description',
        serverId: testServer.serverId,
        dedupKey: 'test:list_alerts',
      });

      const listRes = await analystClient.get('/api/alerts');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.data.success, true);
      assert.ok(listRes.data.alerts.length >= 1);

      const alertId = listRes.data.alerts[0].alertId;
      const singleRes = await analystClient.get(`/api/alerts/${alertId}`);
      assert.equal(singleRes.status, 200);
      assert.equal(singleRes.data.alert.alertId, alertId);
    });

    it('should allow Security Analyst to acknowledge and resolve an alert', async () => {
      const { alert } = await raiseOrUpdateAlert({
        alertType: 'INGESTION_FAILURE',
        title: 'Parser Failure',
        description: 'Invalid token in stream',
        serverId: testServer.serverId,
        dedupKey: 'test:analyst_ack',
      });

      // Analyst acknowledges
      const ackRes = await analystClient.post(`/api/alerts/${alert.alertId}/acknowledge`, {});
      assert.equal(ackRes.status, 200);
      assert.equal(ackRes.data.alert.status, 'ACKNOWLEDGED');

      // Analyst resolves
      const resRes = await analystClient.post(`/api/alerts/${alert.alertId}/resolve`, {
        resolutionNotes: 'Analyst verified log format and reset agent filter.',
      });
      assert.equal(resRes.status, 200);
      assert.equal(resRes.data.alert.status, 'RESOLVED');
      assert.equal(resRes.data.alert.resolutionNotes, 'Analyst verified log format and reset agent filter.');
    });

    it('should list available attack scenarios on GET /api/simulations', async () => {
      const res = await analystClient.get('/api/simulations');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.scenarios));
      assert.equal(res.data.scenarios.length, 7);
    });

    it('should allow Admin to execute a controlled attack scenario', async () => {
      const res = await adminClient.post('/api/simulations/modify_event_payload/run', {});

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.detected, true);
    });

    it('should DENY Security Analyst from executing attack simulations with HTTP 403', async () => {
      const res = await analystClient.post('/api/simulations/modify_event_payload/run', {});

      assert.equal(res.status, 403);
    });

    it('should reject unauthenticated requests with HTTP 401', async () => {
      const unauthClient = new TestClient(baseUrl);
      const res = await unauthClient.get('/api/monitoring/overview');

      assert.equal(res.status, 401);
    });
  });
});
