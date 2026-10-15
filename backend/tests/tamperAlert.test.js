import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { IntegrityRecord } from '../src/models/IntegrityRecord.js';
import { Alert } from '../src/models/Alert.js';
import { appendBatchToChain } from '../src/services/integrity.service.js';
import { evaluateFleetMonitoring } from '../src/services/monitoring.service.js';

describe('Real-Time Database Tamper Detection & Autonomous Alert Triggering', () => {
  let mongoServer;
  let testServer;
  let adminUser;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    adminUser = await User.create({
      name: 'Tamper Test Admin',
      email: 'tamper-admin@test.local',
      passwordHash: 'dummy',
      role: 'Admin',
    });

    testServer = await Server.create({
      serverId: 'TAMPER-PROD-SRV-01',
      serverName: 'Production Payment Host',
      hostname: 'pay.prod.internal',
      os: 'Linux',
      ownerId: adminUser._id,
      connectionStatus: 'ONLINE',
      lastHeartbeatAt: new Date(),
    });

    // Ingest 3 real log events into the cryptographic chain
    await appendBatchToChain(testServer, [
      {
        eventId: 'evt_alpha',
        serverId: testServer.serverId,
        batchId: 'batch_001',
        source: '/var/log/secure.log',
        sourceOffset: 0,
        message: 'Transaction 101 approved: $450.00',
        observedAt: new Date().toISOString(),
      },
      {
        eventId: 'evt_beta',
        serverId: testServer.serverId,
        batchId: 'batch_001',
        source: '/var/log/secure.log',
        sourceOffset: 45,
        message: 'Transaction 102 approved: $820.00',
        observedAt: new Date().toISOString(),
      },
      {
        eventId: 'evt_gamma',
        serverId: testServer.serverId,
        batchId: 'batch_001',
        source: '/var/log/secure.log',
        sourceOffset: 90,
        message: 'Transaction 103 approved: $15.50',
        observedAt: new Date().toISOString(),
      },
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. should show zero tampering alerts initially when logs are unmolested', async () => {
    const monitoringResult = await evaluateFleetMonitoring();
    assert.ok(monitoringResult);

    const alerts = await Alert.find({
      serverId: testServer.serverId,
      alertType: 'HASH_CHAIN_MISMATCH',
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
    });
    assert.equal(alerts.length, 0, 'Must have zero tamper alerts when database is unmolested');
  });

  it('2. should IMMEDIATELY detect direct database modification in MongoDB and raise CRITICAL alert', async () => {
    // Malicious attacker or DBA directly edits sequence #2 in MongoDB
    const recordToTamper = await IntegrityRecord.findOne({
      serverId: testServer.serverId,
      sequenceNumber: 2,
    });
    assert.ok(recordToTamper);

    // Update message directly in database without going through the application
    recordToTamper.message = 'Transaction 102 refunded to attacker account: $99,999.00';
    await recordToTamper.save();

    // Autonomous fleet monitoring evaluates the fleet
    const res = await evaluateFleetMonitoring();

    // Assert that the monitoring run detected the tamper
    const tamperFinding = res.findings.find(
      (f) => f.serverId === testServer.serverId && f.type === 'HASH_CHAIN_MISMATCH'
    );
    assert.ok(tamperFinding, 'Fleet monitoring must actively discover database modification');

    // Assert that a CRITICAL open alert exists in Alert collection
    const openAlert = await Alert.findOne({
      serverId: testServer.serverId,
      alertType: 'HASH_CHAIN_MISMATCH',
      status: 'OPEN',
    });
    assert.ok(openAlert, 'An open CRITICAL alert must be created');
    assert.equal(openAlert.severity, 'CRITICAL');
    assert.equal(openAlert.relatedSequence, 2, 'Alert must accurately pinpoint modified sequence #2');
    assert.match(openAlert.description, /tampering/i);
  });

  it('3. should auto-resolve tampering alert once data is restored or verified clean', async () => {
    // Restore the tampered record to its cryptographically sealed state
    const recordToRestore = await IntegrityRecord.findOne({
      serverId: testServer.serverId,
      sequenceNumber: 2,
    });
    const parsed = JSON.parse(recordToRestore.canonicalPayload);
    recordToRestore.message = parsed.message;
    await recordToRestore.save();

    // Re-evaluate monitoring
    await evaluateFleetMonitoring();

    // Alert should now be automatically resolved
    const activeAlerts = await Alert.find({
      serverId: testServer.serverId,
      alertType: 'HASH_CHAIN_MISMATCH',
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
    });
    assert.equal(activeAlerts.length, 0, 'Alert must be auto-resolved once chain is clean');

    const resolvedAlert = await Alert.findOne({
      serverId: testServer.serverId,
      alertType: 'HASH_CHAIN_MISMATCH',
      status: 'RESOLVED',
    });
    assert.ok(resolvedAlert, 'Historical alert marked RESOLVED');
  });

  it('4. should detect record deletion in MongoDB and raise SEQUENCE_GAP alert', async () => {
    // Delete sequence #2 directly from MongoDB
    await IntegrityRecord.deleteOne({
      serverId: testServer.serverId,
      sequenceNumber: 2,
    });

    // Re-evaluate monitoring
    const res = await evaluateFleetMonitoring();
    const gapFinding = res.findings.find(
      (f) => f.serverId === testServer.serverId && (f.type === 'SEQUENCE_GAP' || f.type === 'HASH_CHAIN_MISMATCH')
    );
    assert.ok(gapFinding, 'Must detect sequence gap or broken link on record deletion');

    const gapAlert = await Alert.findOne({
      serverId: testServer.serverId,
      alertType: { $in: ['SEQUENCE_GAP', 'HASH_CHAIN_MISMATCH'] },
      status: 'OPEN',
    });
    assert.ok(gapAlert, 'Open alert must be raised when record is deleted from MongoDB');
  });
});
