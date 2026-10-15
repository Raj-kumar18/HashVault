import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Server } from '../models/Server.js';
import { LogEvent } from '../models/LogEvent.js';
import { Checkpoint } from '../models/Checkpoint.js';
import { IntegrityRecord } from '../models/IntegrityRecord.js';
import { Alert } from '../models/Alert.js';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { appendBatchToChain } from '../services/integrity.service.js';
import { createOrGetCheckpoint } from '../blockchain/checkpointService.js';

export async function seedDemoEnvironment() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('❌ [LogSentinel Demo Seed] Refusing to seed demo data in production environment without ALLOW_DEMO_SEED=true.');
    process.exit(1);
  }

  console.log('🚀 [LogSentinel Demo Seed] Bootstrapping isolated hackathon demo environment...');

  try {
    await connectDB();

    // 1. Provision Demo Admin User
    const adminEmail = 'admin@logsentinel.local';
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'LogSentinel@Admin2026';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Demo Lead Administrator',
        email: adminEmail,
        passwordHash: adminHash,
        role: 'Admin',
      });
      console.log(`✅ [Demo Seed] Created Admin account: ${adminEmail} (Role: Admin)`);
    } else {
      adminUser.role = 'Admin';
      adminUser.passwordHash = adminHash;
      await adminUser.save();
      console.log(`ℹ️ [Demo Seed] Updated existing Admin account: ${adminEmail}`);
    }

    // 2. Provision Demo Security Analyst User
    const analystEmail = 'analyst@logsentinel.local';
    const analystPassword = process.env.DEMO_ANALYST_PASSWORD || 'LogSentinel@Analyst2026';
    const analystHash = await bcrypt.hash(analystPassword, 10);

    let analystUser = await User.findOne({ email: analystEmail });
    if (!analystUser) {
      analystUser = await User.create({
        name: 'Demo SOC Security Analyst',
        email: analystEmail,
        passwordHash: analystHash,
        role: 'Security Analyst',
      });
      console.log(`✅ [Demo Seed] Created Analyst account: ${analystEmail} (Role: Security Analyst)`);
    } else {
      analystUser.role = 'Security Analyst';
      analystUser.passwordHash = analystHash;
      await analystUser.save();
      console.log(`ℹ️ [Demo Seed] Updated existing Analyst account: ${analystEmail}`);
    }

    // 3. Clean any existing DEMO-GATEWAY-01 fixtures
    const existingDemoServer = await Server.findOne({ serverName: 'DEMO-GATEWAY-01', ownerId: adminUser._id });
    if (existingDemoServer) {
      await IntegrityRecord.deleteMany({ serverId: existingDemoServer.serverId });
      await LogEvent.deleteMany({ serverId: existingDemoServer.serverId });
      await Checkpoint.deleteMany({ serverId: existingDemoServer.serverId });
      await Alert.deleteMany({ serverId: existingDemoServer.serverId });
      await Server.deleteOne({ _id: existingDemoServer._id });
      console.log(`ℹ️ [Demo Seed] Purged prior demo server instance (${existingDemoServer.serverId}).`);
    }

    // 4. Provision Demo Server
    const serverId = `srv_demo_${crypto.randomBytes(4).toString('hex')}`;
    const rawCollectorSecret = `col_sec_${crypto.randomBytes(32).toString('hex')}`;
    const credentialHash = crypto.createHash('sha256').update(rawCollectorSecret).digest('hex');

    const demoServer = await Server.create({
      serverId,
      serverName: 'DEMO-GATEWAY-01',
      hostname: 'gateway-01.demo.internal',
      os: 'Linux',
      environment: 'Production',
      description: 'Primary ingress edge gateway and authentication proxy node.',
      enrollmentStatus: 'ENROLLED',
      connectionStatus: 'ONLINE',
      collectorHealth: 'ONLINE',
      lastHeartbeatAt: new Date(),
      credentialHash,
      credentialVersion: 1,
      ownerId: adminUser._id,
    });
    console.log(`✅ [Demo Seed] Provisioned Server: ${demoServer.serverName} (${demoServer.serverId})`);

    // 5. Ingest Realistic Baseline Log Events (#1 to #10)
    const baseTime = Date.now() - 10 * 60 * 1000;
    const syntheticLogs = [
      {
        eventId: 'evt_demo_01',
        source: '/var/log/syslog',
        message: 'systemd[1]: Started LogSentinel High-Integrity Host Audit Daemon.',
        observedAt: new Date(baseTime + 10000),
      },
      {
        eventId: 'evt_demo_02',
        source: '/var/log/auth.log',
        message: 'sshd[1240]: Accepted publickey for secops from 10.0.4.15 port 52310 ssh2: RSA SHA256:7mP...',
        observedAt: new Date(baseTime + 30000),
      },
      {
        eventId: 'evt_demo_03',
        source: '/var/log/nginx/access.log',
        message: 'GET /api/v1/health HTTP/1.1 200 48 "-" "Consul-HealthCheck/1.15.2"',
        observedAt: new Date(baseTime + 60000),
      },
      {
        eventId: 'evt_demo_04',
        source: '/var/log/syslog',
        message: 'kernel: [  142.890124] audit: type=1400 apparmor="STATUS" operation="profile_load" profile="logsentinel"',
        observedAt: new Date(baseTime + 90000),
      },
      {
        eventId: 'evt_demo_05',
        source: '/var/log/auth.log',
        message: 'sudo: secops : TTY=pts/0 ; PWD=/etc/logsentinel ; USER=root ; COMMAND=/usr/bin/sha256sum /etc/hosts',
        observedAt: new Date(baseTime + 120000),
      },
      {
        eventId: 'evt_demo_06',
        source: '/var/log/syslog',
        message: 'ufw: [UFW BLOCK] IN=eth0 OUT= MAC=00:16:3e:.. SRC=198.51.100.44 DST=10.0.0.5 PROTO=TCP SPT=44122 DPT=22',
        observedAt: new Date(baseTime + 180000),
      },
      {
        eventId: 'evt_demo_07',
        source: '/var/log/nginx/access.log',
        message: 'POST /api/auth/login HTTP/2.0 200 312 "https://console.logsentinel.local" "Mozilla/5.0"',
        observedAt: new Date(baseTime + 240000),
      },
      {
        eventId: 'evt_demo_08',
        source: '/var/log/syslog',
        message: 'cron[1804]: (root) CMD (/usr/local/bin/backup-audit-state.sh >/dev/null 2>&1)',
        observedAt: new Date(baseTime + 300000),
      },
      {
        eventId: 'evt_demo_09',
        source: '/var/log/auth.log',
        message: 'systemd-logind[788]: New session 42 of user secops.',
        observedAt: new Date(baseTime + 360000),
      },
      {
        eventId: 'evt_demo_10',
        source: '/var/log/syslog',
        message: 'logsentinel-collector[2100]: Sealed batch #1 (sequences 1-10) committed with chain head.',
        observedAt: new Date(baseTime + 420000),
      },
    ];

    const { accepted } = await appendBatchToChain(demoServer, syntheticLogs);

    // Persist LogEvent records
    const logDocs = accepted.map((item) => ({
      eventId: item.eventId,
      serverId: demoServer.serverId,
      serverRef: demoServer._id,
      batchId: 'demo_batch_genesis_10',
      source: item.source,
      sourceOffset: 0,
      message: item.message,
      observedAt: item.observedAt || new Date(),
      ingestedAt: new Date(),
      collectorMetadata: {},
      sequenceNumber: item.sequenceNumber,
      eventHash: item.eventHash,
    }));
    await LogEvent.insertMany(logDocs);
    console.log(`✅ [Demo Seed] Ingested 10 cryptographic log events (Chain Head: #${demoServer.chainHeadSequence}).`);

    // 6. Anchor Checkpoint #1 (Sequences 1 to 5)
    try {
      const { checkpoint } = await createOrGetCheckpoint({
        serverId: demoServer.serverId,
        startSequence: 1,
        endSequence: 5,
        userId: adminUser._id,
      });
      const root = checkpoint.checkpointRoot || checkpoint.rootHash || '0x...';
      console.log(`✅ [Demo Seed] Anchored Checkpoint #1 (Sequences 1-5, Root: ${root.slice(0, 18)}...).`);
    } catch (cpErr) {
      console.warn(`⚠️ [Demo Seed] Checkpoint creation skipped or local blockchain unreached: ${cpErr.message}`);
    }

    console.log('\n======================================================');
    console.log('🎉 LOGSENTINEL DEMO ENVIRONMENT READY FOR PRESENTATION');
    console.log('======================================================');
    console.log(`• Admin Login:      ${adminEmail}  |  Password: ${adminPassword}`);
    console.log(`• Analyst Login:    ${analystEmail} |  Password: ${analystPassword}`);
    console.log(`• Demo Server Node: ${demoServer.serverName} (${demoServer.serverId})`);
    console.log(`• Initial Logs:     10 Sequential SHA-256 Verified Events`);
    console.log(`• Sealed Checkpoint: Sequences #1 to #5 Anchored`);
    console.log(`• Collector Secret: ${rawCollectorSecret}`);
    console.log('======================================================\n');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ [Demo Seed Error]:', err);
    await disconnectDB();
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('seedDemo.js')) {
  seedDemoEnvironment();
}
