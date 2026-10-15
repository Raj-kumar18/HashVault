import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';
import { normalizeLogLine } from './normalizer.js';

export class LogReader {
  constructor({ sources, serverId, stateStore, onEvents }) {
    this.sources = sources || [];
    this.serverId = serverId;
    this.stateStore = stateStore;
    this.onEvents = onEvents; // callback(eventsArray)

    // Load persisted offsets: { [path]: { offset, inode, size, lastModified } }
    this.offsets = this.stateStore.loadOffsets() || {};

    // In-memory buffer for partial lines: { [path]: string }
    this.partialLineBuffers = new Map();

    this.running = false;
    this.timers = [];
    this.watchers = new Map();
  }

  /**
   * Attaches real-time fs.watch listener to a source file if available.
   */
  attachWatcher(source) {
    const filePath = source.path;
    if (this.watchers.has(filePath) || !fs.existsSync(filePath)) return;
    try {
      const watcher = fs.watch(filePath, () => {
        if (this.running) {
          this.pollSource(source);
        }
      });
      watcher.on('error', () => {
        try { watcher.close(); } catch {}
        this.watchers.delete(filePath);
      });
      this.watchers.set(filePath, watcher);
    } catch {
      // Fallback gracefully to polling if fs.watch fails on unsupported filesystems
    }
  }

  /**
   * Starts monitoring configured log sources.
   */
  start() {
    if (this.running) return;
    this.running = true;

    logger.info(
      'LogReader',
      `Starting real-time log reader for ${this.sources.length} configured source(s)`
    );

    for (const source of this.sources) {
      this.pollSource(source);
      this.attachWatcher(source);

      const interval = setInterval(() => {
        if (this.running) {
          this.pollSource(source);
          if (!this.watchers.has(source.path)) {
            this.attachWatcher(source);
          }
        }
      }, source.pollIntervalMs || 500);

      this.timers.push(interval);
    }
  }

  /**
   * Stops polling and persists all current offsets.
   */
  stop() {
    this.running = false;
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];

    for (const [, watcher] of this.watchers) {
      try { watcher.close(); } catch {}
    }
    this.watchers.clear();

    this.stateStore.saveOffsets(this.offsets);
    logger.info('LogReader', 'Stopped log reader and saved offsets');
  }

  /**
   * Polls a single configured log file source for new appended content.
   */
  pollSource(source) {
    const filePath = source.path;

    if (!fs.existsSync(filePath)) {
      // File may not have been created yet
      return;
    }

    try {
      const stat = fs.statSync(filePath);
      const fileInode = stat.ino;
      const fileSize = stat.size;

      let sourceState = this.offsets[filePath];

      if (!sourceState) {
        // First time seeing this file:
        // By default, start at current EOF to only read newly appended events,
        // or start at 0 if explicitly requested.
        const initialOffset = source.startFromBeginning ? 0 : fileSize;
        sourceState = {
          offset: initialOffset,
          inode: fileInode,
          size: fileSize,
          lastModified: stat.mtimeMs,
        };
        this.offsets[filePath] = sourceState;
        this.stateStore.saveOffsets(this.offsets);

        if (initialOffset > 0) {
          logger.info(
            'LogReader',
            `Initialized tracking for ${filePath} at offset ${initialOffset} (EOF)`
          );
          return;
        }
      }

      // 1. Detect Log Rotation: Inode changed
      if (sourceState.inode && sourceState.inode !== fileInode) {
        logger.info(
          'LogReader',
          `Detected log rotation for ${filePath} (inode ${sourceState.inode} -> ${fileInode})`
        );
        sourceState.offset = 0;
        sourceState.inode = fileInode;
        this.partialLineBuffers.delete(filePath);
      }

      // 2. Detect File Truncation: File shrank without inode change
      if (fileSize < sourceState.offset) {
        logger.warn(
          'LogReader',
          `File truncation detected for ${filePath} (${fileSize} < ${sourceState.offset}). Resetting offset to 0.`
        );
        sourceState.offset = 0;
        this.partialLineBuffers.delete(filePath);
      }

      // 3. Check for newly appended bytes
      if (fileSize > sourceState.offset) {
        this.readAppendedBytes(filePath, sourceState, fileSize, fileInode);
      }
    } catch (err) {
      logger.error('LogReader', `Error inspecting source ${filePath}: ${err.message}`);
    }
  }

  /**
   * Reads bytes from sourceState.offset to targetSize, parsing complete newline-delimited records.
   */
  readAppendedBytes(filePath, sourceState, targetSize, fileInode) {
    const bytesToRead = targetSize - sourceState.offset;
    if (bytesToRead <= 0) return;

    const buffer = Buffer.alloc(bytesToRead);
    let fd = null;

    try {
      fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, sourceState.offset);

      if (bytesRead > 0) {
        const chunk = buffer.subarray(0, bytesRead).toString('utf8');
        const existingPartial = this.partialLineBuffers.get(filePath) || '';
        const combined = existingPartial + chunk;

        const lines = combined.split('\n');

        // The last element is either empty (if ended with \n) or an incomplete partial line
        const trailingPartial = lines.pop();
        if (trailingPartial) {
          this.partialLineBuffers.set(filePath, trailingPartial);
        } else {
          this.partialLineBuffers.delete(filePath);
        }

        const events = [];
        let runningOffset = sourceState.offset;

        for (const line of lines) {
          // Normalize only non-empty lines
          if (line.length > 0) {
            const event = normalizeLogLine(
              line,
              filePath,
              runningOffset,
              this.serverId
            );
            events.push(event);
          }
          // Offset increments by line byte length plus newline delimiter
          runningOffset += Buffer.byteLength(line, 'utf8') + 1;
        }

        // Advance authoritative offset
        sourceState.offset += bytesRead;
        sourceState.inode = fileInode;
        sourceState.size = targetSize;
        sourceState.lastModified = Date.now();

        this.offsets[filePath] = sourceState;
        this.stateStore.saveOffsets(this.offsets);

        if (events.length > 0 && typeof this.onEvents === 'function') {
          this.onEvents(events);
        }
      }
    } catch (err) {
      logger.error('LogReader', `Error reading ${filePath}: ${err.message}`);
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignored
        }
      }
    }
  }
}
