import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { EnrollmentToken } from '../src/models/EnrollmentToken.js';
import { TestClient } from './testClient.js';

describe('LogSentinel — Phase 2: Server Fleet Management & Secure Collector Enrollment Test Suite', () => {
  let mongoServer;
  let serverInstance;
  let adminClient;
  let viewerClient;
  let otherAdminClient;
  let baseUrl;

  let adminUser;
  let viewerUser;
  let otherAdminUser;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test_session_secret_with_more_than_32_characters_for_security_assurance!';

    // Spin up isolated in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    await mongoose.connect(mongoUri);

    // Bootstrap Express application
    const app = createApp();
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(0, resolve));

    const address = serverInstance.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    adminClient = new TestClient(baseUrl);
    viewerClient = new TestClient(baseUrl);
    otherAdminClient = new TestClient(baseUrl);
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
    // Clear all test collections
    await User.deleteMany({});
    await Server.deleteMany({});
    await EnrollmentToken.deleteMany({});

    adminClient.clearCookies();
    viewerClient.clearCookies();
    otherAdminClient.clearCookies();

    // Create 3 test users: Admin, Viewer, and a separate Admin (to test cross-user isolation)
    const passwordHash = await bcrypt.hash('TestSecurePass2026!', 10);

    adminUser = await User.create({
      name: 'Fleet Admin',
      email: 'admin@logsentinel.local',
      passwordHash,
      role: 'Admin',
    });

    viewerUser = await User.create({
      name: 'Auditor Viewer',
      email: 'viewer@logsentinel.local',
      passwordHash,
      role: 'Viewer',
    });

    otherAdminUser = await User.create({
      name: 'External Admin',
      email: 'otheradmin@company.local',
      passwordHash,
      role: 'Admin',
    });

    // Authenticate Admin
    await adminClient.fetchCsrf();
    await adminClient.post('/api/auth/login', {
      email: 'admin@logsentinel.local',
      password: 'TestSecurePass2026!',
    });

    // Authenticate Viewer
    await viewerClient.fetchCsrf();
    await viewerClient.post('/api/auth/login', {
      email: 'viewer@logsentinel.local',
      password: 'TestSecurePass2026!',
    });

    // Authenticate External Admin
    await otherAdminClient.fetchCsrf();
    await otherAdminClient.post('/api/auth/login', {
      email: 'otheradmin@company.local',
      password: 'TestSecurePass2026!',
    });
  });

  /* ================= 1. Server Registration & Validation ================= */

  it('1. should successfully register a server by an authenticated Admin', async () => {
    const res = await adminClient.post('/api/servers', {
      serverName: 'PAYMENT-GATEWAY-01',
      hostname: 'payment-01.company.local',
      os: 'Linux',
      environment: 'Production',
      description: 'Primary PCI DSS transaction processing node',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.server.serverName, 'PAYMENT-GATEWAY-01');
    assert.equal(res.data.server.hostname, 'payment-01.company.local');
    assert.equal(res.data.server.os, 'Linux');
    assert.equal(res.data.server.environment, 'Production');
    assert.equal(res.data.server.enrollmentStatus, 'PENDING_ENROLLMENT');
    assert.equal(res.data.server.connectionStatus, 'UNKNOWN');
    assert.ok(res.data.server.serverId.startsWith('srv_'));
    assert.equal(res.data.server.lastHeartbeatAt, null);

    // Verify record in database
    const dbRecord = await Server.findOne({ serverId: res.data.server.serverId });
    assert.ok(dbRecord);
    assert.equal(dbRecord.ownerId.toString(), adminUser._id.toString());
  });

  it('2. should reject unauthenticated server registration with HTTP 401', async () => {
    const unauthClient = new TestClient(baseUrl);
    const res = await unauthClient.post('/api/servers', {
      serverName: 'ROGUE-SERVER',
      hostname: 'rogue.local',
      os: 'Linux',
      environment: 'Production',
    });

    assert.equal(res.status, 401);
  });

  it('3. should reject registration with invalid or missing required fields', async () => {
    // Missing serverName
    const resMissingName = await adminClient.post('/api/servers', {
      hostname: 'valid-host.local',
      os: 'Linux',
      environment: 'Production',
    });
    assert.equal(resMissingName.status, 400);

    // Missing hostname
    const resMissingHost = await adminClient.post('/api/servers', {
      serverName: 'VALID-NAME',
      os: 'Linux',
      environment: 'Production',
    });
    assert.equal(resMissingHost.status, 400);

    // Invalid OS
    const resInvalidOS = await adminClient.post('/api/servers', {
      serverName: 'VALID-NAME',
      hostname: 'valid-host.local',
      os: 'FreeBSD',
      environment: 'Production',
    });
    assert.equal(resInvalidOS.status, 400);

    // Invalid Environment
    const resInvalidEnv = await adminClient.post('/api/servers', {
      serverName: 'VALID-NAME',
      hostname: 'valid-host.local',
      os: 'Linux',
      environment: 'TestingLab',
    });
    assert.equal(resInvalidEnv.status, 400);
  });

  it('4. should reject public attempts to supply ownerId or privileged status fields', async () => {
    const fakeOwnerId = new mongoose.Types.ObjectId().toString();

    const res = await adminClient.post('/api/servers', {
      serverName: 'PRIVILEGE-ESCALATION-ATTEMPT',
      hostname: 'escalate.local',
      os: 'Linux',
      environment: 'Production',
      ownerId: fakeOwnerId,
      enrollmentStatus: 'ENROLLED',
      connectionStatus: 'ONLINE',
      credentialHash: 'faked_credential_hash_injection',
      lastHeartbeatAt: new Date(),
    });

    assert.equal(res.status, 201);
    // Privilege fields must be ignored and set authoritative defaults
    assert.equal(res.data.server.enrollmentStatus, 'PENDING_ENROLLMENT');
    assert.equal(res.data.server.connectionStatus, 'UNKNOWN');
    assert.equal(res.data.server.lastHeartbeatAt, null);

    // In DB, ownerId must be the authenticated adminUser, NOT the fakeOwnerId
    const dbRecord = await Server.findOne({ serverId: res.data.server.serverId }).select('+credentialHash');
    assert.equal(dbRecord.ownerId.toString(), adminUser._id.toString());
    assert.notEqual(dbRecord.ownerId.toString(), fakeOwnerId);
    assert.equal(dbRecord.credentialHash, null);
  });

  /* ================= 2. Scoping & Authorization ================= */

  it('5. should scope server listing strictly to the current authenticated user', async () => {
    // Admin creates 2 servers
    await adminClient.post('/api/servers', {
      serverName: 'ADMIN-SRV-01',
      hostname: 'admin-01.local',
      os: 'Linux',
      environment: 'Production',
    });
    await adminClient.post('/api/servers', {
      serverName: 'ADMIN-SRV-02',
      hostname: 'admin-02.local',
      os: 'Windows',
      environment: 'Staging',
    });

    // Other Admin creates 1 server
    await otherAdminClient.post('/api/servers', {
      serverName: 'OTHER-SRV-01',
      hostname: 'other-01.local',
      os: 'Linux',
      environment: 'Development',
    });

    // Admin should see exactly 2 servers
    const adminList = await adminClient.get('/api/servers');
    assert.equal(adminList.status, 200);
    assert.equal(adminList.data.servers.length, 2);
    assert.equal(adminList.data.pagination.total, 2);

    // Other Admin should see exactly 1 server
    const otherList = await otherAdminClient.get('/api/servers');
    assert.equal(otherList.status, 200);
    assert.equal(otherList.data.servers.length, 1);
    assert.equal(otherList.data.servers[0].serverName, 'OTHER-SRV-01');
  });

  it('6. should deny cross-user server retrieval with HTTP 404', async () => {
    // Admin creates a server
    const createRes = await adminClient.post('/api/servers', {
      serverName: 'ADMIN-SECRET-NODE',
      hostname: 'secret.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = createRes.data.server.serverId;

    // Other Admin tries to GET the server by serverId
    const res = await otherAdminClient.get(`/api/servers/${serverId}`);
    assert.equal(res.status, 404);
  });

  it('7. should prevent non-Admin (Viewer) from performing administrative mutations', async () => {
    // Viewer cannot create a server
    const createRes = await viewerClient.post('/api/servers', {
      serverName: 'VIEWER-UNAUTHORIZED-SRV',
      hostname: 'unauth.local',
      os: 'Linux',
      environment: 'Production',
    });
    assert.equal(createRes.status, 403);

    // Admin creates a server for viewing
    const srv = await adminClient.post('/api/servers', {
      serverName: 'FLEET-NODE-A',
      hostname: 'node-a.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srv.data.server.serverId;

    // Viewer cannot generate enrollment token
    const tokenRes = await viewerClient.post(`/api/servers/${serverId}/enrollment-token`);
    assert.equal(tokenRes.status, 403);

    // Viewer cannot disable server
    const disableRes = await viewerClient.post(`/api/servers/${serverId}/disable`);
    assert.equal(disableRes.status, 403);

    // Viewer cannot rotate credentials
    const rotateRes = await viewerClient.post(`/api/servers/${serverId}/rotate-credential`);
    assert.equal(rotateRes.status, 403);
  });

  it('8. should update permitted metadata while rejecting protected fields in PATCH', async () => {
    const createRes = await adminClient.post('/api/servers', {
      serverName: 'ORIGINAL-NAME',
      hostname: 'original.local',
      os: 'Linux',
      environment: 'Development',
      description: 'Original description',
    });
    const serverId = createRes.data.server.serverId;

    const fakeOwnerId = new mongoose.Types.ObjectId().toString();

    // PATCH allowed metadata and try to modify protected fields
    const patchRes = await adminClient.patch(`/api/servers/${serverId}`, {
      serverName: 'UPDATED-NAME',
      description: 'Updated description',
      ownerId: fakeOwnerId,
      enrollmentStatus: 'ENROLLED',
      credentialHash: 'malicious_hash',
      serverId: 'srv_tampered_id',
    });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.server.serverName, 'UPDATED-NAME');
    assert.equal(patchRes.data.server.description, 'Updated description');
    assert.equal(patchRes.data.server.serverId, serverId);
    assert.equal(patchRes.data.server.enrollmentStatus, 'PENDING_ENROLLMENT');

    // Confirm in DB
    const dbRecord = await Server.findOne({ serverId }).select('+credentialHash');
    assert.equal(dbRecord.ownerId.toString(), adminUser._id.toString());
    assert.equal(dbRecord.credentialHash, null);
  });

  /* ================= 3. Secure Collector Enrollment Lifecycle ================= */

  it('9. should generate a single-use enrollment token and store only its SHA-256 hash', async () => {
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'ENROLL-TEST-SRV',
      hostname: 'enroll-test.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    const tokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    assert.equal(tokenRes.status, 201);
    assert.ok(tokenRes.data.enrollmentToken.startsWith('ent_'));
    assert.equal(tokenRes.data.serverId, serverId);
    assert.equal(tokenRes.data.expiresInSeconds, 900);

    const rawToken = tokenRes.data.enrollmentToken;

    // Verify raw token is NOT stored anywhere in the database!
    const rawMatch = await EnrollmentToken.findOne({ tokenHash: rawToken });
    assert.equal(rawMatch, null);

    // Verify the hashed version exists
    const hashed = EnrollmentToken.hashToken(rawToken);
    const dbToken = await EnrollmentToken.findOne({ tokenHash: hashed });
    assert.ok(dbToken);
    assert.equal(dbToken.serverId, serverId);
    assert.equal(dbToken.isConsumed, false);
  });

  it('10. should exchange valid enrollment token for server-specific collector credential atomically', async () => {
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'COLLECTOR-DAEMON-SRV',
      hostname: 'collector-host.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    const tokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    const rawToken = tokenRes.data.enrollmentToken;

    // Collector daemon calls machine exchange endpoint POST /api/collector/enroll
    const unauthCollectorClient = new TestClient(baseUrl); // No browser cookies needed
    const enrollRes = await unauthCollectorClient.post('/api/collector/enroll', {
      token: rawToken,
      serverId,
    });

    assert.equal(enrollRes.status, 200);
    assert.equal(enrollRes.data.success, true);
    assert.ok(enrollRes.data.credential.startsWith('col_sec_'));
    assert.equal(enrollRes.data.serverId, serverId);
    assert.equal(enrollRes.data.credentialVersion, 2);

    const rawCredential = enrollRes.data.credential;

    // Verify raw collector credential is NOT stored in the database!
    const rawCredMatch = await Server.findOne({ credentialHash: rawCredential });
    assert.equal(rawCredMatch, null);

    // Verify server status transitioned to ENROLLED, connectionStatus is UNKNOWN (not fake online)
    const dbServer = await Server.findOne({ serverId }).select('+credentialHash');
    assert.equal(dbServer.enrollmentStatus, 'ENROLLED');
    assert.equal(dbServer.connectionStatus, 'UNKNOWN');
    assert.ok(dbServer.credentialHash);
    assert.notEqual(dbServer.credentialHash, rawCredential);

    // Verify token was atomically marked consumed
    const tokenHash = EnrollmentToken.hashToken(rawToken);
    const dbToken = await EnrollmentToken.findOne({ tokenHash });
    assert.equal(dbToken.isConsumed, true);
    assert.ok(dbToken.consumedAt);
  });

  it('11. should reject re-use of an already consumed enrollment token (single-use guarantee)', async () => {
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'REPLAY-ATTACK-SRV',
      hostname: 'replay-test.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    const tokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    const rawToken = tokenRes.data.enrollmentToken;

    const collectorClient = new TestClient(baseUrl);

    // First exchange succeeds
    const firstEnroll = await collectorClient.post('/api/collector/enroll', {
      token: rawToken,
      serverId,
    });
    assert.equal(firstEnroll.status, 200);

    // Replay attempt with same token must fail
    const replayEnroll = await collectorClient.post('/api/collector/enroll', {
      token: rawToken,
      serverId,
    });
    assert.equal(replayEnroll.status, 400);
    assert.equal(replayEnroll.data.error, 'TokenAlreadyConsumed');
  });

  it('12. should reject expired enrollment tokens', async () => {
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'EXPIRY-TEST-SRV',
      hostname: 'expiry-test.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    const tokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    const rawToken = tokenRes.data.enrollmentToken;

    // Manually backdate token expiration in database to simulate expiry
    const tokenHash = EnrollmentToken.hashToken(rawToken);
    await EnrollmentToken.updateOne(
      { tokenHash },
      { $set: { expiresAt: new Date(Date.now() - 60 * 1000) } } // Expired 1 min ago
    );

    const collectorClient = new TestClient(baseUrl);
    const enrollRes = await collectorClient.post('/api/collector/enroll', {
      token: rawToken,
      serverId,
    });

    assert.equal(enrollRes.status, 400);
    assert.equal(enrollRes.data.error, 'TokenExpired');
  });

  it('13. should prevent disabled servers from enrolling or generating tokens', async () => {
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'DECOMMISSION-SRV',
      hostname: 'decommission.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    // Generate token before disable
    const tokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    const rawToken = tokenRes.data.enrollmentToken;

    // Disable the server
    const disableRes = await adminClient.post(`/api/servers/${serverId}/disable`);
    assert.equal(disableRes.status, 200);
    assert.equal(disableRes.data.server.enrollmentStatus, 'DISABLED');
    assert.equal(disableRes.data.server.connectionStatus, 'OFFLINE');

    // Attempting to generate a new token for disabled server must fail
    const newTokenRes = await adminClient.post(`/api/servers/${serverId}/enrollment-token`);
    assert.equal(newTokenRes.status, 400);

    // Attempting to enroll with pre-existing token must fail
    const collectorClient = new TestClient(baseUrl);
    const enrollRes = await collectorClient.post('/api/collector/enroll', {
      token: rawToken,
      serverId,
    });
    assert.equal(enrollRes.status, 400); // Token was invalidated during disable
  });

  it('14. should rotate credentials, revoking previous secret and issuing a fresh enrollment token', async () => {
    const srvRes = await adminClient.post('/api/servers', {
      serverName: 'ROTATION-SRV',
      hostname: 'rotation-test.local',
      os: 'Linux',
      environment: 'Production',
    });
    const serverId = srvRes.data.server.serverId;

    // Initial enrollment
    const token1 = (await adminClient.post(`/api/servers/${serverId}/enrollment-token`)).data.enrollmentToken;
    const collectorClient = new TestClient(baseUrl);
    await collectorClient.post('/api/collector/enroll', { token: token1, serverId });

    // Rotate credential
    const rotateRes = await adminClient.post(`/api/servers/${serverId}/rotate-credential`);
    assert.equal(rotateRes.status, 200);
    assert.ok(rotateRes.data.enrollmentToken);
    assert.equal(rotateRes.data.server.enrollmentStatus, 'PENDING_ENROLLMENT');

    // DB server must have revoked credentialHash
    const dbServer = await Server.findOne({ serverId }).select('+credentialHash');
    assert.equal(dbServer.credentialHash, null);
    assert.equal(dbServer.enrollmentStatus, 'PENDING_ENROLLMENT');

    // New enrollment using the rotated token succeeds
    const newEnrollRes = await collectorClient.post('/api/collector/enroll', {
      token: rotateRes.data.enrollmentToken,
      serverId,
    });
    assert.equal(newEnrollRes.status, 200);
    assert.ok(newEnrollRes.data.credential);
  });
});
