import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

export class StateStore {
  constructor(stateDir) {
    this.stateDir = path.resolve(stateDir);
    this.credentialsPath = path.join(this.stateDir, 'credentials.json');
    this.offsetsPath = path.join(this.stateDir, 'offsets.json');
    this.queuePath = path.join(this.stateDir, 'queue.json');
    this.init();
  }

  /**
   * Initializes state directory with restrictive permissions (0700).
   */
  init() {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });
      logger.info('StateStore', `Created state directory at ${this.stateDir} with permissions 0700`);
    } else {
      try {
        fs.chmodSync(this.stateDir, 0o700);
      } catch {
        // Ignored on non-POSIX filesystems
      }
    }
  }

  /**
   * Atomically writes file to disk with mode 0600.
   */
  writeAtomic(filePath, data) {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    const serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    fs.writeFileSync(tempPath, serialized, { mode: 0o600, encoding: 'utf8' });
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Loads persisted collector credential if previously enrolled.
   */
  loadCredential() {
    if (!fs.existsSync(this.credentialsPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.credentialsPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.credential) {
        return parsed;
      }
    } catch (err) {
      logger.warn('StateStore', `Could not read credentials file: ${err.message}`);
    }
    return null;
  }

  /**
   * Persists collector credential with mode 0600.
   */
  saveCredential(serverId, credential, credentialVersion = 1) {
    const data = {
      serverId,
      credential,
      credentialVersion,
      enrolledAt: new Date().toISOString(),
    };
    this.writeAtomic(this.credentialsPath, data);
    logger.info('StateStore', `Saved collector credential for server ${serverId} (permissions 0600)`);
  }

  /**
   * Loads log file offsets tracking table.
   */
  loadOffsets() {
    if (!fs.existsSync(this.offsetsPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(this.offsetsPath, 'utf8');
      return JSON.parse(content) || {};
    } catch (err) {
      logger.warn('StateStore', `Could not read offsets file: ${err.message}`);
      return {};
    }
  }

  /**
   * Persists log file offsets atomically.
   */
  saveOffsets(offsets) {
    try {
      this.writeAtomic(this.offsetsPath, offsets);
    } catch (err) {
      logger.error('StateStore', `Failed to save offsets: ${err.message}`);
    }
  }
}
