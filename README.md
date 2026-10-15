# HashVault — Cryptographic Audit Logging & VaultAI Platform

> **Tagline:** Every Log. Verifiable Trust.  
> **Autonomous Copilot:** VaultAI  
> **Full Architecture & Judge Q&A Guide:** See [HASHVAULT_MASTER_DOCUMENTATION.md](file:///Users/rajkumar/Desktop/Hackurity/HASHVAULT_MASTER_DOCUMENTATION.md) for complete architecture, threat models, and judge answers.

HashVault is an enterprise-grade cybersecurity platform engineered to collect telemetry from registered servers via background collector daemons, verify log integrity using sequential cryptographic SHA-256 hash chains, anchor periodic Merkle checkpoints to a blockchain smart contract, monitor collector continuity & fleet health, generate actionable deduplicated security alerts, conduct AI-assisted autonomous security investigations (VaultAI), run controlled attack drills to audit detection capabilities, and provide an executive-grade unified Security Operations Center (SOC) dashboard.

---

## Architecture Overview & Monorepo Structure

```text
LogSentinel/
├── frontend/                   # React 19 + Vite 8 + Tailwind CSS v4 + shadcn/ui
│   ├── src/
│   │   ├── components/         # TopNav, Sidebar, MetricCard, ServerLogViewer, PhaseRoadmap, SystemHealthPanel
│   │   │   └── ui/             # shadcn/ui components (Button, Input, Dialog, Badge, Card, Table, Tabs, Skeleton, etc.)
│   │   ├── context/            # AuthContext (sessions, login, signup, logout)
│   │   ├── pages/              # SecurityOverviewPage, ServersPage, ServerDetailPage, LogsExplorerPage,
│   │   │                       # IntegrityExplorerPage, BlockchainCheckpointsPage, AlertsCenterPage, MonitoringAlertsPage
│   │   ├── utils/              # Fetch API utility (CSRF, cookies, health, fleet, logs, integrity, checkpoints, alerts, monitoring, simulations, ai, overview)
│   │   ├── lib/                # utils.js (cn helper with clsx + tailwind-merge)
│   │   ├── App.jsx             # Router & Dashboard Shell (SOC Overview, Server Fleet, Logs Explorer, Integrity, Blockchain Registry, Alerts Center, Monitoring & Drills)
│   │   └── main.jsx            # Application entry point
│   └── package.json
│
├── backend/                    # Node.js + Express ES modules API service
│   ├── src/
│   │   ├── config/             # Environment validation, Mongoose & Session configs
│   │   ├── crypto/             # RFC 8785 canonicalizer & SHA-256 event hash calculation
│   │   ├── blockchain/         # Phase 5 Blockchain Engine (provider, checkpointService, verificationService, worker)
│   │   ├── monitoring/         # Phase 6 Monitoring Engine (scheduler.js with overlap protection)
│   │   ├── simulation/         # Phase 6 Controlled Attack Simulator (isolated red team test runner)
│   │   ├── ai/                 # Phase 8 Sentinel AI Engine (provider, sanitization, prompt injection protection, schema validation)
│   │   ├── services/           # integrity.service.js, monitoring.service.js, ai.service.js
│   │   ├── controllers/        # Auth, Server, Collector, Integrity, Checkpoint, Monitoring, Alert, Simulation, AI, Overview, and Log controllers
│   │   ├── middleware/         # requireAuth, requireRole, collectorAuth, CSRF, RateLimiter
│   │   ├── models/             # User, Server, LogEvent, IntegrityRecord, Checkpoint, Alert, SimulationRun, AIInvestigation
│   │   ├── routes/             # /api/auth, /api/health, /api/servers, /api/collector, /api/integrity, /api/blockchain, /api/monitoring, /api/alerts, /api/simulations, /api/ai, /api/overview, /api/logs
│   │   ├── scripts/            # seedAdmin.js, seedDemo.js, resetDemo.js, runDemoVerification.js
│   │   ├── app.js              # Express app factory (CORS, 5mb body limits, sessions, router)
│   │   └── index.js            # Server bootstrap, monitoringScheduler, checkpointWorker startup & graceful signal termination
│   ├── tests/                  # Automated test suite (node:test + MongoMemoryServer) — 142 tests across 32 suites
│   │   ├── auth.test.js        # Phase 1: Authentication & RBAC (20 tests)
│   │   ├── server.test.js      # Phase 2: Server Fleet Management (14 tests)
│   │   ├── collectorIngestion.test.js # Phase 3: Ingestion, deduplication, heartbeats (9 tests)
│   │   ├── collectorE2E.test.js # Phase 3: Full End-to-End agent integration test (1 test)
│   │   ├── integrity.test.js   # Phase 4: SHA-256 Hash Chain & Tamper Detection Suite (15 tests)
│   │   ├── checkpoint.test.js  # Phase 5: Blockchain Checkpoint Anchoring & Verification Suite (15 tests)
│   │   ├── monitoring.test.js  # Phase 6: Monitoring, Deduplicated Alerts & Attack Simulator Suite (28 tests)
│   │   ├── dashboard.test.js   # Phase 7: Overview SOC Aggregation & Logs Explorer Suite (10 tests)
│   │   ├── ai.test.js          # Phase 8: Sentinel AI Autonomous Investigation Suite (12 tests)
│   │   └── securityRegression.test.js # Phase 9: 14 Mandatory Security Regression Properties (14 tests)
│   └── package.json
│
├── blockchain/                 # Hardhat, Solidity 0.8.24, ethers.js v6 (11 smart contract tests)
│   ├── contracts/
│   │   └── LogSentinelCheckpointRegistry.sol # Checkpoint Registry smart contract
│   ├── scripts/
│   │   └── deploy.cjs          # Automated deployment script saving deployments/localhost.json
│   ├── test/
│   │   └── checkpointRegistry.test.cjs # Hardhat Chai/Mocha smart contract test suite
│   ├── hardhat.config.cjs      # Hardhat configuration (local chain 31337)
│   └── package.json
│
├── collector/                  # Pure Node.js Linux Background Collector Daemon (10 unit/component tests)
│   ├── src/                    # Agent bootstrap, loop orchestration, CLI flags, queue, tailing
│   ├── systemd/                # tamper-agent.service unit definition
│   └── tests/                  # Unit & component test suite
│
├── docs/                       # Comprehensive Architecture & Operations Documentation
│   ├── architecture.md         # Cryptographic trust pipeline & boundary flow
│   ├── security-model.md       # Threat model, RBAC matrix, and accurate security limitations
│   ├── api.md                  # Complete REST API reference
│   ├── demo-runbook.md         # Live 5-minute hackathon judge presentation runbook
│   ├── deployment.md           # Production readiness, systemd setup, Docker, and MongoDB
│   └── testing.md              # Quality assurance matrix & security regression suite
│
├── .env.example                # Master environment variables template
├── .gitignore                  # Monorepo git ignore rules
├── package.json                # Root workspace scripts & orchestrations
└── README.md                   # Master system documentation
```

---

## Phase 4 Deliverables: Tamper-Evident Engine & Premium UI Upgrade

### 1. Cryptographic Hash-Chain Engine

#### RFC 8785 Canonical JSON Serialization
Every log record is serialized canonically before cryptographic hashing using deterministic RFC 8785 rules (`backend/src/crypto/canonicalizer.js`):
- Object keys are recursively sorted lexicographically by UTF-16 code units.
- Whitespace between separators is eliminated.
- Floating-point / numbers and boolean values serialize consistently.
- Timestamps and `Date` instances are converted to ISO 8601 strings (`.toISOString()`).
- Fields omitted or undefined are handled deterministically.

#### Append-Only SHA-256 Sequential Linking
- **Genesis Block:** The initial event for each server (`sequenceNumber: 1`) links to the genesis previous hash:
  ```text
  GENESIS_PREVIOUS_HASH = "0000000000000000000000000000000000000000000000000000000000000000" (64 zeroes)
  ```
- Monotonically increasing sequence numbers per server: `sequenceNumber = prevSequenceNumber + 1`.
- Deterministic hash digest calculated as:
  ```text
  eventHash = SHA-256(`${hashVersion}:${serverId}:${sequenceNumber}:${previousHash}:${canonicalPayload}`)
  ```
- Hash version identifier is pinned to `'1'`.

#### Strict Concurrency & Idempotent Deduplication
- **Compound Unique Indexes:**
  - `{ serverId: 1, sequenceNumber: 1 }` prevents duplicate sequence allocation or race condition branching.
  - `{ serverId: 1, eventId: 1 }` provides idempotent deduplication during collector network retries without creating orphan entries.
- **Per-Server Mutex Queue:**
  - `withServerLock(serverId, fn)` serializes concurrent batch ingestion requests per server in Node.js, ensuring sequence numbers and previous hashes are allocated sequentially without collisions.
- **Server Chain Head Tracking:**
  - The `Server` model atomically stores `chainHeadSequence`, `chainHeadHash`, `chainHeadUpdatedAt`, `lastVerificationStatus`, `lastVerifiedAt`, and `lastVerifiedRange`.

### 2. Reusable Verification & Tamper Detection Engine
The independent verification service (`backend/src/services/integrity.service.js` — `verifyServerChain`) recalculates cryptographic proof across stored records without trusting stored hashes:
- **`HASH_MISMATCH`:** Triggered if a record's stored `eventHash` differs from the freshly recalculated SHA-256 hash of its canonical payload, sequence, and previous hash (indicates database row tampering or payload modification).
- **`BROKEN_CHAIN_LINK`:** Triggered if a record's `previousHash` does not match the preceding record's `eventHash` (indicates log injection, deletion, or reordering).
- **`SEQUENCE_GAP`:** Triggered if an expected sequence number is missing in the continuous series (indicates record deletion).
- **`INVALID_GENESIS`:** Triggered if sequence #1 does not link to the 64-zero genesis previous hash.
- **`INCOMPLETE`:** Flagged when verifying a partial sub-range that does not start from genesis or an acknowledged anchor checkpoint.

Verification status outputs:
- `VERIFIED`: Chain is 100% mathematically intact from genesis to chain head.
- `TAMPERED`: One or more records failed recalculation or link consistency.
- `INCOMPLETE`: Gap or unanchored sub-range encountered.

### 3. Integrity REST APIs
All integrity endpoints are mounted at `/api/integrity` and protected by session authentication and role-based access control (`Admin` and `Security Analyst`):

| Method | Endpoint | Description | Permitted Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/integrity/servers/:serverId/summary` | Retrieve chain head sequence, hash, verified status, and total count | Admin, Security Analyst |
| `GET` | `/api/integrity/servers/:serverId/events` | Paginated search of sealed records (filter by sequence range, search query) | Admin, Security Analyst |
| `GET` | `/api/integrity/servers/:serverId/events/:seq` | Retrieve full integrity record at sequence number including canonical payload | Admin, Security Analyst |
| `POST` | `/api/integrity/servers/:serverId/verify` | Trigger cryptographic re-verification for server (optional `fromSequence` / `toSequence`) | Admin, Security Analyst |

### 4. Premium Frontend Redesign (shadcn/ui)

- **Dedicated Integrity Explorer (`/integrity`):**
  - Interactive server dropdown with live chain head sequence and hash status.
  - Summary metric cards for total sealed events, chain head sequence, verification status, and last verification timestamp.
  - Paginated table showing sequence number, event ID, previous hash snippet, event hash snippet, source, timestamp, and payload length.
  - Single-record modal inspecting raw RFC 8785 canonical JSON payload alongside hashes.
  - Interactive "Run Chain Verification" dialog with live verification results and detailed violation finding diagnostics.
- **Server Detail Page Integration (`/servers/:id`):**
  - Dedicated **Cryptographic Integrity & SHA-256 Hash Chain** card.
  - Current chain head sequence, full copyable SHA-256 hash digest, and verification badge (`VERIFIED`, `TAMPERED`, `INCOMPLETE`, `UNVERIFIED`).
  - Direct "Verify Chain Now" trigger button with inline results banner.
  - Deep-link button to open server in the Integrity Explorer.
  - Clear architectural distinction note separating transport connectivity (heartbeats) from cryptographic integrity (hash-chain immutability).
- **Streamlined Application Shell:**
  - Minimalist dark cybersecurity theme using slate/zinc palettes with subtle borders and cyan accents (no gimmicky cyberpunk glow).
  - Clean 3-item navigation sidebar: **Security Overview**, **Server Fleet**, and **Integrity Explorer**.
  - Consistent role badges and account details for `Admin` and `Security Analyst`.

---

## Running in Development

Open three terminal tabs:

**Terminal 1 — Backend API:**
```bash
npm run dev:backend
# Or: cd backend && npm run dev
# Server listening on http://localhost:5001
```

**Terminal 2 — Frontend UI:**
```bash
npm run dev:frontend
# Or: cd frontend && npm run dev
# Vite dev server running on http://localhost:5173
```

**Terminal 3 — Background Collector Agent:**
```bash
# 1. Enroll and start agent for a specific server:
node collector/src/index.js --server <SERVER_ID> --enroll <ENROLLMENT_TOKEN>

# 2. Or start using pre-enrolled config file:
node collector/src/index.js --config collector/config/config.json
```

---

## Phase 5 Deliverables: Blockchain Checkpoint Anchoring & On-Chain Audit

### 1. Smart Contract Checkpoint Registry (`LogSentinelCheckpointRegistry.sol`)
- **Deployment:** Hardhat local node (`chainId: 31337`) or Sepolia testnet at contract address `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
- **Method:** `anchorCheckpoint(bytes32 checkpointId, bytes32 applicationId, bytes32 serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot)`
- **Access Control:** `owner` and authorized submitters (`setAuthorizedSubmitter`).
- **Validation Guards:**
  - Reverts `InvalidZeroCommitment` if `checkpointId`, `applicationId`, `serverCommitment`, or `checkpointRoot` is zero.
  - Reverts `InvalidSequenceRange` if `startSequence == 0` or `endSequence < startSequence`.
  - Reverts `CheckpointAlreadyExists` if the unique `checkpointId` has already been anchored.
  - Reverts `ConflictingRangeCommitment` if a different root has already been anchored for the exact same `(serverCommitment, startSequence, endSequence)` range.
- **Privacy Guarantee:** Zero raw log data, hostnames, usernames, or PII are placed on-chain. All inputs are domain-separated cryptographic `bytes32` commitments.
- **Event:** `CheckpointAnchored(bytes32 indexed checkpointId, bytes32 indexed serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot, uint256 timestamp)`

### 2. Backend Cryptographic Derivations & Verification Engine
- **Server Commitment:** Privacy-preserving deterministic digest:
  ```text
  serverCommitment = SHA-256("LOGSENTINEL:SERVER:" + applicationId + ":" + serverId)
  ```
- **Domain-Separated Checkpoint Root:** Canonical SHA-256 binding:
  ```text
  checkpointRoot = SHA-256(canonicalPayload({
    commitmentVersion: "1",
    applicationId,
    serverCommitment,
    startSequence,
    endSequence,
    eventCount,
    startBoundaryHash,
    endBoundaryHash
  }))
  ```
- **Deterministic Checkpoint ID:**
  ```text
  checkpointId = SHA-256(canonicalPayload({
    applicationId,
    serverCommitment,
    startSequence,
    endSequence,
    checkpointRoot
  }))
  ```
- **Independent On-Chain Audit (`verifyCheckpointOnChain`):**
  1. Queries the smart contract on the blockchain via ethers.js to read the immutable `onChainRoot`.
  2. Queries MongoDB to fetch contiguous records in `[startSequence, endSequence]`.
  3. Re-executes RFC 8785 canonical serialization and Phase 4 SHA-256 hash chaining to verify local integrity.
  4. Recalculates the checkpoint root from current records.
  5. Compares: `onChainRoot === recomputedRoot`.
  - **Verdict Codes:** `VERIFIED` (Exact match), `MISMATCH` (Tampered history), `INCOMPLETE` (Missing/gapped records), `UNANCHORED` (Not present on smart contract), `UNAVAILABLE` (RPC connection error).

### 3. Background Transaction Reconciliation Worker (`backend/src/blockchain/worker.js`)
- Runs every 15 seconds to detect `PENDING` or `SUBMITTED` checkpoints.
- Re-queries transaction receipts, handles network drops, updates confirmations, and marks reorged transactions.
- Provides atomic idempotency via MongoDB unique index `{ serverId: 1, startSequence: 1, endSequence: 1 }`.

### 4. Interactive Frontend Blockchain Registry (`/checkpoints`)
- **Live RPC Health Banner:** Real-time connection status (`READY`, `UNAVAILABLE`), network name, chain ID, contract address copy button, submitter gas balance in ETH, and query latency.
- **Server Fleet Selector:** Switch between servers, showing current hash-chain head.
- **Anchor Checkpoint Modal (Admin-Only):** Sequence range validator, pre-flight event calculator, live broadcast status.
- **Interactive Checkpoint History Table:** Range (`#1 → #7`), Checkpoint ID, Root Commitment, Status badge (`CONFIRMED`, `SUBMITTED`, `PENDING`), Transaction Hash, Block Number, Confirmations count.
- **Independent Audit Verdict Modal:** Side-by-side comparison of immutable smart contract root vs recomputed MongoDB hash chain root.
- **Envelope Inspector Modal:** Full JSON cryptographic envelope with copy shortcut.

---

## Running the Development Stack

**Terminal 1 — Local Hardhat Blockchain Node:**
```bash
cd blockchain
npx hardhat node
# Deploys on http://127.0.0.1:8545 (Chain ID: 31337)

# In a separate prompt, deploy the contract:
npx hardhat run scripts/deploy.cjs --network localhost
```

**Terminal 2 — Backend API Service:**
```bash
npm run dev:backend
# Or: cd backend && npm run dev
# Express server running on http://localhost:5001
```

**Terminal 3 — Frontend UI:**
```bash
npm run dev:frontend
# Or: cd frontend && npm run dev
# Vite dev server running on http://localhost:5173
```

**Terminal 4 — Linux Collector Agent:**
```bash
node collector/src/index.js --server <SERVER_ID> --enroll <ENROLLMENT_TOKEN>
```

---

## Running the Automated Test Suite

LogSentinel includes a complete automated test suite with **80 passing tests (0 failures)** across unit, component, cryptographic, smart-contract, security, and E2E integration test suites.

### 1. Run Backend & Cryptographic Suites (59 Tests — 0 Failures):
```bash
npm --prefix backend test
```
*Coverage:*
- `tests/checkpoint.test.js`: 15 tests (Server commitments, deterministic checkpoint roots, sequence continuity, range preparation, idempotency, unanchored detection, MongoDB payload tamper detection `MISMATCH`, RPC outage `UNAVAILABLE`, Admin POST permissions, Security Analyst 403 denial, paginated history, `/api/blockchain/status` safety).
- `tests/integrity.test.js`: 15 tests (RFC 8785 canonical serialization, deterministic hash generation, genesis linking, batch sequencing, duplicate event deduplication, concurrency mutex locking, tamper detection `HASH_MISMATCH`, broken link detection `BROKEN_CHAIN_LINK`, sequence gap detection `SEQUENCE_GAP`, incomplete sub-range detection `INCOMPLETE`, RBAC permissions).
- `tests/auth.test.js`: 20 tests (password hashing, CSRF tokens, session lifecycle, RBAC enforcement).
- `tests/server.test.js`: 14 tests (server CRUD, isolation, single-use token lifecycle, credential rotation).
- `tests/collectorIngestion.test.js`: 9 tests (collector authentication, deduplication, batch limits, heartbeat freshness window).
- `tests/collectorE2E.test.js`: 1 full-stack E2E test (auto-enrollment, real file tailing, queue flush, database persistence, and web log retrieval).

### 2. Run Smart Contract Test Suite (11 Tests — 0 Failures):
```bash
npm --prefix blockchain test
```
*Coverage:*
- `test/checkpointRegistry.test.cjs`: 11 tests (Owner initialization, submitter authorization/revocation, non-owner denial, ownership transfer, valid checkpoint anchoring, unauthorized rejection, zero-commitment validation, sequence bounds validation, duplicate checkpoint ID prevention, conflicting range commitment collision rejection, non-existent checkpoint revert).

### 3. Run Collector Agent Tests (10 Tests — Zero Dependencies):
```bash
npm --prefix collector test
```
*Coverage:*
- Configuration validation, token redaction, file permissions (`0700`/`0600`), event normalization, bounded queue FIFO recovery, overflow policy, file tail tracking, partial line buffering, truncation detection, exponential backoff.

---

## Building Frontend for Production

```bash
npm run build:frontend
```
*Vite compiles the production bundle in `frontend/dist/` with 0 errors.*

---

## Local Hardhat Demo: Step-by-Step Walkthrough

Follow these 15 steps to reproduce the complete end-to-end cryptographic and blockchain verification lifecycle locally:

1. **Install Project Dependencies:**
   ```bash
   npm run install:all
   ```

2. **Start MongoDB:**
   Ensure MongoDB is running locally on port 27017 or provide your MongoDB Atlas URI in `.env`:
   ```bash
   brew services start mongodb-community
   ```

3. **Start the Local Hardhat Node:**
   ```bash
   cd blockchain && npx hardhat node
   # Local JSON-RPC node running on http://127.0.0.1:8545 (Chain ID: 31337)
   ```

4. **Deploy the Checkpoint Registry Contract:**
   In another terminal, deploy `LogSentinelCheckpointRegistry.sol`:
   ```bash
   cd blockchain && npx hardhat run scripts/deploy.cjs --network localhost
   # Checkpoint Registry deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   # Artifact saved to blockchain/deployments/localhost.json
   ```

5. **Configure Backend Environment:**
   Ensure `backend/.env` has the RPC connection parameters:
   ```env
   BLOCKCHAIN_ENABLED=true
   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
   BLOCKCHAIN_CHAIN_ID=31337
   BLOCKCHAIN_NETWORK_NAME=Hardhat Localhost
   BLOCKCHAIN_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
   BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   LOGSENTINEL_APPLICATION_ID=logsentinel-default-app
   BLOCKCHAIN_CONFIRMATIONS=1
   ```

6. **Start Backend & Frontend Services:**
   ```bash
   npm run dev:backend   # Express running on http://localhost:5001
   npm run dev:frontend  # Vite running on http://localhost:5173
   ```

7. **Register a Server (Admin):**
   - Log into the dashboard (`http://localhost:5173`) with an `Admin` account.
   - Navigate to **Server Fleet** (`/servers`) and click **Register Server**.
   - Copy the generated single-use enrollment token (e.g. `ent_...`).

8. **Run the Linux Collector Agent & Ingest Real Events:**
   ```bash
   node collector/src/index.js --server <SERVER_ID> --enroll <ENROLLMENT_TOKEN> --sources /var/log/auth.log
   ```
   The agent enrolls, generates server credentials, tails files, and batches events to the backend.

9. **Inspect Phase 4 Integrity Chain:**
   Navigate to **Integrity Explorer** (`/integrity`). Observe the sequential SHA-256 hash chain with monotonically increasing sequence numbers (`#1 → #N`) and green cryptographic link indicators.

10. **Anchor Checkpoint to Blockchain (Admin):**
    - Navigate to **Blockchain Registry** (`/checkpoints`).
    - Select your server.
    - Click **Anchor Checkpoint**, choose the contiguous range (e.g. `#1 → #7`), and click **Submit On-Chain Anchor**.

11. **Wait for Transaction Receipt & Confirmation:**
    The backend submits the transaction, captures the transaction hash, waits for block inclusion, and validates the `CheckpointAnchored` contract event. The status transitions from `PENDING` → `SUBMITTED` → `CONFIRMED`.

12. **View Checkpoint & On-Chain Transaction in UI:**
    Observe the checkpoint row showing:
    - Sequence range: `#1 → #7`
    - Transaction Hash: `0xcf7a158...` (with copy shortcut)
    - Block Number: `Block #2`
    - Confirmations: `1+`
    - Root Commitment: `0x13005d7...`

13. **Execute Independent On-Chain Verification Audit:**
    Click **Verify On-Chain**. The backend queries the smart contract via RPC, reconstructs the Phase 4 hash chain from MongoDB, recomputes the root, and confirms 100% mathematical equality (`VERIFIED`).

14. **Simulate Database Tampering in Controlled Test:**
    To prove tamper detection, tamper with an anchored event directly in MongoDB:
    ```bash
    node -e "
      import('mongoose').then(async ({ default: m }) => {
        await m.connect('mongodb://localhost:27017/logsentinel');
        const r = await m.connection.collection('integrityrecords').findOne({ sequenceNumber: 2 });
        await m.connection.collection('integrityrecords').updateOne(
          { _id: r._id },
          { \$set: { message: 'INJECTED_ATTACKER_PAYLOAD', eventHash: '0'.repeat(64) } }
        );
        console.log('Tampered with sequence #2 in MongoDB!');
        process.exit(0);
      });
    "
    ```

15. **Re-Run Independent On-Chain Verification:**
    Click **Verify On-Chain** again in the UI or call `POST /api/integrity/servers/:id/checkpoints/:cpId/verify`.
    The audit engine recomputes the chain, observes that the reconstructed root differs from the immutable smart contract root, and returns:
    - Verdict: **`MISMATCH`**
    - Diagnosis: Discrepancy between recomputed hash-chain root and on-chain commitment.
    - Result: Database tampering is definitively proven without relying on MongoDB integrity.

---

## Security Model & Boundary Limitations

### What Blockchain Anchoring Guarantees:
- **Tamper-Evident Historical Immutability:** Once a sequence range `[1, N]` is anchored with root `R` in a mined block, any subsequent alteration, deletion, insertion, or reordering of records in that range is provably detected.
- **Non-Repudiation:** The backend submitter key and block timestamp provide undeniable proof of when the commitment was established.
- **Zero Privacy Leakage:** Raw logs, server hostnames, IP addresses, credentials, and PII are never placed on-chain. Only domain-separated 32-byte cryptographic commitments are stored.
- **Replay & Conflict Protection:** The smart contract rejects duplicate checkpoint IDs and prevents re-anchoring the same sequence range with a conflicting root.

### What Blockchain Anchoring Does NOT Guarantee (Limitations):
- **Unanchored Events:** New events ingested after the latest checkpoint remain in MongoDB until a subsequent checkpoint is created. A compromised database administrator could potentially delete or rewrite unanchored events prior to their anchoring.
- **Real-Time Log Ingestion Integrity:** Blockchain anchoring does not prevent an attacker from silencing a server's collector agent (addressed separately via Phase 3 Heartbeat Freshness Windows).
- **Identity of the Attacker:** On-chain verification proves that tampering occurred; it does not identify which specific individual performed the unauthorized database modification.

---

## Common Configuration Errors & Troubleshooting

| Symptom / Error | Root Cause | Resolution |
| :--- | :--- | :--- |
| Health shows `MISCONFIGURED` (Chain ID mismatch) | `BLOCKCHAIN_CHAIN_ID` does not match the connected RPC network (e.g. `31337` vs `11155111`). | Update `BLOCKCHAIN_CHAIN_ID` in `.env` to match the target RPC network. |
| Health shows `MISCONFIGURED` (Contract not deployed) | `BLOCKCHAIN_CONTRACT_ADDRESS` points to an address with zero bytecode (`0x`). | Run `npm --prefix blockchain run deploy:local` to deploy the registry. |
| Verification returns `UNAVAILABLE` | Hardhat node is stopped or RPC port `8545` is blocked. | Verify the JSON-RPC daemon is running (`npx hardhat node`). |
| Verification returns `UNANCHORED` | The checkpoint exists in MongoDB but was never successfully submitted or mined on-chain. | Check the background worker logs or re-trigger checkpoint anchoring. |
| Verification returns `INCOMPLETE` | Historical records between `startSequence` and `endSequence` are missing or deleted in MongoDB. | Indicates records were dropped or purged from the database. |
| `insufficient funds for gas` | Submitter account has 0 ETH balance. | Use a funded test account (e.g. Hardhat Account #0 has 10,000 ETH). |

---

## Phase 6 Deliverables: Monitoring Engine, Security Alerts & Controlled Attack Simulator

Phase 6 implements proactive observability, anomaly detection, deduplicated alerting, and controlled red team simulations over real persisted telemetry, Phase 4 cryptographic hash chains, and Phase 5 blockchain checkpoints.

### 1. Collector Telemetry & Real Health States

Collector status is dynamically calculated from physical heartbeat timestamps and database status — never assumed simply because an enrollment record exists:

- **`ONLINE`**: A verified collector heartbeat was received within `HEARTBEAT_STALE_THRESHOLD_MS` (default: 30 seconds).
- **`STALE`**: The latest heartbeat age exceeds the stale threshold but is less than `HEARTBEAT_OFFLINE_THRESHOLD_MS` (default: 90 seconds).
- **`OFFLINE`**: The latest heartbeat exceeds the offline threshold, indicating an interrupted daemon or network disconnection.
- **`DISABLED`**: The server has been explicitly decommissioned via administrative action (`status: 'DISABLED'`).
- **`UNKNOWN`**: Insufficient historical heartbeat data exists to establish operational status (e.g., enrolled but never started).

> **Note on Network Outages:** Missing heartbeats alone are classified as operational health degradation (`COLLECTOR_STALE` or `COLLECTOR_OFFLINE`) and are **never** falsely attributed as confirmed tampering.

### 2. Ingestion Continuity & Cryptographic Anomaly Detection

The monitoring service evaluates the following telemetry vectors:
1. **Heartbeat Continuity:** Evaluates daemon availability and raises alerts upon health state regressions.
2. **Event Sequence Gaps:** Scans sequential integer sequences (`sequenceNumber`) for missing records.
3. **Persisted Hash-Chain Integrity:** Directly runs the Phase 4 verification engine (`verifyServerChain`) across server event stores to identify:
   - `HASH_MISMATCH`: Mutated canonical payloads or spoofed record digests.
   - `BROKEN_CHAIN_LINK`: Disrupted previous-hash pointers.
   - `SEQUENCE_GAP`: Purged intermediate log entries.
4. **Blockchain Checkpoint Verification:** Cross-references MongoDB commitments with independently queried smart contract storage to detect:
   - `CHECKPOINT_MISMATCH`: Divergence between reconstructed history and on-chain commitment.
   - `BLOCKCHAIN_UNAVAILABLE`: Temporary RPC or node downtime (classified as an operational warning, not an attack).
   - `CHECKPOINT_TRANSACTION_FAILED`: Anchoring execution reverts.

### 3. Security Alert Model & Deduplication Engine

Alerts are modeled with full auditability in `backend/src/models/Alert.js`:
- **Unique Identifier:** `alertId` (`alt_...`).
- **Classification:** `alertType` (`COLLECTOR_STALE`, `COLLECTOR_OFFLINE`, `COLLECTOR_DISABLED`, `SEQUENCE_GAP`, `HASH_CHAIN_MISMATCH`, `CHECKPOINT_MISMATCH`, `BLOCKCHAIN_UNAVAILABLE`, `CHECKPOINT_TRANSACTION_FAILED`, `AUTHENTICATION_FAILURE_SPIKE`).
- **Severity Tiers:** `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **State Machine:** `OPEN` → `ACKNOWLEDGED` → `RESOLVED`.
- **Deduplication:** A deterministic `dedupKey` (`${alertType}:${serverId}:${relatedSequence}`) prevents alert storms from recurring monitoring cycles. Active incidents increment `occurrenceCount` and update `lastOccurredAt` without creating spam duplicates.
- **Auto-Resolution:** When a previously failing condition clears (e.g., collector resumes heartbeats, or blockchain RPC recovers), open alerts with that condition are automatically transitioned to `RESOLVED` with an explanatory note.
- **Audit Trail:** Manual triage captures `acknowledgedAt`, `acknowledgedBy`, `resolvedAt`, `resolvedBy`, and `resolutionNotes`.

### 4. Monitoring Scheduler Worker

Located in `backend/src/monitoring/scheduler.js`:
- **Lightweight Periodic Execution:** Default interval of 30 seconds (`MONITORING_SCHEDULER_INTERVAL_MS`).
- **Overlap Protection:** Mutex flag (`isEvaluating`) guarantees that slow runs or large batch cycles never run concurrently.
- **Graceful Lifecycle:** Cleanly started during backend boot and stopped upon `SIGTERM` / `SIGINT`.
- **Idempotency:** Safe to trigger ad-hoc via `POST /api/monitoring/run` or scheduled ticks without duplicate alert generation.

### 5. Controlled Attack Simulator (Red Team Scenarios)

The simulator (`backend/src/simulation/simulator.service.js`) provides automated, repeatable red team drills to verify that detection controls trigger as designed.

#### Safety Controls:
- **Strict Environment Check:** Throws HTTP 403 / Error if `NODE_ENV === 'production'`.
- **Isolated Disposable Fixtures:** Scenarios create disposable, isolated test server fixtures (`test-fixture-...`) and seed clean hash chains rather than mutating production customer records.
- **Role Restriction:** Only authenticated users with the `Admin` role can trigger attack simulations.
- **Audited Execution:** Every run is recorded in `SimulationRun` with start/end timestamps, intended modifications, verification performed, observed results, and detection status.

#### Supported Scenarios:
1. `modify_event_payload`: Mutates canonical payload and message of an existing record → detected as `HASH_MISMATCH` by Phase 4.
2. `delete_event_record`: Deletes an intermediate record in the sequence chain → detected as `SEQUENCE_GAP` by Phase 4.
3. `break_chain_link`: Corrupts the `previousHash` reference in an event → detected as `BROKEN_CHAIN_LINK` by Phase 4.
4. `alter_event_hash`: Injects a fraudulent SHA-256 hash into a record → detected as `HASH_MISMATCH` by Phase 4.
5. `simulate_stale_collector`: Synthesizes collector heartbeat latency past stale threshold → detected as `COLLECTOR_STALE` alert.
6. `simulate_rpc_outage`: Simulates an unreachable JSON-RPC node → detected as `BLOCKCHAIN_UNAVAILABLE` operational warning.
7. `checkpoint_mismatch_simulation`: Creates on-chain commitment then mutates DB record → detected as `CHECKPOINT_MISMATCH` by Phase 5.

---

## Phase 7 Deliverables: Premium Security Dashboard & Operational Visibility

Phase 7 delivers a cohesive, executive-grade cybersecurity dashboard unifying real operational and cryptographic data from Phases 0–6 without decorative mockups, fake charts, or invented security metrics.

### 1. Executive Security Operations Center (SOC) Overview
Located at `/` and powered by `GET /api/overview`:
- **Real Calculated Summary Metrics:**
  - `totalServers`: Total registered host inventory in MongoDB.
  - `onlineCollectors`: Only servers with valid heartbeat within the freshness window (30s). Never counts `ENROLLED` servers as online without a fresh valid heartbeat.
  - `staleCollectors` & `offlineCollectors`: Evaluated strictly against heartbeat timestamps.
  - `openAlerts`: Active security alerts grouped by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - `events24h` & `totalEvents`: Ingestion metrics within exact ISO time windows.
  - `latestVerification`: Most recent SHA-256 chain verification run with timestamp and outcome.
  - `confirmedCheckpoints`: On-chain confirmed Merkle checkpoints (never counting pending submissions as confirmed).
- **Server Fleet Health Table:** Real-time collector status, last heartbeat age, last event sequence, latest integrity check, and latest checkpoint status.
- **Security Alerts Feed:** Real alerts with severity badges, detection timestamps, and direct links to full alert investigation.
- **Activity Timeline:** Real cryptographic lifecycle events (collector enrollments, batch ingestions, chain verification runs, detected mismatches, checkpoint anchoring, alert acknowledgements).
- **Hourly Ingestion Telemetry:** Real hourly bar chart of events ingested across the past 24 hours.

### 2. Universal Logs Explorer
Located at `/logs` and powered by `GET /api/logs` & `GET /api/logs/:eventId`:
- **Bounded Server-Side Pagination:** Limit, offset, and total count without fetching unbounded collections into memory.
- **Forensic Filtering:** Search by raw message content (regex), filter by `serverId`, event `source` (e.g. `SYSTEM`, `AUTH`, `AUDIT`), and sequence number ranges (`minSequence` / `maxSequence`).
- **Cryptographic Hash Verification:** Inspect SHA-256 `eventHash`, previous event hash link, canonical payload, and corresponding `IntegrityRecord` cryptographic proof modal.

### 3. Server Detail Multi-Tab Architecture
Located at `/servers/:id`:
- **Overview Tab:** Server identity, environment, OS, collector health state machine, and heartbeat age.
- **Logs Tab:** Live log stream for the specific host with sequence ordering and search.
- **Integrity Tab:** Hash-chain status, chain-head sequence, cryptographic proof generator, and one-click manual audit runner.
- **Blockchain Tab:** Merkle checkpoints covering this host, transaction hash, block number, on-chain confirmation status, and historical commitment verifier.
- **Alerts Tab:** Active and historical security alerts associated with this specific server.

### 4. Server Fleet Inventory Upgrade
Located at `/servers`:
- **Collector Health Filter:** Filter fleet by `ALL`, `ONLINE`, `STALE`, `OFFLINE`, `DISABLED`, or `UNKNOWN`.
- **Hostname & Server Search:** Real-time client and server querying.
- **Strict Role Boundaries:** Admin can enroll servers and rotate credentials; Security Analyst has read-only audit inspection.

---

## Phase 7 API Reference

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/overview` | Admin, Security Analyst | Unified SOC summary metrics, fleet health, recent alerts, timeline, and 24h ingestion. |
| `GET` | `/api/logs` | Admin, Security Analyst | Cross-server paginated log explorer with search, serverId, source, and sequence filters. |
| `GET` | `/api/logs/:eventId` | Admin, Security Analyst | Deep forensic inspection of single event with canonical payload and cryptographic proof. |

---

## Phase 6 API Reference

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/monitoring/overview` | Admin, Security Analyst | Fleet health distribution, open alerts by severity, RPC status, recent alerts. |
| `GET` | `/api/monitoring/servers` | Admin, Security Analyst | Per-server telemetry, computed health, chain head sequence, last verified status. |
| `POST` | `/api/monitoring/run` | Admin | Manually trigger an immediate monitoring cycle. |
| `GET` | `/api/alerts` | Admin, Security Analyst | Paginated, filterable alerts list (filter by `status`, `severity`, `alertType`, `serverId`). |
| `GET` | `/api/alerts/:alertId` | Admin, Security Analyst | Single alert investigation view with complete JSON evidence metadata. |
| `POST` | `/api/alerts/:alertId/acknowledge` | Admin, Security Analyst | Acknowledge active incident with user attribution timestamp. |
| `POST` | `/api/alerts/:alertId/resolve` | Admin, Security Analyst | Resolve active incident with resolution notes and user attribution. |
| `GET` | `/api/simulations` | Admin, Security Analyst | List 7 available attack scenarios and history of past simulation runs. |
| `POST` | `/api/simulations/:scenario/run` | Admin | Execute a controlled attack scenario against disposable test fixtures. |

---

## Phase 8 Deliverables: Sentinel AI Autonomous Security Intelligence Engine

Phase 8 integrates an autonomous AI security copilot capable of evaluating telemetry, integrity failures, and security alerts to produce actionable incident response reports.

### 1. Autonomous Multi-Source Evidence Aggregation
- Pulls correlated telemetry bounded by `AI_MAX_EVIDENCE_ITEMS` (default: 100) to prevent unbounded context consumption.
- Aggregates server metadata, cryptographic verification status, recent sequence hashes, related alerts, and log events.

### 2. Privacy & Secret Redaction Guardrails
- Automatically redacts sensitive tokens before sending context to external model providers:
  - JWTs / Bearer Tokens (`Bearer eyJ...` → `[REDACTED_BEARER_TOKEN]`)
  - Private Keys (`-----BEGIN PRIVATE KEY-----` → `[REDACTED_PRIVATE_KEY]`)
  - Passwords and hex secrets (`[REDACTED_PASSWORD]`, `[REDACTED_SECRET]`)

### 3. Prompt-Injection Resistance & Structured Output Validation
- Enforces strict delimiter boundaries and explicit behavioral system instructions forbidding prompt hijacking.
- Validates model output against a strict schema requiring `executiveSummary`, `riskScore` (0-100), `integrityAssessment`, `findings`, and `recommendations`.
- Enforces evidence citation: all findings must cite specific sequence numbers, alert IDs, or log events.

### 4. Separation of Cryptographic Verification from AI Interpretation
- Cryptographic verification (Phase 4 SHA-256 hash chains, Phase 5 smart contract commitments) remains the absolute source of truth.
- Sentinel AI functions purely as an investigative and analytical assistant; it cannot override cryptographic failure states or fabricate verification passes.

---

## Phase 9 Deliverables: Production-Readiness Assessment & Hackathon Delivery

Phase 9 completes the final hardening, security regression verification, UI separation, and reproducible demonstration tooling for the platform.

### 1. Strict Page Separation (Alerts Center vs Monitoring & Drills)
- **Alerts Center (`/alerts`):** Dedicated operational triage view focusing purely on active and historical security alerts, severities, and one-click Sentinel AI investigations.
- **Monitoring & Drills (`/monitoring`):** Dedicated infrastructure observability console featuring fleet health distribution and the controlled Red Team Attack Simulator.

### 2. Security Regression Test Suite (14 Mandatory Properties)
The platform features an automated security test suite asserting 14 mission-critical security controls:
1. Unauthorized API access rejection (HTTP 401).
2. Cross-server access isolation.
3. Public signup role escalation denial (enforced default to Viewer).
4. Single-use enrollment token replay protection.
5. Revoked/rotated collector credential rejection.
6. Idempotent event deduplication.
7. Atomic concurrent batch ingestion locking.
8. Cryptographic tamper detection (`HASH_MISMATCH` and `SEQUENCE_GAP`).
9. Broken chain link detection (`BROKEN_CHAIN_LINK`).
10. Checkpoint divergence detection against on-chain commitments.
11. Honest handling of offline JSON-RPC nodes (`UNAVAILABLE`).
12. Embedded prompt injection payload neutralization and secret redaction.
13. Prevention of secret leakage in API responses.
14. Production-mode attack drill execution refusal.

### 3. Repeatable Hackathon Demo Tooling
- **`npm run seed:demo`:** Seeds Admin (`admin@logsentinel.local`), Analyst (`analyst@logsentinel.local`), demo server (`DEMO-GATEWAY-01`), 10 sealed events, and an on-chain Checkpoint #1 (`#1 → #5`).
- **`npm run verify:demo`:** Executes automated programmatic verification of Scenarios A, B, C, D, and E, outputting an end-to-end audit scorecard.
- **`npm run reset:demo`:** Safely cleans demo fixtures without affecting production data.

---

## Comprehensive Documentation Directory

| Document | Purpose |
| :--- | :--- |
| [`docs/architecture.md`](docs/architecture.md) | Full architectural data flow, trust boundaries, and stage-by-stage cryptographic pipeline specification. |
| [`docs/security-model.md`](docs/security-model.md) | Comprehensive threat model, RBAC authorization matrix, and accurate security guarantees & limitations. |
| [`docs/api.md`](docs/api.md) | Complete REST API endpoint documentation across all platform controllers. |
| [`docs/demo-runbook.md`](docs/demo-runbook.md) | Step-by-step 5-minute live hackathon presentation guide for judging panels. |
| [`docs/deployment.md`](docs/deployment.md) | Production deployment guide, systemd collector setup, MongoDB indexes, and environment hardening. |
| [`docs/testing.md`](docs/testing.md) | Detailed quality assurance methodology, test coverage breakdown, and regression suite execution. |

---

## Testing & Quality Summary

| Component | Test Suite | Tests | Result |
| :--- | :--- | :---: | :---: |
| Backend — Authentication & RBAC (Phase 1) | `auth.test.js` | 20 | Pass |
| Backend — Server Fleet & Enrollment (Phase 2) | `server.test.js` | 14 | Pass |
| Backend — Collector Ingestion & Heartbeat (Phase 3) | `collectorIngestion.test.js` | 9 | Pass |
| Backend — Collector End-to-End Daemon (Phase 3) | `collectorE2E.test.js` | 1 | Pass |
| Backend — Cryptographic Hash Chains (Phase 4) | `integrity.test.js` | 15 | Pass |
| Backend — Blockchain Anchoring & Verification (Phase 5) | `checkpoint.test.js` | 15 | Pass |
| Backend — Monitoring, Alerts & Simulator (Phase 6) | `monitoring.test.js` | 28 | Pass |
| Backend — SOC Overview & Logs Explorer (Phase 7) | `dashboard.test.js` | 10 | Pass |
| Backend — Sentinel AI Autonomous Investigation (Phase 8) | `ai.test.js` | 12 | Pass |
| Backend — Security Regression Suite (Phase 9) | `securityRegression.test.js` | 14 | Pass |
| **Backend Total** | **10 Suites / 34 Sub-Suites** | **142** | **142 / 142 Passing** |
| Blockchain — Smart Contract Checkpoint Registry | `checkpointRegistry.test.cjs` | 11 | **11 / 11 Passing** |
| Collector Agent — Unit & Component Suite | `collector/tests/*.test.js` | 10 | **10 / 10 Passing** |
| Frontend — Production Bundle Compilation | `npm run build` (Vite) | — | **0 Errors (199ms)** |
| **Monorepo Grand Total** | | **163** | **100% Pass Rate** |



