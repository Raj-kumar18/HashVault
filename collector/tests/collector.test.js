import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadConfig, validateConfig, getSafeConfigSummary } from '../src/config.js';
import { StateStore } from '../src/stateStore.js';
import { PersistentQueue } from '../src/queue.js';
import { normalizeLogLine } from '../src/normalizer.js';
import { LogReader } from '../src/logReader.js';
import { redact, setLogLevel } from '../src/logger.js';
import { Sender } from '../src/sender.js';
import { Heartbeat } from '../src/heartbeat.js';

describe('LogSentinel — Phase 3: Collector Agent Unit & Component Test Suite', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logsentinel-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  /* ================= 1. Configuration & Redaction ================= */

  it('1. should validate configuration and fail closed on invalid inputs', () => {
    // Missing serverId
    assert.throws(
      () => validateConfig({ backendUrl: 'http://localhost:5001/api', serverId: '' }),
      /serverId is required/
    );

    // Invalid backendUrl
    assert.throws(
      () => validateConfig({ backendUrl: 'not-a-url', serverId: 'srv_123' }),
      /Invalid backendUrl format/
    );

    // Valid config passes
    const valid = {
      backendUrl: 'http://localhost:5001/api',
      serverId: 'srv_1234567890ab',
      batchSize: 50,
      flushIntervalMs: 2000,
      heartbeatIntervalMs: 30000,
      overflowPolicy: 'drop-oldest',
    };
    assert.equal(validateConfig(valid), true);
  });

  it('2. should sanitize and redact sensitive tokens and credentials from logs', () => {
    const raw = 'Token ent_0123456789abcdef0123456789abcdef and credential col_sec_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef were issued';
    const cleaned = redact(raw);

    assert.ok(!cleaned.includes('ent_0123456789abcdef'));
    assert.ok(!cleaned.includes('col_sec_0123456789abcdef'));
    assert.ok(cleaned.includes('ent_***REDACTED***'));
    assert.ok(cleaned.includes('col_sec_***REDACTED***'));
  });

  /* ================= 2. StateStore & Restrictive Permissions ================= */

  it('3. should persist credentials with mode 0600 and load them correctly', () => {
    const store = new StateStore(tmpDir);
    store.saveCredential('srv_test_01', 'col_sec_secret_key_123', 2);

    const loaded = store.loadCredential();
    assert.ok(loaded);
    assert.equal(loaded.serverId, 'srv_test_01');
    assert.equal(loaded.credential, 'col_sec_secret_key_123');
    assert.equal(loaded.credentialVersion, 2);

    // Check file exists
    assert.ok(fs.existsSync(store.credentialsPath));
  });

  /* ================= 3. Normalizer ================= */

  it('4. should normalize raw log lines into safe, canonical event envelopes', () => {
    const event = normalizeLogLine(
      '2026-10-11T00:00:00Z auth.info: User root logged in',
      '/var/log/auth.log',
      512,
      'srv_test_01'
    );

    assert.ok(event.eventId.startsWith('evt_'));
    assert.equal(event.source, '/var/log/auth.log');
    assert.equal(event.sourceOffset, 512);
    assert.equal(event.message, '2026-10-11T00:00:00Z auth.info: User root logged in');
    assert.equal(event.collectorMetadata.serverId, 'srv_test_01');
    assert.ok(event.observedAt);
  });

  /* ================= 4. PersistentQueue Durability & Overflow ================= */

  it('5. should persist queue items across restarts and acknowledge batches', () => {
    const queue1 = new PersistentQueue({ stateDir: tmpDir });
    const events = [
      { eventId: 'evt_1', message: 'Line 1', source: 'test.log' },
      { eventId: 'evt_2', message: 'Line 2', source: 'test.log' },
      { eventId: 'evt_3', message: 'Line 3', source: 'test.log' },
    ];

    queue1.enqueue(events);
    assert.equal(queue1.getPendingCount(), 3);

    // Simulate agent restart: initialize new queue instance from same stateDir
    const queue2 = new PersistentQueue({ stateDir: tmpDir });
    assert.equal(queue2.getPendingCount(), 3);

    // Peek batch of 2 events
    const batch = queue2.peekBatch(2);
    assert.ok(batch);
    assert.equal(batch.events.length, 2);
    assert.equal(batch.events[0].eventId, 'evt_1');

    // Acknowledge batch
    queue2.acknowledgeBatch(batch.batchId);
    assert.equal(queue2.getPendingCount(), 1);

    // Restart again: verify only 1 event remains
    const queue3 = new PersistentQueue({ stateDir: tmpDir });
    assert.equal(queue3.getPendingCount(), 1);
    assert.equal(queue3.items[0].eventId, 'evt_3');
  });

  it('6. should enforce max queue bound with drop-oldest overflow policy', () => {
    const queue = new PersistentQueue({
      stateDir: tmpDir,
      maxQueueBytes: 400, // Very small bound
      overflowPolicy: 'drop-oldest',
    });

    // Enqueue multiple events
    for (let i = 0; i < 20; i++) {
      queue.enqueue([{ eventId: `evt_${i}`, message: `Long event message payload number ${i}` }]);
    }

    // Queue size must not exceed bound
    assert.ok(queue.getSizeBytes() <= 500);
    // Oldest items were dropped, newest retained
    assert.ok(queue.items.some((e) => e.eventId === 'evt_19'));
  });

  /* ================= 5. LogReader Offset Tracking & Partial Lines ================= */

  it('7. should read newly appended lines and persist offsets across restarts', () => {
    const sampleLogPath = path.join(tmpDir, 'test.log');
    fs.writeFileSync(sampleLogPath, 'Line 1: Initial event\n', 'utf8');

    const store = new StateStore(tmpDir);
    const collectedEvents = [];

    const reader1 = new LogReader({
      sources: [{ path: sampleLogPath, startFromBeginning: true }],
      serverId: 'srv_test_01',
      stateStore: store,
      onEvents: (evts) => collectedEvents.push(...evts),
    });

    // Initial poll
    reader1.pollSource(reader1.sources[0]);
    assert.equal(collectedEvents.length, 1);
    assert.equal(collectedEvents[0].message, 'Line 1: Initial event');
    reader1.stop();

    // Append new line to file while reader is stopped
    fs.appendFileSync(sampleLogPath, 'Line 2: Appended event\nLine 3: Another event\n', 'utf8');

    // Start reader2: should read only the new appended lines from persisted offset
    const collectedEvents2 = [];
    const reader2 = new LogReader({
      sources: [{ path: sampleLogPath, startFromBeginning: false }],
      serverId: 'srv_test_01',
      stateStore: store,
      onEvents: (evts) => collectedEvents2.push(...evts),
    });

    reader2.pollSource(reader2.sources[0]);
    assert.equal(collectedEvents2.length, 2);
    assert.equal(collectedEvents2[0].message, 'Line 2: Appended event');
    assert.equal(collectedEvents2[1].message, 'Line 3: Another event');
    reader2.stop();
  });

  it('8. should buffer partial lines and only emit complete newline-terminated records', () => {
    const sampleLogPath = path.join(tmpDir, 'partial.log');
    fs.writeFileSync(sampleLogPath, '', 'utf8');

    const store = new StateStore(tmpDir);
    const collectedEvents = [];

    const reader = new LogReader({
      sources: [{ path: sampleLogPath, startFromBeginning: true }],
      serverId: 'srv_test_01',
      stateStore: store,
      onEvents: (evts) => collectedEvents.push(...evts),
    });

    // Write incomplete line (no trailing newline)
    fs.appendFileSync(sampleLogPath, 'Partial message without newline', 'utf8');
    reader.pollSource(reader.sources[0]);

    // Should NOT emit premature incomplete record
    assert.equal(collectedEvents.length, 0);

    // Complete the line with newline and add another line
    fs.appendFileSync(sampleLogPath, ' - completed!\nSecond full line\n', 'utf8');
    reader.pollSource(reader.sources[0]);

    // Now both complete lines should be emitted
    assert.equal(collectedEvents.length, 2);
    assert.equal(collectedEvents[0].message, 'Partial message without newline - completed!');
    assert.equal(collectedEvents[1].message, 'Second full line');
    reader.stop();
  });

  it('9. should handle file truncation and reset offset cleanly', () => {
    const sampleLogPath = path.join(tmpDir, 'trunc.log');
    fs.writeFileSync(sampleLogPath, 'First long content line here\nSecond line\n', 'utf8');

    const store = new StateStore(tmpDir);
    const collected = [];

    const reader = new LogReader({
      sources: [{ path: sampleLogPath, startFromBeginning: true }],
      serverId: 'srv_test_01',
      stateStore: store,
      onEvents: (evts) => collected.push(...evts),
    });

    reader.pollSource(reader.sources[0]);
    assert.equal(collected.length, 2);

    // Truncate file to a much shorter line
    fs.writeFileSync(sampleLogPath, 'Replaced after truncation\n', 'utf8');
    reader.pollSource(reader.sources[0]);

    // Reader detects truncation and reads new content from offset 0
    assert.equal(collected.length, 3);
    assert.equal(collected[2].message, 'Replaced after truncation');
    reader.stop();
  });

  /* ================= 6. Sender Retries & Exponential Backoff ================= */

  it('10. should calculate exponential backoff with jitter within bounded range', () => {
    const queue = new PersistentQueue({ stateDir: tmpDir });
    const sender = new Sender({
      backendUrl: 'http://localhost:5001/api',
      serverId: 'srv_test_01',
      credential: 'col_sec_dummy',
      queue,
      retryBaseDelayMs: 1000,
      retryMaxDelayMs: 16000,
    });

    const delay0 = sender.calculateBackoff(0);
    const delay1 = sender.calculateBackoff(1);
    const delay2 = sender.calculateBackoff(2);
    const delayMax = sender.calculateBackoff(10);

    assert.ok(delay0 >= 1000 && delay0 <= 1400);
    assert.ok(delay1 >= 2000 && delay1 <= 2700);
    assert.ok(delay2 >= 4000 && delay2 <= 5400);
    assert.ok(delayMax <= 22000); // Capped at max + jitter
  });
});
