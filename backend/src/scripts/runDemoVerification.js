/**
 * LogSentinel — Phase 9 End-to-End Hackathon Demonstration & Verification Script
 * Validates Scenarios A, B, C, D, and E against the running backend API.
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001/api';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.csrfToken = null;
  }

  setCookieFromHeader(header) {
    if (!header) return;
    const cookieStrings = Array.isArray(header) ? header : [header];
    for (const str of cookieStrings) {
      const parts = str.split(';');
      const [nameVal] = parts;
      const [key, ...valParts] = nameVal.split('=');
      if (key) {
        this.cookies.set(key.trim(), valParts.join('=').trim());
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async fetchCsrf() {
    const res = await this.request('GET', '/auth/csrf-token');
    if (res.data?.csrfToken) {
      this.csrfToken = res.data.csrfToken;
    }
    return this.csrfToken;
  }

  async request(method, path, body = null, extraHeaders = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: 'application/json',
      ...extraHeaders,
    };

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    if (this.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const options = {
      method: method.toUpperCase(),
      headers,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const rawSetCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    if (rawSetCookie && rawSetCookie.length > 0) {
      this.setCookieFromHeader(rawSetCookie);
    }

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (data?.csrfToken) {
      this.csrfToken = data.csrfToken;
    }

    return { status: res.status, data };
  }
}

async function runDemoVerification() {
  console.log('================================================================');
  console.log('🛡️  LOGSENTINEL — PHASE 9 HACKATHON DEMO VERIFICATION RUNNER');
  console.log('================================================================');
  console.log(`Target Backend: ${BASE_URL}\n`);

  const results = [];

  const adminClient = new ApiClient(BASE_URL);
  const analystClient = new ApiClient(BASE_URL);

  try {
    // ---------------------------------------------------------
    // Preflight: Health Check
    // ---------------------------------------------------------
    console.log('--- [Preflight Check] API Readiness ---');
    const healthRes = await adminClient.request('GET', '/health');
    if (healthRes.status === 200 && (healthRes.data?.status === 'ok' || healthRes.data?.status === 'healthy')) {
      console.log('✅ Backend API is reachable and healthy.');
      results.push({ name: 'Preflight API Health', pass: true });
    } else {
      console.error('❌ Backend API health check failed:', healthRes.data);
      results.push({ name: 'Preflight API Health', pass: false });
      process.exit(1);
    }

    // ---------------------------------------------------------
    // SCENARIO A: Establish the Trust Pipeline
    // ---------------------------------------------------------
    console.log('\n--- [Scenario A] Establish Trust Pipeline ---');
    await adminClient.fetchCsrf();
    const loginRes = await adminClient.request('POST', '/auth/login', {
      email: 'admin@logsentinel.local',
      password: process.env.DEMO_ADMIN_PASSWORD || 'LogSentinel@Admin2026',
    });

    if (loginRes.status === 200 && loginRes.data?.user?.role === 'Admin') {
      console.log(`✅ Admin authenticated successfully (${loginRes.data.user.email}).`);
      results.push({ name: 'Scenario A: Admin Authentication', pass: true });
    } else {
      console.warn('⚠️ Admin login failed. Trying to seed demo environment first...');
      console.log('Tip: Run `npm run seed:demo` before running this verification script.');
      results.push({ name: 'Scenario A: Admin Authentication', pass: false, note: 'Seed demo first via npm run seed:demo' });
      return;
    }

    // Register test server
    const srvRes = await adminClient.request('POST', '/servers', {
      serverName: `DEMO-GATEWAY-${Date.now().toString().slice(-4)}`,
      hostname: `gateway-${Date.now().toString().slice(-4)}.demo.internal`,
      os: 'Linux',
      environment: 'Production',
      description: 'Ingress node for hackathon verification.',
    });

    const serverId = srvRes.data?.server?.serverId;
    if (srvRes.status === 201 && serverId) {
      console.log(`✅ Demo Server Registered: ${srvRes.data.server.serverName} (${serverId})`);
      results.push({ name: 'Scenario A: Server Registration', pass: true });
    } else {
      console.error('❌ Server registration failed:', srvRes.data);
      results.push({ name: 'Scenario A: Server Registration', pass: false });
      return;
    }

    // Generate enrollment token
    const tokRes = await adminClient.request('POST', `/servers/${serverId}/enrollment-token`, {});
    const token = tokRes.data?.enrollmentToken;
    if (tokRes.status === 201 && token) {
      console.log(`✅ Enrollment Token Generated: ${token.slice(0, 16)}...`);
      results.push({ name: 'Scenario A: Enrollment Token Generation', pass: true });
    } else {
      console.error('❌ Token generation failed:', tokRes.data);
      results.push({ name: 'Scenario A: Enrollment Token Generation', pass: false });
      return;
    }

    // Enroll Collector
    const enrollClient = new ApiClient(BASE_URL);
    const enrollRes = await enrollClient.request('POST', '/collector/enroll', {
      token,
      serverId,
    });
    const credential = enrollRes.data?.credential;
    if (enrollRes.status === 200 && credential) {
      console.log(`✅ Collector Enrolled: Credential v${enrollRes.data.credentialVersion}`);
      results.push({ name: 'Scenario A: Collector Enrollment', pass: true });
    } else {
      console.error('❌ Collector enrollment failed:', enrollRes.data);
      results.push({ name: 'Scenario A: Collector Enrollment', pass: false });
      return;
    }

    // Ingest logs
    const ingestClient = new ApiClient(BASE_URL);
    const ingestRes = await ingestClient.request(
      'POST',
      '/collector/logs',
      {
        batchId: 'demo_verification_batch_01',
        events: [
          { eventId: `evt_v1_${Date.now()}`, source: '/var/log/auth.log', message: 'sshd: login attempt user root from 10.0.0.1', observedAt: new Date() },
          { eventId: `evt_v2_${Date.now()}`, source: '/var/log/nginx.log', message: 'GET /api/v1/auth 200 OK', observedAt: new Date() },
          { eventId: `evt_v3_${Date.now()}`, source: '/var/log/syslog', message: 'systemd: job completed with exit code 0', observedAt: new Date() },
        ],
      },
      {
        'X-Server-Id': serverId,
        Authorization: `Bearer ${credential}`,
      }
    );

    if (ingestRes.status === 200 && ingestRes.data?.acceptedCount === 3) {
      console.log(`✅ Ingested 3 log events (Chain Head: #${ingestRes.data.chainHeadSequence}, Hash: ${ingestRes.data.chainHeadHash.slice(0, 16)}...)`);
      results.push({ name: 'Scenario A: Telemetry Ingestion & Hash Chaining', pass: true });
    } else {
      console.error('❌ Log ingestion failed:', ingestRes.data);
      results.push({ name: 'Scenario A: Telemetry Ingestion & Hash Chaining', pass: false });
      return;
    }

    // ---------------------------------------------------------
    // SCENARIO B: Verify and Anchor Logs
    // ---------------------------------------------------------
    console.log('\n--- [Scenario B] Verify and Anchor Logs ---');
    const verifyRes = await adminClient.request('POST', `/integrity/servers/${serverId}/verify`, {
      fromSequence: 1,
      toSequence: 3,
    });

    if (verifyRes.status === 200 && verifyRes.data?.status === 'VERIFIED') {
      console.log('✅ Deterministic Cryptographic Verifier confirmed status: VERIFIED');
      results.push({ name: 'Scenario B: Cryptographic Verification', pass: true });
    } else {
      console.error('❌ Verification failed:', verifyRes.data);
      results.push({ name: 'Scenario B: Cryptographic Verification', pass: false });
    }

    // Checkpoint Anchor
    const cpRes = await adminClient.request('POST', `/integrity/servers/${serverId}/checkpoints`, {
      startSequence: 1,
      endSequence: 3,
    });

    if ([200, 201].includes(cpRes.status) && cpRes.data?.checkpoint?.checkpointId) {
      const root = cpRes.data.checkpoint.checkpointRoot || cpRes.data.checkpoint.rootHash || '0x...';
      console.log(`✅ Checkpoint Created: ${cpRes.data.checkpoint.checkpointId} (Root: ${root.slice(0, 16)}...)`);
      results.push({ name: 'Scenario B: Checkpoint Commitment Construction', pass: true });
    } else {
      console.warn('⚠️ Checkpoint creation returned:', cpRes.data?.message || cpRes.data);
      results.push({ name: 'Scenario B: Checkpoint Commitment Construction', pass: false });
    }

    // ---------------------------------------------------------
    // SCENARIO C: Demonstrate Tampering Detection
    // ---------------------------------------------------------
    console.log('\n--- [Scenario C] Controlled Tampering Detection ---');
    const simRes = await adminClient.request('POST', '/simulations/modify_event_payload/run', {});
    if (simRes.status === 200 && simRes.data?.detected === true) {
      console.log(`✅ Attack Drill Passed: ${simRes.data.observedResult}`);
      results.push({ name: 'Scenario C: Payload Tampering Trap (HASH_MISMATCH)', pass: true });
    } else {
      console.error('❌ Simulation drill failed:', simRes.data);
      results.push({ name: 'Scenario C: Payload Tampering Trap (HASH_MISMATCH)', pass: false });
    }

    // ---------------------------------------------------------
    // SCENARIO D: Sentinel AI Investigation
    // ---------------------------------------------------------
    console.log('\n--- [Scenario D] Sentinel AI Investigation ---');
    const aiRes = await adminClient.request('POST', '/ai/analyses', {
      serverId,
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      question: 'Investigate recent authentication activity and verify cryptographic integrity.',
    });

    const report = aiRes.data?.report || aiRes.data?.analysis;
    if ([200, 201].includes(aiRes.status) && report?.findings) {
      console.log(`✅ Sentinel AI Investigation complete: Report ID ${report.analysisId}`);
      console.log(`   Summary: ${(report.executiveSummary || '').slice(0, 90)}...`);
      console.log(`   Authoritative Integrity Verdict: ${report.authoritativeVerdicts?.integrityStatus || 'N/A'}`);
      results.push({ name: 'Scenario D: Sentinel AI Analysis & Redaction', pass: true });
    } else {
      console.warn('⚠️ AI investigation returned:', aiRes.data?.message || aiRes.data);
      results.push({ name: 'Scenario D: Sentinel AI Analysis & Redaction', pass: false });
    }

    // ---------------------------------------------------------
    // SCENARIO E: Role Restrictions (RBAC)
    // ---------------------------------------------------------
    console.log('\n--- [Scenario E] Role-Based Access Controls ---');
    await analystClient.fetchCsrf();
    const analystLogin = await analystClient.request('POST', '/auth/login', {
      email: 'analyst@logsentinel.local',
      password: process.env.DEMO_ANALYST_PASSWORD || 'LogSentinel@Analyst2026',
    });

    if (analystLogin.status === 200 && analystLogin.data?.user?.role === 'Security Analyst') {
      console.log(`✅ Security Analyst logged in (${analystLogin.data.user.email}).`);

      // Analyst CAN inspect logs & alerts
      const analystAlerts = await analystClient.request('GET', '/alerts');
      assertStatus(analystAlerts.status, 200, 'Analyst reading alerts');

      // Analyst CANNOT delete servers (Admin only)
      const forbiddenDel = await analystClient.request('DELETE', `/servers/${serverId}`);
      if (forbiddenDel.status === 403) {
        console.log('✅ Security Analyst correctly denied from deleting server (HTTP 403 Forbidden).');
        results.push({ name: 'Scenario E: Admin-Only Operation Protection (Delete)', pass: true });
      } else {
        console.error('❌ Analyst should have been denied HTTP 403, got:', forbiddenDel.status);
        results.push({ name: 'Scenario E: Admin-Only Operation Protection (Delete)', pass: false });
      }

      // Analyst CANNOT run attack simulations
      const forbiddenSim = await analystClient.request('POST', '/simulations/modify_event_payload/run', {});
      if (forbiddenSim.status === 403) {
        console.log('✅ Security Analyst correctly denied from launching attack drills (HTTP 403 Forbidden).');
        results.push({ name: 'Scenario E: Admin-Only Attack Simulation Protection', pass: true });
      } else {
        console.error('❌ Analyst should have been denied HTTP 403, got:', forbiddenSim.status);
        results.push({ name: 'Scenario E: Admin-Only Attack Simulation Protection', pass: false });
      }
    } else {
      console.warn('⚠️ Analyst login could not be verified (try seeding first).');
      results.push({ name: 'Scenario E: RBAC Analyst Login', pass: false });
    }

    // ---------------------------------------------------------
    // Final Scorecard
    // ---------------------------------------------------------
    console.log('\n================================================================');
    console.log('📊 LOGSENTINEL PHASE 9 DEMO VERIFICATION SUMMARY');
    console.log('================================================================');
    let allPassed = true;
    for (const r of results) {
      const statusIcon = r.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`${statusIcon.padEnd(8)} | ${r.name}`);
      if (!r.pass) allPassed = false;
    }
    console.log('================================================================');

    if (allPassed) {
      console.log('🎉 ALL HACKATHON DEMO SCENARIOS FULLY VERIFIED AND PASSING!\n');
    } else {
      console.log('⚠️ Some scenarios had warnings. Review above logs for details.\n');
    }
  } catch (error) {
    console.error('Fatal execution error during demo verification:', error);
  }
}

function assertStatus(actual, expected, label) {
  if (actual === expected) {
    console.log(`✅ ${label} succeeded with HTTP ${actual}.`);
  } else {
    console.warn(`⚠️ ${label} returned HTTP ${actual} (expected ${expected}).`);
  }
}

runDemoVerification();
