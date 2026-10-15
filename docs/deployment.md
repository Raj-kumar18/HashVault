# LogSentinel — Production Deployment & Operations Guide

> **Product:** LogSentinel  
> **Tagline:** Every Log. Verifiable Trust.  
> **Phase:** Phase 9 — Production-Readiness Assessment & Final Delivery

This document outlines the deployment architecture, configuration parameters, operational best practices, security controls, and maintenance runbooks for the LogSentinel platform across enterprise Linux environments.

---

## 1. System Topology & Architecture

```text
                                  +---------------------------------------+
                                  |         Web Browser Clients           |
                                  |   (React 19 + Vite + Tailwind CSS)    |
                                  +-------------------+-------------------+
                                                      | HTTPS (Session Cookie + CSRF)
                                                      v
+-----------------------------+           +-------------------------------+
|     Linux Target Hosts      |           |     LogSentinel Backend       |
|  (Collector Agent Daemon)   | --------> |    (Node.js Express Cluster)  |
|   - File tailing & queue    |  HTTPS    |  - Canonicalizer (RFC 8785)   |
|   - Heartbeat every 15s     | (Bearer)  |  - Sequential SHA-256 Chain   |
|   - systemd service         |           |  - RBAC (Admin / Analyst)     |
+-----------------------------+           +---------------+---------------+
                                                          |
                      +-----------------------------------+-----------------------------------+
                      |                                   |                                   |
                      v                                   v                                   v
          +-----------------------+           +-----------------------+           +-----------------------+
          |    MongoDB Replica    |           |   Ethereum / Sepolia  |           |     Sentinel AI       |
          |       Cluster         |           |  Checkpoint Registry  |           |   Investigation API   |
          | - Compound Indexes    |           | - Hardhat / Sepolia   |           | - Redacted telemetry  |
          | - Event Store         |           | - bytes32 Merkle Root |           | - Structured reports  |
          | - Integrity Proofs    |           | - Non-repudiation     |           | - Non-blocking triage |
          +-----------------------+           +-----------------------+           +-----------------------+
```

---

## 2. Infrastructure Prerequisites

| Component | Minimum Version | Recommended Specs | Network Port |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.18.0 LTS` | 2 vCPU, 4 GB RAM | — |
| **MongoDB** | `>= 6.0` (WiredTiger) | 4 vCPU, 8 GB RAM, SSD | `27017` (Internal only) |
| **Backend API** | Node.js Runtime | 2 vCPU, 4 GB RAM | `5001` (Reverse Proxy) |
| **Frontend Web** | Static Bundle (Nginx/Cloudflare) | 1 vCPU, 1 GB RAM | `443` (Public HTTPS) |
| **Blockchain RPC** | Ethereum JSON-RPC (Sepolia/Local) | Alchemy / Infura / Local Geth | `8545` (Outbound HTTPS) |
| **Target Host** | Linux (Ubuntu 20.04+, RHEL 8+) | 1 vCPU, 512 MB RAM | Outbound `443` to Backend |

---

## 3. Environment Variables & Secret Management

### Master Environment Configuration (`.env`)

Never commit production `.env` files into version control. Ensure all permissions are set to `0600` (`chmod 600 .env`).

```env
# ========================================================
# LogSentinel Production Environment Template
# ========================================================

# --- Runtime & Network ---
PORT=5001
NODE_ENV=production
CORS_ORIGIN=https://sentinel.yourdomain.com

# --- Database ---
MONGODB_URI=mongodb+srv://logsentinel_app:<STRONG_DB_PASSWORD>@cluster0.mongodb.net/logsentinel_prod?retryWrites=true&w=majority&ssl=true

# --- Session Security ---
# Generate with: node -e "console.log(crypto.randomBytes(64).toString('hex'))"
SESSION_SECRET=<64_CHARACTER_CRYPTOGRAPHIC_RANDOM_STRING>

# --- Initial Admin Account (Optional bootstrap) ---
ADMIN_EMAIL=security-admin@yourdomain.com
ADMIN_PASSWORD=<STRONG_RANDOM_PASSWORD_MIN_16_CHARS>
ADMIN_NAME=Platform Administrator

# --- Frontend API Endpoint (Baked into static build or reverse proxy) ---
VITE_API_BASE_URL=https://api-sentinel.yourdomain.com/api

# --- Phase 5: Blockchain Checkpoint Registry ---
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<ALCHEMY_API_KEY>
BLOCKCHAIN_CHAIN_ID=11155111
BLOCKCHAIN_NETWORK_NAME=Sepolia Testnet
BLOCKCHAIN_CONTRACT_ADDRESS=0x<DEPLOYED_SEPOLIA_CONTRACT_ADDRESS>
BLOCKCHAIN_PRIVATE_KEY=<SECURE_BACKEND_SUBMITTER_PRIVATE_KEY>
LOGSENTINEL_APPLICATION_ID=logsentinel-enterprise-01
BLOCKCHAIN_CONFIRMATIONS=2

# --- Phase 8: Sentinel AI Provider Configuration ---
AI_PROVIDER=groq
AI_MODEL=llama-3.3-70b-versatile
AI_API_KEY=<GROQ_OR_OPENAI_API_KEY>
AI_TIMEOUT_MS=30000
AI_MAX_RETRIES=2
AI_MAX_EVIDENCE_ITEMS=100
```

### Secret Safety Constraints
1. **Never print secrets** in application logs or standard error streams.
2. **Never expose signing keys** in client-side code or public GitHub repositories.
3. **Fail fast on startup:** The application throws an error and exits if `NODE_ENV=production` and `SESSION_SECRET` is unset or less than 32 characters.

---

## 4. Backend Service Deployment

### Step 1: Install Dependencies & Run Automated Tests
```bash
cd backend
npm ci --omit=dev
```

### Step 2: Production Security Configurations in `app.js`
- **Session Cookie Flags:** When `NODE_ENV === 'production'`, sessions require `secure: true`, `sameSite: 'lax'`, and `httpOnly: true`.
- **CORS Whitelist:** Explicit trusted domains only (no wildcard `*` with credentials).
- **Request Payload Limit:** Bound to `5mb` to mitigate denial-of-service via oversized log bursts.
- **Graceful Termination:** Listens for `SIGTERM` and `SIGINT` to safely drain ongoing hash-chain locks, flush logs, and disconnect Mongoose pools.

### Step 3: Production Process Management (PM2 Example)
Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: 'logsentinel-backend',
    script: 'src/index.js',
    instances: 1, // Single instance per server to serialize local in-memory lock queues
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    }
  }]
};
```
Start service:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Step 4: Health & Readiness Probe
The backend exposes `/api/health` for Kubernetes / load balancer health checks:
```bash
curl -f http://localhost:5001/api/health
```
Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "phase": "Phase 9 — Production-Readiness Assessment & Final Delivery",
  "db": {
    "status": "connected",
    "name": "logsentinel_prod"
  },
  "blockchain": {
    "enabled": true,
    "status": "READY"
  }
}
```

---

## 5. MongoDB Production Setup & Indexes

### Required Compound Indexes
LogSentinel relies on database-level constraints for sequential consistency and idempotent deduplication:

```javascript
// IntegrityRecord Collection:
db.integrityrecords.createIndex({ serverId: 1, sequenceNumber: 1 }, { unique: true });
db.integrityrecords.createIndex({ serverId: 1, eventId: 1 }, { unique: true });
db.integrityrecords.createIndex({ serverId: 1, timestamp: -1 });

// Checkpoint Collection:
db.checkpoints.createIndex({ serverId: 1, startSequence: 1, endSequence: 1 }, { unique: true });
db.checkpoints.createIndex({ checkpointId: 1 }, { unique: true });

// Alert Collection:
db.alerts.createIndex({ dedupKey: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['OPEN', 'ACKNOWLEDGED'] } } });
db.alerts.createIndex({ serverId: 1, createdAt: -1 });

// Server Collection:
db.servers.createIndex({ serverId: 1 }, { unique: true });
db.servers.createIndex({ "collectorCredential.hashedSecret": 1 }, { unique: true, sparse: true });
```

### Backup & Retention Considerations
- **Immutable Log Storage:** Integrity records and checkpoints must not be automatically TTL-expired if on-chain audit trails are required for regulatory compliance (SOC 2, ISO 27001).
- **Point-in-Time Recovery (PITR):** Enable continuous oplog archiving in MongoDB Atlas or replica sets to recover from infrastructure-level disasters.

---

## 6. Linux Collector Daemon Deployment (`tamper-agent`)

The collector runs as a background system service on remote Linux target machines.

### Step 1: Create Dedicated Least-Privilege Service User
```bash
sudo useradd -r -s /bin/false -d /opt/logsentinel-collector logsentinel
sudo mkdir -p /opt/logsentinel-collector
sudo chown -R logsentinel:logsentinel /opt/logsentinel-collector
```

### Step 2: Grant Read Access to Target Log Files
```bash
# Add logsentinel user to adm or systemd-journal group to read auth.log / syslog:
sudo usermod -aG adm logsentinel
```

### Step 3: Copy Collector Files & Set Secure Permissions
```bash
sudo cp -r collector/* /opt/logsentinel-collector/
sudo chmod 700 /opt/logsentinel-collector
sudo chmod -R 700 /opt/logsentinel-collector/src
```

### Step 4: Initial Enrollment (One-Time Admin Token)
```bash
sudo -u logsentinel node /opt/logsentinel-collector/src/index.js \
  --server SRV-PROD-AUTH-01 \
  --enroll ent_98a7fbc2348a \
  --endpoint https://api-sentinel.yourdomain.com/api \
  --sources /var/log/auth.log,/var/log/syslog
```
The agent stores the persistent secret in `/opt/logsentinel-collector/.state/collector.json` with `chmod 600`.

### Step 5: Install & Start systemd Daemon
Copy unit file to `/etc/systemd/system/tamper-agent.service`:
```ini
[Unit]
Description=LogSentinel Cryptographic Telemetry Collector Daemon
After=network.target

[Service]
Type=simple
User=logsentinel
Group=logsentinel
WorkingDirectory=/opt/logsentinel-collector
ExecStart=/usr/bin/node /opt/logsentinel-collector/src/index.js --config /opt/logsentinel-collector/.state/collector.json
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

# Sandboxing hardening
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/logsentinel-collector/.state
ReadOnlyPaths=/var/log

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tamper-agent
sudo systemctl start tamper-agent
sudo systemctl status tamper-agent
```

### Credential Rotation
When rotating collector credentials via the LogSentinel UI (`POST /api/servers/:id/rotate-credential`):
1. Note the new enrollment secret returned to the Administrator.
2. Stop the daemon: `sudo systemctl stop tamper-agent`.
3. Update `.state/collector.json` with the new credential.
4. Restart the daemon: `sudo systemctl start tamper-agent`.

---

## 7. Blockchain Smart Contract Deployment

### Sepolia Testnet Deployment
```bash
cd blockchain
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>"
export PRIVATE_KEY="<DEPLOYER_PRIVATE_KEY>"

# Deploy contract:
npx hardhat run scripts/deploy.cjs --network sepolia
```

Record the deployed contract address and set `BLOCKCHAIN_CONTRACT_ADDRESS` in `backend/.env`.

### Authorized Submitter Configuration
If the deployer wallet is separate from the backend server wallet, authorize the backend submitter:
```javascript
// Hardhat console or script:
const registry = await ethers.getContractAt("LogSentinelCheckpointRegistry", contractAddress);
await registry.setAuthorizedSubmitter("<BACKEND_WALLET_ADDRESS>", true);
```

---

## 8. Sentinel AI Configuration & Privacy Boundaries

### Supported AI Providers
Set `AI_PROVIDER` to one of:
- `groq`: Fast inference using `llama-3.3-70b-versatile` (Recommended for low latency hackathon demos).
- `openai`: `gpt-4o-mini` or `gpt-4o`.
- `anthropic`: `claude-3-5-sonnet-20241022`.
- `mock`: Offline deterministic fallback engine for isolated security testing.

### Redaction Boundaries
Before telemetry payloads are passed to the AI provider, `sanitizeEvidenceItem` strips:
- JWTs & Bearer tokens (`Bearer eyJ...` → `[REDACTED_BEARER_TOKEN]`)
- Private keys (`-----BEGIN PRIVATE KEY-----` → `[REDACTED_PRIVATE_KEY]`)
- API keys & Hex secrets (`0x[a-f0-9]{32,}` → `[REDACTED_SECRET]`)
- Password fields in JSON objects (`"password": "..."` → `"[REDACTED_PASSWORD]"`)

---

## 9. Production Readiness Checklist

- [x] Passwords hashed using bcrypt with salt rounds >= 12.
- [x] Session cookie configured with `httpOnly`, `sameSite`, and `secure` in production.
- [x] Rate limiting active on authentication, server management, and simulation endpoints.
- [x] Request body limit enforced at `5mb`.
- [x] Attack simulator strictly disabled when `NODE_ENV === 'production'`.
- [x] Collector credentials stored as salted SHA-256 hashes in MongoDB.
- [x] Collector configuration files restricted to file mode `0600`.
- [x] Zero raw log payloads committed to public blockchain storage.
- [x] Sentinel AI evidence redacted for secrets and tokens before external transmission.
- [x] All 163 monorepo automated tests passing without skips or failures.
