import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { TestClient } from './testClient.js';

describe('LogSentinel — Phase 1: Authentication & Authorization Test Suite', () => {
  let mongoServer;
  let server;
  let client;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test_session_secret_with_more_than_32_characters_for_security_assurance!';

    // Spin up real in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    await mongoose.connect(mongoUri);

    // Bootstrap Express server
    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    client = new TestClient(baseUrl);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
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
    client.clearCookies();
  });

  /* ================= 1. Password Hashing Security ================= */
  describe('Password Hashing & User Model Security', () => {
    it('should hash passwords using bcrypt and never store plaintext', async () => {
      const plainPassword = 'SuperSecretPassword123!';
      const hash = await bcrypt.hash(plainPassword, 12);

      const user = await User.create({
        name: 'Cryptographic User',
        email: 'crypto@logsentinel.local',
        passwordHash: hash,
        role: 'Viewer',
      });

      // Verify DB record contains hash and NOT plaintext
      const dbRecord = await User.findById(user._id).lean();
      assert.notEqual(dbRecord.passwordHash, plainPassword);
      assert.ok(dbRecord.passwordHash.startsWith('$2')); // bcrypt identifier
      assert.equal(dbRecord.password, undefined);

      // Verify comparePassword method
      const isMatch = await user.comparePassword(plainPassword);
      assert.equal(isMatch, true);

      const isWrongMatch = await user.comparePassword('WrongPassword');
      assert.equal(isWrongMatch, false);

      // Verify toSafeObject excludes passwordHash and internal fields
      const safeObj = user.toSafeObject();
      assert.equal(safeObj.passwordHash, undefined);
      assert.equal(safeObj.__v, undefined);
      assert.equal(safeObj.email, 'crypto@logsentinel.local');
    });
  });

  /* ================= 2. CSRF Protection ================= */
  describe('CSRF Token Security & Enforcement', () => {
    it('should return a 64-char hex CSRF token from /api/auth/csrf-token and set XSRF-TOKEN cookie', async () => {
      const res = await client.get('/api/auth/csrf-token');
      assert.equal(res.status, 200);
      assert.ok(res.data?.csrfToken);
      assert.equal(res.data.csrfToken.length, 64);
      assert.ok(client.cookies.has('XSRF-TOKEN'));
    });

    it('should reject state-changing requests without CSRF token with HTTP 403 Forbidden', async () => {
      // First obtain session without CSRF header on POST
      await client.fetchCsrf();
      const rawRes = await client.request('POST', '/api/auth/signup', {
        name: 'No CSRF Test',
        email: 'nocsrf@test.local',
        password: 'Password123!',
      }, {
        'X-CSRF-Token': '', // Intentionally omitted
      });

      assert.equal(rawRes.status, 403);
      assert.equal(rawRes.data?.error, 'Forbidden');
    });

    it('should reject state-changing requests with invalid CSRF token with HTTP 403 Forbidden', async () => {
      await client.fetchCsrf();
      const rawRes = await client.request('POST', '/api/auth/signup', {
        name: 'Invalid CSRF Test',
        email: 'badcsrf@test.local',
        password: 'Password123!',
      }, {
        'X-CSRF-Token': 'invalid_forged_csrf_token_0123456789abcdef',
      });

      assert.equal(rawRes.status, 403);
      assert.equal(rawRes.data?.error, 'Forbidden');
    });
  });

  /* ================= 3. Signup & Role Escalation ================= */
  describe('Registration (POST /api/auth/signup)', () => {
    it('should successfully register a user, set session cookie, and return HTTP 201', async () => {
      await client.fetchCsrf();

      const res = await client.post('/api/auth/signup', {
        name: 'Alice Security',
        email: 'alice@logsentinel.local',
        password: 'ValidPassword123!',
      });

      assert.equal(res.status, 201);
      assert.equal(res.data?.user?.name, 'Alice Security');
      assert.equal(res.data?.user?.email, 'alice@logsentinel.local');
      assert.equal(res.data?.user?.role, 'Viewer');
      assert.equal(res.data?.user?.passwordHash, undefined);
      assert.ok(client.cookies.has('logsentinel.sid'));
    });

    it('should prevent role escalation: public signup must never create an Admin', async () => {
      await client.fetchCsrf();

      const res = await client.post('/api/auth/signup', {
        name: 'Mallory Hacker',
        email: 'mallory@attack.corp',
        password: 'ExploitPassword123!',
        role: 'Admin', // Malicious privilege escalation payload
      });

      assert.equal(res.status, 201);
      assert.equal(res.data?.user?.role, 'Viewer'); // Enforced as Viewer

      // Double-check database record
      const dbUser = await User.findOne({ email: 'mallory@attack.corp' });
      assert.equal(dbUser.role, 'Viewer');
      assert.notEqual(dbUser.role, 'Admin');
    });

    it('should reject duplicate email registrations with HTTP 409 Conflict', async () => {
      await client.fetchCsrf();

      // First signup
      await client.post('/api/auth/signup', {
        name: 'First User',
        email: 'duplicate@test.local',
        password: 'Password123!',
      });

      // Duplicate signup with same email (and different casing to test normalization)
      client.clearCookies();
      await client.fetchCsrf();

      const dupRes = await client.post('/api/auth/signup', {
        name: 'Second User',
        email: 'DUPLICATE@TEST.LOCAL',
        password: 'Password123!',
      });

      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.data?.error, 'Conflict');
    });

    it('should reject invalid input with HTTP 400 Bad Request', async () => {
      await client.fetchCsrf();

      // Missing/short name
      const res1 = await client.post('/api/auth/signup', {
        name: 'A',
        email: 'valid@email.com',
        password: 'Password123!',
      });
      assert.equal(res1.status, 400);

      // Invalid email
      const res2 = await client.post('/api/auth/signup', {
        name: 'Valid Name',
        email: 'not-an-email',
        password: 'Password123!',
      });
      assert.equal(res2.status, 400);

      // Short password (< 8 chars)
      const res3 = await client.post('/api/auth/signup', {
        name: 'Valid Name',
        email: 'valid@email.com',
        password: 'short',
      });
      assert.equal(res3.status, 400);
    });
  });

  /* ================= 4. Login & Authentication ================= */
  describe('Login (POST /api/auth/login)', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 12);
      await User.create({
        name: 'Test Analyst',
        email: 'analyst@logsentinel.local',
        passwordHash,
        role: 'Analyst',
      });
    });

    it('should authenticate valid credentials, regenerate session, and return HTTP 200', async () => {
      await client.fetchCsrf();

      const res = await client.post('/api/auth/login', {
        email: 'analyst@logsentinel.local',
        password: 'CorrectPassword123!',
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.user?.email, 'analyst@logsentinel.local');
      assert.equal(res.data?.user?.role, 'Analyst');
      assert.ok(client.cookies.has('logsentinel.sid'));
    });

    it('should reject invalid password with HTTP 401 Unauthorized without leaking info', async () => {
      await client.fetchCsrf();

      const res = await client.post('/api/auth/login', {
        email: 'analyst@logsentinel.local',
        password: 'IncorrectPassword!',
      });

      assert.equal(res.status, 401);
      assert.equal(res.data?.error, 'Unauthorized');
      assert.equal(res.data?.message, 'Invalid email or password.');
    });

    it('should reject non-existent email with HTTP 401 Unauthorized with same generic message', async () => {
      await client.fetchCsrf();

      const res = await client.post('/api/auth/login', {
        email: 'doesnotexist@nowhere.com',
        password: 'SomePassword123!',
      });

      assert.equal(res.status, 401);
      assert.equal(res.data?.error, 'Unauthorized');
      assert.equal(res.data?.message, 'Invalid email or password.');
    });
  });

  /* ================= 5. Session Management & /me ================= */
  describe('Session Lifecycle & /me Endpoint', () => {
    it('should reject GET /api/auth/me without active session with HTTP 401', async () => {
      const res = await client.get('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.data?.error, 'Unauthorized');
    });

    it('should return authenticated user profile on GET /api/auth/me when session is active', async () => {
      await client.fetchCsrf();

      // Register and establish session
      await client.post('/api/auth/signup', {
        name: 'Bob Operator',
        email: 'bob@logsentinel.local',
        password: 'Password123!',
      });

      // Subsequent query using established session
      const res = await client.get('/api/auth/me');
      assert.equal(res.status, 200);
      assert.equal(res.data?.user?.email, 'bob@logsentinel.local');
      assert.equal(res.data?.user?.name, 'Bob Operator');
      assert.equal(res.data?.user?.role, 'Viewer');
    });

    it('should invalidate session and clear cookies on POST /api/auth/logout', async () => {
      await client.fetchCsrf();

      await client.post('/api/auth/signup', {
        name: 'Logout Tester',
        email: 'logout@logsentinel.local',
        password: 'Password123!',
      });

      // Confirm logged in
      const meBefore = await client.get('/api/auth/me');
      assert.equal(meBefore.status, 200);

      // Perform logout
      const logoutRes = await client.post('/api/auth/logout');
      assert.equal(logoutRes.status, 200);

      // Confirm unauthenticated
      const meAfter = await client.get('/api/auth/me');
      assert.equal(meAfter.status, 401);
    });
  });

  /* ================= 6. Role-Based Access Control (RBAC) ================= */
  describe('Role-Based Access Control Middleware Enforcement', () => {
    let viewerClient;
    let analystClient;
    let adminClient;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('Password123!', 12);

      await User.create([
        { name: 'Viewer User', email: 'viewer@log.sec', passwordHash, role: 'Viewer' },
        { name: 'Analyst User', email: 'analyst@log.sec', passwordHash, role: 'Analyst' },
        { name: 'Admin User', email: 'admin@log.sec', passwordHash, role: 'Admin' },
      ]);

      viewerClient = new TestClient(baseUrl);
      await viewerClient.fetchCsrf();
      await viewerClient.post('/api/auth/login', { email: 'viewer@log.sec', password: 'Password123!' });

      analystClient = new TestClient(baseUrl);
      await analystClient.fetchCsrf();
      await analystClient.post('/api/auth/login', { email: 'analyst@log.sec', password: 'Password123!' });

      adminClient = new TestClient(baseUrl);
      await adminClient.fetchCsrf();
      await adminClient.post('/api/auth/login', { email: 'admin@log.sec', password: 'Password123!' });
    });

    it('should reject unauthenticated access to protected endpoints with HTTP 401', async () => {
      const unauthClient = new TestClient(baseUrl);
      const res = await unauthClient.get('/api/auth/test/protected');
      assert.equal(res.status, 401);
    });

    it('should allow all authenticated roles to access generic protected endpoint', async () => {
      const vRes = await viewerClient.get('/api/auth/test/protected');
      assert.equal(vRes.status, 200);

      const aRes = await analystClient.get('/api/auth/test/protected');
      assert.equal(aRes.status, 200);

      const admRes = await adminClient.get('/api/auth/test/protected');
      assert.equal(admRes.status, 200);
    });

    it('should enforce Analyst & Admin only access on /api/auth/test/analyst-only', async () => {
      // Viewer is denied (HTTP 403 Forbidden)
      const vRes = await viewerClient.get('/api/auth/test/analyst-only');
      assert.equal(vRes.status, 403);
      assert.equal(vRes.data?.error, 'Forbidden');

      // Analyst is allowed (HTTP 200 OK)
      const aRes = await analystClient.get('/api/auth/test/analyst-only');
      assert.equal(aRes.status, 200);

      // Admin is allowed (HTTP 200 OK)
      const admRes = await adminClient.get('/api/auth/test/analyst-only');
      assert.equal(admRes.status, 200);
    });

    it('should enforce Admin-only access on /api/auth/test/admin-only', async () => {
      // Viewer is denied (HTTP 403 Forbidden)
      const vRes = await viewerClient.get('/api/auth/test/admin-only');
      assert.equal(vRes.status, 403);
      assert.equal(vRes.data?.error, 'Forbidden');

      // Analyst is denied (HTTP 403 Forbidden)
      const aRes = await analystClient.get('/api/auth/test/admin-only');
      assert.equal(aRes.status, 403);
      assert.equal(aRes.data?.error, 'Forbidden');

      // Admin is allowed (HTTP 200 OK)
      const admRes = await adminClient.get('/api/auth/test/admin-only');
      assert.equal(admRes.status, 200);
    });
  });

  /* ================= 7. Preserved Phase 0 Health Checks ================= */
  describe('Preserved Phase 0 Compatibility', () => {
    it('GET /api/health returns HTTP 200 with name and healthy status', async () => {
      const res = await client.get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.data?.name, 'HashVault');
      assert.ok(['ok', 'healthy'].includes(res.data?.status));
      assert.ok(res.data?.timestamp);
    });

    it('GET /api/health/db accurately reports connected database status', async () => {
      const res = await client.get('/api/health/db');
      assert.equal(res.status, 200);
      assert.equal(res.data?.database, 'connected');
      assert.equal(res.data?.connected, true);
      assert.equal(res.data?.readyState, 1);
    });
  });
});
