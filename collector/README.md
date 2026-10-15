# LogSentinel — Linux Background Log Collector Agent (Phase 3)

> **Tagline:** Every Log. Verifiable Trust.  
> **Phase 3 Deliverable:** Real Linux background log collector daemon delivering normalized log events and periodic heartbeats to the LogSentinel backend over authenticated TLS transport.

---

## 1. Architectural Overview

The LogSentinel Collector is an autonomous, lightweight Node.js daemon designed for Linux host infrastructure. It continuously tails explicitly configured log files, buffers events in a durable local queue, and delivers batches to the LogSentinel ingestion pipeline.

```
┌─────────────────────────────────────────────────────────────┐
│                       Host Server                           │
│                                                             │
│  /var/log/auth.log ──► [LogReader] (Offset Tracking)       │
│                             │                               │
│                             ▼                               │
│                       [Normalizer] (Canonical JSON)         │
│                             │                               │
│                             ▼                               │
│                [PersistentQueue] (stateDir/queue.json)      │
│                             │                               │
│         ┌───────────────────┴───────────────────┐           │
│         ▼                                       ▼           │
│    [Sender]                                [Heartbeat]      │
│  (Logs Batch)                             (Ping 30s)        │
└─────────┬───────────────────────────────────────┬───────────┘
          │ Bearer col_sec_...                    │ Bearer col_sec_...
          │ X-Server-Id: srv_...                  │ X-Server-Id: srv_...
          ▼                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   LogSentinel Backend                       │
│    POST /api/collector/logs      POST /api/collector/heartbeat│
│    (Idempotent Deduplication)     (Dynamic ONLINE Derivation)│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Security & Design Principles

1. **Zero Raw Secret Persistence:**
   Enrollment tokens are single-use and consumed upon exchange. Persistent credentials (`col_sec_...`) are saved in `stateDir/credentials.json` with strict POSIX mode `0600` (readable only by the service owner).
2. **Untrusted Data Isolation:**
   All log contents are treated as untrusted strings. The collector never evaluates, executes, or parses code from log streams.
3. **Least-Privilege Execution:**
   Runs as the unprivileged service user `logsentinel` under hardened systemd sandboxing (`NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=full`).
4. **At-Least-Once Delivery Semantics:**
   Events are removed from the persistent local queue **only after** receiving an explicit HTTP 200/201 acknowledgment from the backend. Network drops or timeout partitions trigger exponential backoff with random jitter. Idempotent backend deduplication prevents duplicate persistence.
5. **No Filesystem Traversal:**
   The reader monitors only explicitly declared log sources in configuration. It will never traverse or scan arbitrary directories.

---

## 3. Configuration Reference

Configuration can be specified in `/etc/logsentinel/collector.json` or via environment variables:

| Setting | Environment Variable | Default | Description |
| :--- | :--- | :--- | :--- |
| `backendUrl` | `LOGSENTINEL_BACKEND_URL` | `http://localhost:5001/api` | Base URL of LogSentinel API |
| `serverId` | `LOGSENTINEL_SERVER_ID` | Required | Unique public server ID (`srv_...`) |
| `enrollmentToken` | `LOGSENTINEL_ENROLLMENT_TOKEN` | Required for bootstrap | Single-use enrollment token (`ent_...`) |
| `credential` | `LOGSENTINEL_CREDENTIAL` | Stored in state | Server collector secret (`col_sec_...`) |
| `sources` | `LOGSENTINEL_SOURCES` | `[]` | Array of log file paths to tail |
| `batchSize` | `LOGSENTINEL_BATCH_SIZE` | `50` | Maximum log records per HTTP request |
| `flushIntervalMs` | `LOGSENTINEL_FLUSH_INTERVAL_MS`| `2000` | Flush interval in milliseconds |
| `heartbeatIntervalMs`| `LOGSENTINEL_HEARTBEAT_INTERVAL_MS`| `30000` | Heartbeat interval (30 seconds) |
| `stateDir` | `LOGSENTINEL_STATE_DIR` | `/var/lib/logsentinel` | Local directory for offsets and queue |
| `maxQueueBytes` | `LOGSENTINEL_MAX_QUEUE_BYTES` | `52428800` (50MB) | Bound on persistent queue file |
| `overflowPolicy` | `LOGSENTINEL_OVERFLOW_POLICY` | `drop-oldest` | Policy on bound (`drop-oldest` or `reject-incoming`) |
| `logLevel` | `LOGSENTINEL_LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

---

## 4. Linux Installation & Systemd Deployment

### Step 1: Run Verified Installer
```bash
sudo bash collector/scripts/install.sh
```

### Step 2: Configure Server Identity
Edit `/etc/logsentinel/collector.json`:
```json
{
  "backendUrl": "https://your-logsentinel-api.corp/api",
  "serverId": "srv_1234567890ab",
  "enrollmentToken": "ent_abcdef1234567890",
  "sources": [
    { "path": "/var/log/auth.log", "pollIntervalMs": 1000 }
  ]
}
```

### Step 3: Grant Least-Privilege Log Read Permissions
Grant the unprivileged user `logsentinel` read access to the configured log files via POSIX ACL:
```bash
sudo setfacl -m u:logsentinel:r /var/log/auth.log
```

### Step 4: Start and Enable Service
```bash
sudo systemctl enable --now tamper-agent
sudo systemctl status tamper-agent
sudo journalctl -u tamper-agent -f
```

---

## 5. Local Testing & Verification Mode

You can run the collector agent in local test mode against a sample log file:

```bash
# 1. Start the agent pointing to a local test file and backend
node collector/src/index.js \
  --config collector/config/config.example.json
```

---

## 6. Phase 4 Integration Points

Phase 4 will ingest these persisted records into the **Cryptographic Hash Chain Engine**:
- Sequence numbers will be computed per server stream.
- SHA-256 rolling block hash chains will verify continuity.
- Tamper detection algorithms will flag out-of-order or altered records.
