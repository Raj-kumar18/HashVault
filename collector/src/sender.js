import { logger } from './logger.js';

export class Sender {
  constructor({
    backendUrl,
    serverId,
    credential,
    queue,
    batchSize = 50,
    flushIntervalMs = 2000,
    maxRetries = 5,
    retryBaseDelayMs = 1000,
    retryMaxDelayMs = 30000,
    requestTimeoutMs = 10000,
  }) {
    this.backendUrl = backendUrl.replace(/\/+$/, '');
    this.serverId = serverId;
    this.credential = credential;
    this.queue = queue;
    this.batchSize = batchSize;
    this.flushIntervalMs = flushIntervalMs;
    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;
    this.retryMaxDelayMs = retryMaxDelayMs;
    this.requestTimeoutMs = requestTimeoutMs;

    this.running = false;
    this.flushTimer = null;
    this.consecutiveFailures = 0;
    this.lastSuccessfulSendAt = null;
    this.isFlushing = false;
  }

  /**
   * Starts periodic flush loop.
   */
  start() {
    if (this.running) return;
    this.running = true;

    this.scheduleNextFlush(this.flushIntervalMs);
    logger.info('Sender', `Log sender loop started (flush interval: ${this.flushIntervalMs}ms)`);
  }

  /**
   * Stops periodic sender loop.
   */
  stop() {
    this.running = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  scheduleNextFlush(delayMs) {
    if (!this.running) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), delayMs);
  }

  /**
   * Calculates exponential backoff with random jitter.
   */
  calculateBackoff(attempt) {
    const exponential = Math.min(
      this.retryMaxDelayMs,
      this.retryBaseDelayMs * Math.pow(2, attempt)
    );
    const jitter = Math.random() * 0.3 * exponential; // 0-30% jitter
    return Math.floor(exponential + jitter);
  }

  /**
   * Attempts to drain pending batches from queue and send to backend.
   */
  async flush() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      while (this.running && this.queue.getPendingCount() > 0) {
        const batch = this.queue.peekBatch(this.batchSize);
        if (!batch) break;

        const success = await this.sendBatch(batch);
        if (!success) {
          // Break loop on failure to allow backoff delay
          break;
        }
      }
    } finally {
      this.isFlushing = false;
      const nextDelay =
        this.consecutiveFailures > 0
          ? this.calculateBackoff(this.consecutiveFailures)
          : this.flushIntervalMs;
      this.scheduleNextFlush(nextDelay);
    }
  }

  /**
   * Delivers a single batch with timeout and error classification.
   */
  async sendBatch(batch) {
    const url = `${this.backendUrl}/collector/logs`;
    const payload = {
      batchId: batch.batchId,
      sentAt: new Date().toISOString(),
      events: batch.events,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Server-Id': this.serverId,
          Authorization: `Bearer ${this.credential}`,
          'X-Collector-Credential': this.credential,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const status = response.status;
        const errorMsg = data?.message || data?.error || `HTTP ${status}`;

        if (status === 401 || status === 403) {
          logger.error(
            'Sender',
            `Authentication rejected by backend (HTTP ${status}): ${errorMsg}. Server credential may be revoked or server disabled.`
          );
          // Release in-flight lock without dropping queue
          this.queue.releaseBatch(batch.batchId);
          this.consecutiveFailures++;
          return false;
        }

        logger.warn(
          'Sender',
          `Batch delivery failed (HTTP ${status}): ${errorMsg}. Will retry with backoff.`
        );
        this.queue.releaseBatch(batch.batchId);
        this.consecutiveFailures++;
        return false;
      }

      // Verify acknowledgement matches
      if (data?.acknowledgedBatchId === batch.batchId || data?.success) {
        this.queue.acknowledgeBatch(batch.batchId);
        this.lastSuccessfulSendAt = new Date().toISOString();
        this.consecutiveFailures = 0;
        logger.debug(
          'Sender',
          `Successfully delivered batch [${batch.batchId}] (${batch.events.length} events, ${data.acceptedCount || batch.events.length} accepted)`
        );
        return true;
      } else {
        logger.warn('Sender', `Unexpected response structure for batch ${batch.batchId}`);
        this.queue.releaseBatch(batch.batchId);
        this.consecutiveFailures++;
        return false;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      const msg = isTimeout
        ? `Request timed out after ${this.requestTimeoutMs}ms`
        : err.message;

      logger.warn('Sender', `Network error during batch delivery: ${msg}`);
      this.queue.releaseBatch(batch.batchId);
      this.consecutiveFailures++;
      return false;
    }
  }

  /**
   * Flushes any remaining queue events within a maximum deadline (for graceful shutdown).
   */
  async flushRemaining(timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (this.queue.getPendingCount() > 0 && Date.now() < deadline) {
      const batch = this.queue.peekBatch(this.batchSize);
      if (!batch) break;

      const sent = await this.sendBatch(batch);
      if (!sent) break;
    }
  }
}
