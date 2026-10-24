# HashVault — Cryptographic Audit Logging & Autonomous SOC Platforms

> **Tagline:** Every Log. Verifiable Trust.  
> **Autonomous Copilot:** VaultAI  
> **License:** [Apache-2.0](LICENSE)  

---

## Problem (PS number and title)

* **Problem Statement:** Cryptographically Verifiable Audit Trails & Autonomous SOC Operations (PS: Tamper-Evident SIEM & Zero-Trust Telemetry)
* **The Core Challenge:**  
  Traditional Security Information and Event Management (SIEM) systems (e.g., Splunk, Elasticsearch, Datadog) share a critical single point of failure: **database administrators, cloud providers, and privileged root intruders are trusted implicitly.** If an Advanced Persistent Threat (APT) actor or rogue insider compromises database or cloud credentials, they can retroactively rewrite logs, delete incriminating sequence rows, or falsify historical telemetry without triggering alarms.
* **Our Solution:**  
  **HashVault** eliminates blind trust in stored logs. By enforcing deterministic RFC 8785 canonical serialization, continuous SHA-256 cryptographic hash-chaining, periodic Merkle rollup commitments anchored to an Ethereum smart contract ([`LogSentinelCheckpointRegistry.sol`](blockchain/contracts/LogSentinelCheckpointRegistry.sol)), and **VaultAI** autonomous multi-tier incident triage, any retroactive tampering is exposed mathematically within seconds.

---

## What it does

1. **Lightweight Host Telemetry Collection:** An ultra-lightweight collector daemon tails Linux and container logs (`/var/log/auth.log`, syslog), persisting byte-offsets to survive crashes and securely streaming telemetry with HMAC bearer authentication.
2. **RFC 8785 Canonical JSON & SHA-256 Hash Chaining:** Ingested logs are deterministically ordered lexicographically, formatted, and chained via `eventHash = SHA-256(version + serverId + seq + prevHash + canonicalPayload)`.
3. **Periodic Blockchain Checkpoint Rollups:** Contiguous log sequence ranges are rolled up into 32-byte Merkle checkpoint roots and anchored on-chain. **Zero PII or raw logs ever touch the blockchain.**
4. **Active Cryptographic Verification & Tamper Trapping:** The system actively recomputes hash chains and flags `HASH_MISMATCH`, `SEQUENCE_GAP`, `BROKEN_CHAIN_LINK`, and `CHECKPOINT_MISMATCH` against Ethereum consensus.
5. **Continuous Fleet Monitoring & Deduplicated Alerting:** Heartbeat monitoring classifies daemons into `ONLINE`, `STALE`, or `OFFLINE`, dynamically generating and auto-resolving operational incidents.
6. **Controlled Red Team Attack Drills:** An integrated attack simulator allows security teams to simulate 7 real-world attack vectors (database modification, sequence deletion, hash link breaking, fake hash spoofing, RPC failure) to verify detection integrity.
7. **VaultAI Autonomous SOC Copilot:** Evaluates cryptographic status, collector continuity, active alerts, and raw log forensics to synthesize executive breach narratives, blast-radius assessments, and downloadable PDF forensic reports.

---

## Architecture

### System Topology & Cryptographic Trust Flow

```text
+---------------------------------------------------------------------------------------------------+
|                                   HASHVAULT MONOREPO TOPOLOGY                                     |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [Target Workstations / Linux Servers]                                                            |
|          │                                                                                        |
|          ▼ (1. Local Capture, Byte-Offset Seeking, Secret Redaction & Bounded Queue)              |
|  [HashVault Collector Daemon] (collector/src/index.js)                                            |
|          │                                                                                        |
|          ▼ (2. Authenticated Bearer Stream over TLS: X-Server-Id & Credential Hash)               |
|  [HashVault Ingestion Gateway] (backend/src/routes/collector.routes.js)                           |
|          │                                                                                        |
|          ▼ (3. Per-Server Mutex Lock + RFC 8785 Canonical JSON Serialization)                     |
|  [Sequential SHA-256 Cryptographic Hash Chaining] (backend/src/crypto/canonicalizer.js)           |
|          │                                                                                        |
|          ▼ (4. Periodic Rollup into 32-Byte Merkle Root)                                          |
|  [On-Chain Checkpoint Notarization Worker] (backend/src/blockchain/worker.js)                     |
|          │                                                                                        |
|          ▼ (5. Immutable Smart Contract Storage - Zero PII On-Chain)                              |
|  [LogSentinelCheckpointRegistry.sol] (Ethereum Sepolia / Hardhat Localhost)                        |
|          │                                                                                        |
|   ┌──────┴───────────────────────────────────────┬────────────────────────────────────────┐       |
|   ▼                                              ▼                                        ▼       |
| [Autonomous Fleet Monitoring]          [Cryptographic Verifier]                 [VaultAI Agent]   |
| Heartbeat Freshness & Active Auditing  Zero-Trust Mathematical Verification     Autonomous SOC    |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

### Monorepo Structure

```text
HashVault/
├── frontend/                   # React 19 + Vite 8 + Tailwind CSS v4 + shadcn/ui
│   ├── src/
│   │   ├── components/         # VaultAI copilot, MetricCards, Timeline, Forensics modals
│   │   ├── pages/              # Overview, ServerFleet, LogsExplorer, Integrity, Checkpoints, Alerts, Monitoring & Drills
│   │   └── utils/              # API Client & CSRF state handler
├── backend/                    # Node.js + Express ES modules API service
│   ├── src/
│   │   ├── crypto/             # RFC 8785 canonicalizer & SHA-256 hash calculation
│   │   ├── blockchain/         # Provider, CheckpointService, VerificationService, Worker
│   │   ├── monitoring/         # Fleet monitoring scheduler & threshold evaluation
│   │   ├── simulation/         # 7 controlled red-team attack drill scenarios
│   │   ├── ai/                 # VaultAI multi-tier evaluation engine & Groq LLM integration
│   │   └── services/           # integrity.service.js, monitoring.service.js, alert.service.js
│   └── tests/                  # 142 automated unit, component, and security regression tests
├── blockchain/                 # Hardhat, Solidity 0.8.24, ethers.js v6
│   ├── contracts/              # LogSentinelCheckpointRegistry.sol
│   └── scripts/                # deploy.cjs automated deployment
├── collector/                  # Linux Background Collector Daemon
│   ├── src/                    # Agent tailer, byte seek store, sender queue
│   └── systemd/                # Production service unit file
├── docs/                       # In-depth architectural & operational documentation
├── .env.example                # Master environment variables template
└── LICENSE                     # Apache-2.0 Open Source License
```

---

## How to run it

### Prerequisites (Clean Machine Requirements)
* **Node.js**: `v18.0.0` or higher (tested on Node `v20.x` and `v22.x`)
* **npm**: `v9.0.0` or higher
* **MongoDB**: Local MongoDB instance running on `mongodb://localhost:27017` OR a free MongoDB Atlas URI

---

### Step 1: Clone and Configure Environment

```bash
# 1. Clone repository
git clone https://github.com/Raj-kumar18/HashVault.git
cd HashVault

# 2. Setup master root .env
cp .env.example .env

# 3. Setup backend .env
cp backend/.env.example backend/.env

# 4. Setup frontend .env
cp frontend/.env.example frontend/.env
```

> **Note on Configuration:** Default values in `.env.example` are pre-tuned for local execution out-of-the-box (`PORT=5001`, `MONGODB_URI=mongodb://localhost:27017/logsentinel`, `VITE_API_BASE_URL=http://localhost:5001/api`).

---

### Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace package dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd blockchain && npm install && cd ..
cd collector && npm install && cd ..
```

---

### Step 3: Start the Local Blockchain Node & Deploy Contract

In **Terminal 1**:
```bash
cd blockchain
npx hardhat node
```
*Runs an EVM-compatible node at `http://127.0.0.1:8545` (Chain ID: `31337`).*

In **Terminal 2** (deploy the smart contract):
```bash
cd blockchain
npx hardhat run scripts/deploy.cjs --network localhost
```
*Deploys `LogSentinelCheckpointRegistry.sol` to `0x5FbDB2315678afecb367f032d93F642f64180aa3`.*

---

### Step 4: Seed Initial Admin & Demo Data

In **Terminal 2**:
```bash
# Seed initial Security Administrator account & sample server fleet
npm run seed:demo
```
*Pre-populates an enrolled server `PAYMENT-GATEWAY-01`, 13 sequential hash-chain logs, and anchors on-chain Checkpoint #1.*

---

### Step 5: Start Backend API & Frontend Dashboard

In **Terminal 2** (Start Backend):
```bash
npm run dev:backend
# Backend listening on http://localhost:5001
```

In **Terminal 3** (Start Frontend):
```bash
npm run dev:frontend
# Vite development server running on http://localhost:5173
```

Open your browser at **`http://localhost:5173`**.

---

## How to run the demo

### Demo Credentials
* **Email:** `admin@logsentinel.local`
* **Password:** `ReplaceWithStrongPassword2026!`

---

### 5-Step Live Evaluation Walkthrough (90 Seconds)

1. **Step 1: Inspect Clean Fleet & Cryptographic Hash Chain**
   * Navigate to **Server Fleet** (`/servers`) or **Integrity Explorer** (`/integrity`).
   * Observe continuous sequential log events (`#1` to `#13`), each with deterministic SHA-256 hash links and genesis link `0000...0000`.
   * Click **Run Verification** to witness instant client/server mathematical confirmation (`VERIFIED`).

2. **Step 2: Inspect Ethereum Checkpoint Registry**
   * Navigate to **Blockchain Registry** (`/checkpoints`).
   * View the on-chain Merkle root (`0xc71c1eb...`) anchored on `LogSentinelCheckpointRegistry.sol`.
   * Click **Verify Checkpoint** to validate that MongoDB data matches Ethereum consensus with zero discrepancy.

3. **Step 3: Execute a Controlled Red Team Attack Drill**
   * Navigate to **Monitoring & Drills** (`/monitoring`).
   * Select **"Modify Historical Log Payload (Database Tampering)"** or **"Delete Historical Record"** and click **Run Drill**.
   * The platform launches a simulated attack, triggering the verification engine to catch the discrepancy, displaying a clear red/green forensic diff and instantly raising a `CRITICAL` alert.

4. **Step 4: Launch VaultAI Autonomous SOC Investigation**
   * Navigate to **VaultAI** (`/ai`).
   * Select the affected server and click **Investigate Server →**.
   * VaultAI autonomously assesses cryptographic proofs, daemon heartbeat latencies, and security alerts, generating:
     - An executive breach conclusion with verified risk classification (`CRITICAL`).
     - A forensic breakdown citing exact sequence numbers.
     - Operational remediation recommendations with a one-click **Download PDF Incident Report**.

5. **Step 5: Run Automated Monorepo Verification**
   * In your terminal, run:
     ```bash
     npm test
     ```
     *Executes all **163 automated tests** across Backend (142), Smart Contract (11), and Collector (10) with 100% pass rate.*

---

## Tech stack

| Domain | Technology / Library | Version | Role in Architecture |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | React | `^19.0.0` | Declarative reactive UI components |
| **Frontend Build** | Vite | `^6.0.0` | Ultra-fast HMR and production bundle optimization |
| **Styling** | Tailwind CSS & shadcn/ui | `^4.0.0` | Minimalist dark enterprise cybersecurity styling |
| **Icons** | Lucide React | `^1.16.0` | Crisp UI iconography |
| **Backend API** | Node.js (ESM) | `>=18.0.0` | High-throughput asynchronous REST server |
| **Framework** | Express.js | `^5.0.0` | HTTP routing, session handling, rate limiting |
| **Database** | MongoDB & Mongoose | `^8.0.0` | High-performance document storage with compound unique indexes |
| **Smart Contracts** | Solidity | `^0.8.24` | Gas-optimized immutable checkpoint registry |
| **Blockchain Dev** | Hardhat & Ethers.js | `^2.22.0` / `^6.13.0` | EVM deployment, RPC communication, contract verification |
| **Cryptography** | Node.js Crypto | Native | RFC 8785 canonicalization & SHA-256 hash chaining |
| **Autonomous AI** | Groq SDK / LangGraph | `^0.9.0` | Evidence-grounded incident analysis and risk determination |
| **Testing** | Node Test Runner & Hardhat Chai | Native / `^2.0.0` | 163 end-to-end automated unit and security regression tests |

---

## Team members

| Name | Role | GitHub |
| :--- | :--- | :--- |
| **Raj Kumar** | Lead Architect, Full-Stack & Smart Contract Engineer | [@Raj-kumar18](https://github.com/Raj-kumar18) |

---

## Documentation & Deliverables

Every technical write-up, specification, and presentation guide is committed in [`/docs`](docs/) and linked below:

* [`docs/architecture.md`](docs/architecture.md) — Comprehensive cryptographic trust pipeline and subsystem data flows.
* [`docs/security-model.md`](docs/security-model.md) — Detailed threat model, attacker assumptions, and RBAC matrix.
* [`docs/demo-runbook.md`](docs/demo-runbook.md) — Step-by-step 5-minute live hackathon presentation guide.
* [`docs/final-project-report.md`](docs/final-project-report.md) — Complete engineering report and architectural specification.
* [`docs/deployment.md`](docs/deployment.md) — Production hardening, Linux systemd daemon configuration, and MongoDB scaling.
* [`docs/testing.md`](docs/testing.md) — Testing methodology and 14-property security regression matrix.
* [`docs/api.md`](docs/api.md) — Complete REST API reference documentation.
* [`HASHVAULT_MASTER_DOCUMENTATION.md`](HASHVAULT_MASTER_DOCUMENTATION.md) — Deep-dive architectural dossier & Hackathon Judge Q&A playbook.

---

## License & Credits

### License
This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for complete terms.

### Open-Source Credits & Attribution
HashVault proudly stands on the shoulders of the open-source community:
* **Ethereum Foundation & Hardhat**: EVM execution environment and smart contract compilation.
* **Ethers.js**: Reliable JavaScript interface for EVM RPC interactions.
* **Radix UI & Lucide Icons**: Accessible primitives and UI icons.
* **Tailwind CSS**: Utility-first CSS styling framework.
* **Mongoose**: MongoDB object modeling and schema validation.
* **Groq**: High-speed LLM inference API.
