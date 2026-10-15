import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { logger } from './logger.js';

export class PersistentQueue {
  constructor({ stateDir, maxQueueBytes = 50 * 1024 * 1024, overflowPolicy = 'drop-oldest' }) {
    this.stateDir = path.resolve(stateDir);
    this.queueFilePath = path.join(this.stateDir, 'queue.json');
    this.maxQueueBytes = maxQueueBytes;
    this.overflowPolicy = overflowPolicy; // 'drop-oldest' or 'reject-incoming'

    this.items = [];
    this.inFlightBatches = new Map(); // batchId -> array of eventIds

    this.loadFromDisk();
  }

  /**
   * Initializes queue from persistent storage on startup.
   */
  loadFromDisk() {
    if (!fs.existsSync(this.queueFilePath)) {
      this.items = [];
      return;
    }

    try {
      const data = fs.readFileSync(this.queueFilePath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.items = parsed;
        logger.info(
          'Queue',
          `Restored ${this.items.length} pending event(s) from persistent queue at ${this.queueFilePath}`
        );
      } else {
        this.items = [];
      }
    } catch (err) {
      logger.error('Queue', `Could not read persistent queue file: ${err.message}. Starting fresh.`);
      this.items = [];
    }
  }

  /**
   * Atomically flushes queue to disk with 0600 mode.
   */
  saveToDisk() {
    const tempPath = `${this.queueFilePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(this.items), { mode: 0o600, encoding: 'utf8' });
      fs.renameSync(tempPath, this.queueFilePath);
    } catch (err) {
      logger.error('Queue', `Failed to atomically persist queue to disk: ${err.message}`);
    }
  }

  /**
   * Approximate byte size of the queued events.
   */
  getSizeBytes() {
    return Buffer.byteLength(JSON.stringify(this.items), 'utf8');
  }

  /**
   * Enqueues newly normalized events, enforcing bounds and overflow policies.
   */
  enqueue(events) {
    if (!Array.isArray(events) || events.length === 0) return;

    if (this.overflowPolicy === 'reject-incoming') {
      const currentSize = this.getSizeBytes();
      if (currentSize >= this.maxQueueBytes) {
        logger.error(
          'Queue',
          `Queue bound reached (${currentSize} >= ${this.maxQueueBytes} bytes). Rejecting ${events.length} incoming events.`
        );
        return;
      }
    }

    this.items.push(...events);

    // Apply drop-oldest if over capacity
    if (this.overflowPolicy === 'drop-oldest') {
      let currentSize = this.getSizeBytes();
      let droppedCount = 0;

      while (currentSize > this.maxQueueBytes && this.items.length > 0) {
        this.items.shift();
        droppedCount++;
        currentSize = this.getSizeBytes();
      }

      if (droppedCount > 0) {
        logger.warn(
          'Queue',
          `Queue bound reached (${this.maxQueueBytes} bytes). Dropped ${droppedCount} oldest pending event(s).`
        );
      }
    }

    this.saveToDisk();
  }

  /**
   * Peeks the next batch of events for delivery.
   * Generates a stable batchId and tracks events as in-flight.
   */
  peekBatch(batchSize = 50) {
    if (this.items.length === 0) {
      return null;
    }

    const batchEvents = this.items.slice(0, batchSize);
    const batchId = `batch_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    this.inFlightBatches.set(batchId, batchEvents.map((e) => e.eventId));

    return {
      batchId,
      events: batchEvents,
    };
  }

  /**
   * Removes events from queue upon verified backend HTTP acknowledgment.
   */
  acknowledgeBatch(batchId) {
    const ackedEventIds = this.inFlightBatches.get(batchId);
    if (!ackedEventIds) return;

    const ackedSet = new Set(ackedEventIds);
    const prevCount = this.items.length;

    // Remove acknowledged events from queue
    this.items = this.items.filter((item) => !ackedSet.has(item.eventId));
    this.inFlightBatches.delete(batchId);

    const removedCount = prevCount - this.items.length;
    this.saveToDisk();

    logger.debug(
      'Queue',
      `Acknowledged batch [${batchId}]: removed ${removedCount} event(s). Queue remaining: ${this.items.length}`
    );
  }

  /**
   * Releases in-flight lock on failure so events can be retried.
   */
  releaseBatch(batchId) {
    this.inFlightBatches.delete(batchId);
  }

  /**
   * Number of pending unacknowledged events.
   */
  getPendingCount() {
    return this.items.length;
  }
}
