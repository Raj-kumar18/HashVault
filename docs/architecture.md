# LogSentinel — Architecture & Pipeline Specification

**Tagline:** Every Log. Verifiable Trust.  
**Phase:** 9 — Production-Readiness Assessment & Final Delivery  
**Document Version:** 1.0.0

---

## 1. Executive Architecture Overview

LogSentinel is an enterprise-grade, tamper-evident security telemetry and cryptographic audit platform designed to ensure forensic integrity for high-value cloud and on-premise infrastructure. It solves the critical vulnerability of centralized logging: **attackers with compromised administrator or root credentials routinely modify, delete, or inject log records to conceal unauthorized activity.**

LogSentinel enforces integrity across a continuous 7-stage pipeline:

```
[Server Host OS]
       │
       ▼ (1. Local Capture & Normalization)
[LogSentinel Collector Daemon]
       │
       ▼ (2. Authenticated TLS Ingestion)
[LogSentinel Express API / Rate Limiter]
       │
       ▼ (3. Sequential Hash Chaining with Server Lock)
[SHA-256 Canonical Hash Chain Engine] ───► MongoDB (LogEvent & IntegrityRecord)
       │
       ▼ (4. Periodic Deterministic Rollup)
[Merkle Checkpoint Constructor]
       │
       ▼ (5. On-Chain Smart Contract Notarization)
[LogSentinel Registry Contract (EVM / Hardhat / Sepolia)]
       │
       ├────────────────────────────────────────┬────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
(6. Autonomous Monitoring)           (7. Cryptographic Verifier)              (8. Sentinel AI Engine)
Heartbeat Tracking & Fleet Health     Independent Zero-Trust Auditing          LangGraph Investigation
```

---

## 2. End-to-End Pipeline Stages

### Stage 1: Local Capture & Normalization (Collector)
* **Component:** `collector/src/index.js`, `reader.js`, `sanitizer.js`, `queue.js`
* **Function:** A lightweight Node.js daemon running with least privileges on target hosts (e.g. systemd service).
* **Guarantees:**
  * Bounded file read with exact byte-offset tracking (`seek` persistence in `.state/offsets.json`).
  * Handles file rotation (inode changes) and truncation (file size shrinking resets offset to 0).
  * Line buffering ensures incomplete lines are never emitted prematurely.
  * Local FIFO durable delivery queue persists unacknowledged batches across process restarts.
  * Strict bound limit (`QUEUE_MAX_BYTES`) with drop-oldest policy protects host disk from unbounded growth.
  * In-transit redaction of passwords, private keys, bearer tokens, and session cookies.

### Stage 2: Authenticated Ingestion
* **Component:** `backend/src/controllers/collector.controller.js`, `middleware/collectorAuth.js`
* **Authentication:** Completely decoupled from web browser sessions. Uses server-bound credentials (`X-Server-Id` and `Authorization: Bearer <col_sec_...>`).
* **Protection:**
  * Enrollment tokens are single-use and expire within 15 minutes. Stored only as SHA-256 hashes.
  * Exchanged collector secrets are stored in MongoDB as one-way SHA-256 hashes (`credentialHash`).
  * Rate-limited to prevent brute-force credential stuffing.
  * Immediate rejection of decommissioned/disabled servers.

### Stage 3: Sequential Hash Chaining Engine
* **Component:** `backend/src/services/integrity.service.js`, `crypto/canonicalizer.js`
* **Concurrency Control:** `withServerLock(serverId)` serializes concurrent batch arrivals per server, preventing race conditions, sequence gaps, or forked chains.
* **Canonical Serialization:** RFC 8785 deterministic JSON canonicalization guarantees identical byte representation across different architectures and runtimes:
  $$\text{canonicalPayload} = \text{RFC8785}(\{ \text{eventId}, \text{source}, \text{message}, \text{observedAt}, \dots \})$$
* **Cryptographic Hash Formula:**
  $$\text{eventHash}_n = \text{SHA256}(\text{version} + \text{sequenceNumber}_n + \text{previousHash}_{n-1} + \text{canonicalPayload}_n)$$
* **Genesis Link:** Sequence #1 links to 64 hex zeros (`0000000000000000000000000000000000000000000000000000000000000000`).

### Stage 4: Checkpoint Commitment Construction
* **Component:** `backend/src/blockchain/checkpointService.js`, `commitment.js`
* **Commitment Formula:**
  $$\text{CheckpointRoot} = \text{SHA256}(\text{appId} + \text{serverCommitment} + \text{startSeq} + \text{endSeq} + \text{count} + \text{startBoundaryHash} + \text{endBoundaryHash})$$
* **Zero Blockchain Bloat:** Raw log data is **never** sent to the blockchain. Only the 32-byte deterministic root commitment is anchored.
* **Boundary Integrity:** Validates that the sequence range is strictly contiguous without gaps before submission.

### Stage 5: Blockchain Smart Contract Notarization
* **Component:** `blockchain/contracts/LogSentinelCheckpointRegistry.sol`
* **Access Control:** Contract Owner authorizes approved submitter addresses. Reverts unauthorized callers.
* **Smart Contract Invariants:**
  * Reverts duplicate checkpoint IDs.
  * Reverts conflicting root commitments for the exact same sequence range.
  * Reverts zero-valued commitments.
* **Recovery Worker:** `backend/src/blockchain/worker.js` continuously retries pending transactions with exponential backoff and tracks confirmation receipts.

### Stage 6: Autonomous Monitoring & Alert Lifecycle
* **Component:** `backend/src/services/monitoring.service.js`, `monitoring/scheduler.js`
* **Heartbeat States:**
  * `ONLINE`: Heartbeat received within 90 seconds.
  * `STALE`: Heartbeat between 90 seconds and 300 seconds.
  * `OFFLINE`: No heartbeat for > 300 seconds.
* **Alert Deduplication:** Alerts are keyed by `dedupKey: ${serverId}:${alertType}`. If an alert is already `OPEN`, subsequent occurrences increment `occurrenceCount` without creating duplicate spam.
* **Lifecycle:** `OPEN` → `ACKNOWLEDGED` → `RESOLVED` (requires audit resolution notes).

### Stage 7: Sentinel AI Autonomous Investigation Engine
* **Component:** `backend/src/ai/sentinelGraph.js`, `provider.js`, `redaction.js`
* **Framework:** Built on `@langchain/langgraph` StateGraph with structured nodes:
  1. `requestValidationNode`: Zod schema validation and server scope authorization.
  2. `telemetryCollectionNode`: Queries real persisted logs, alerts, collector state, and blockchain anchors.
  3. `redactionNode`: Strict data minimization stripping tokens, passwords, cookies, and injection strings.
  4. `investigationNode`: LangGraph reasoning across OpenAI, Google Gemini, or deterministic offline fallback.
  5. `reportValidationNode`: Enforces evidence reference existence (cannot cite phantom records).
  6. `persistenceNode`: Stores immutable `AnalysisReport` record in MongoDB.

---

## 3. Trust Boundaries & Failure Modes

| Pipeline Boundary | Potential Attack / Failure | Security Defense & System Behavior |
| :--- | :--- | :--- |
| **Host Operating System** | Attacker compromises root on host where collector runs | Attacker can kill collector or tamper host logs, but **cannot rewrite past logs** already hashed and anchored on the backend. Collector staleness triggers `COLLECTOR_STALE` alert. |
| **Network In-Transit** | MITM, packet injection, replay attack | TLS encryption; enrollment tokens are single-use; collector credentials rotated on demand; replay attacks rejected by server-side idempotency. |
| **Ingestion API** | High-volume batch DOS | `express.json({ limit: '5mb' })`, batch size capped at 500 events, IP rate limiting (`express-rate-limit`). |
| **Database Compromise** | Rogue DBA alters historical log message in MongoDB | **Detected immediately.** Deterministic verifier recomputes canonical SHA-256 hash and flags `HASH_MISMATCH`. |
| **Database Record Deletion**| Attacker drops records to destroy audit trail | **Detected immediately.** Monotonic sequence check flags `SEQUENCE_GAP`. |
| **Blockchain RPC Outage** | Ethereum node network partition or downtime | Handled honestly as `UNAVAILABLE`. System queues checkpoints in `PENDING` state and **never falsely claims tampering** when the blockchain is merely offline. |
| **AI Prompt Injection** | Attacker embeds jailbreak string in log message | Input sanitization neutralizes injection patterns; AI report schemas strictly enforced via Zod; AI interpretations strictly decoupled from deterministic cryptographic verdicts. |

---

## 4. Separation of Concerns in UI

To prevent operational confusion during high-stress security incidents:
* **Alerts Center (`/alerts`):** Displays strictly triage tables, status filters, severity pills, and alert acknowledgement/resolution modals. No simulator or drill tabs.
* **Monitoring & Drills (`/monitoring`):** Displays strictly the **Controlled Attack Simulator** (for red-team validation) and **Fleet Health** (collector daemon heartbeats and telemetry heads).
