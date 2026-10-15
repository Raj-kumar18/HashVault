import { logger } from './logger.js';

export class Heartbeat {
  constructor({
    backendUrl,
    serverId,
    credential,
    intervalMs = 30000,
    agentVersion = '1.0.0',
    agentStartTime = new Date().toISOString(),
    getQueueCount = () => 0,
    getLastSendAt = () => null,
    getSourcesCount = () => 0,
  }) {
    this.backendUrl = backendUrl.replace(/\/+$/, '');
    this.serverId = serverId;
    this.credential = credential;
    this.intervalMs = intervalMs;
    this.agentVersion = agentVersion;
    this.agentStartTime = agentStartTime;
    this.getQueueCount = getQueueCount;
    this.getLastSendAt = getLastSendAt;
    this.getSourcesCount = getSourcesCount;

    this.timer = null;
    this.running = false;
    this.lastSuccessfulHeartbeatAt = null;
  }

  /**
   * Starts periodic heartbeat timer.
   */
  start() {
    if (this.running) return;
    this.running = true;

    // Send immediate first heartbeat upon startup
    this.sendHeartbeat();

    this.timer = setInterval(() => {
      if (this.running) {
        this.sendHeartbeat();
      }
    }, this.intervalMs);

    logger.info('Heartbeat', `Periodic heartbeat initialized (every ${this.intervalMs}ms)`);
  }

  /**
   * Stops heartbeat timer.
   */
  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Dispatches authenticated heartbeat to the backend.
   */
  async sendHeartbeat() {
    const url = `${this.backendUrl}/collector/heartbeat`;
    const memUsage = process.memoryUsage();

    const payload = {
      agentVersion: this.agentVersion,
      agentStartTime: this.agentStartTime,
      currentHealth: 'HEALTHY',
      lastSuccessfulSendAt: this.getLastSendAt(),
      pendingQueueCount: this.getQueueCount(),
      diagnostics: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round((memUsage.rss / (1024 * 1024)) * 10) / 10,
        sourcesMonitored: this.getSourcesCount(),
      },
    };

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
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `HTTP ${response.status}`;
        if (response.status === 401 || response.status === 403) {
          logger.error(
            'Heartbeat',
            `Heartbeat rejected by backend (HTTP ${response.status}): ${errorMsg}. Server identity or credential invalid.`
          );
          return false;
        }
        logger.warn('Heartbeat', `Heartbeat failed (HTTP ${response.status}): ${errorMsg}`);
        return false;
      }

      this.lastSuccessfulHeartbeatAt = new Date().toISOString();
      logger.debug(
        'Heartbeat',
        `Heartbeat acknowledged by backend at ${data.acknowledgedAt || this.lastSuccessfulHeartbeatAt} (status: ${data.status || 'OK'})`
      );
      return true;
    } catch (err) {
      logger.warn('Heartbeat', `Network error during heartbeat: ${err.message}`);
      return false;
    }
  }
}
