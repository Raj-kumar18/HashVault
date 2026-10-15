# LogSentinel — Automated Testing & Quality Assurance Guide

> **Product:** LogSentinel  
> **Tagline:** Every Log. Verifiable Trust.  
> **Phase:** Phase 9 — Production-Readiness Assessment & Final Delivery

LogSentinel features an extensive, multi-layered automated test suite ensuring cryptographic soundness, concurrency safety, role-based authorization, blockchain immutability, collector daemon resiliency, and security regression immunity.

All test suites use isolated in-memory databases (`MongoMemoryServer`) or local mock providers. Destructive drills are strictly forbidden from operating against production data.

---

## 1. Test Suite Summary & Pass Rate

| Module | Location | Framework / Runner | Tests | Result |
| :--- | :--- | :--- | :---: | :---: |
| **Backend Integration & Unit** | `backend/tests/` | `node:test` + MongoMemoryServer | 142 | **142 / 142 PASS** |
| **Security Regression (Phase 9)** | `backend/tests/securityRegression.test.js` | `node:test` + MongoMemoryServer | 14 | **14 / 14 PASS** |
| **Smart Contracts (Phase 5)** | `blockchain/test/` | Hardhat + Chai / Ethers.js | 11 | **11 / 11 PASS** |
| **Collector Daemon (Phase 3)** | `collector/tests/` | `node:test` (Zero dependencies) | 10 | **10 / 10 PASS** |
| **Frontend Production Build** | `frontend/` | Vite 8 + React 19 Compiler | — | **0 Errors (199ms)** |
| **Grand Total** | | | **163** | **100% Pass Rate** |

---

## 2. Test Execution Commands

### Run Everything via Root Workspace
```bash
# Run all backend suites (including security regressions)
npm test

# Run the 14 security regression tests specifically
npm run test:security

# Run smart contract unit tests on Hardhat
npm --prefix blockchain test

# Run standalone collector daemon tests
npm --prefix collector test

# Run frontend production build check
npm --prefix frontend run build
```

---

## 3. Test Architecture & Coverage Breakdown

### A. Backend Unit & Cryptographic Tests (`backend/tests/`)

1. **RFC 8785 Canonical Serialization & Hashing (`integrity.test.js` — 15 Tests)**
   - Deterministic key ordering by UTF-16 code units.
   - Whitespace and separator normalization.
   - ISO 8601 timestamp string conversions.
   - Genesis block zero-hash linking (`0000...0000`).
   - Monotonically increasing sequence numbers per server.
   - SHA-256 event hash calculation: `SHA-256("1:" + serverId + ":" + seq + ":" + prevHash + ":" + payload)`.

2. **Tamper Detection & Verification Algorithms (`integrity.test.js`)**
   - Detection of mutated payload content (`HASH_MISMATCH`).
   - Detection of modified `previousHash` references (`BROKEN_CHAIN_LINK`).
   - Detection of deleted intermediate records (`SEQUENCE_GAP`).
   - Identification of unanchored partial ranges (`INCOMPLETE`).
   - Complete valid chain verification (`VERIFIED`).

3. **Blockchain Merkle Commitments (`checkpoint.test.js` — 15 Tests)**
   - Privacy-preserving server commitment generation: `SHA-256("LOGSENTINEL:SERVER:" + appId + ":" + serverId)`.
   - Domain-separated checkpoint root derivation.
   - Deterministic Checkpoint ID calculation.
   - Independent on-chain audit re-verifying MongoDB hash chains against smart contract commitments.
   - Mismatch detection on tampered records against on-chain roots (`MISMATCH`).
   - Honest handling of offline JSON-RPC nodes (`UNAVAILABLE`).

4. **Collector Ingestion & Freshness Engine (`collectorIngestion.test.js` & `collectorE2E.test.js` — 10 Tests)**
   - Bearer token & `X-Server-Id` header authentication.
   - Idempotent deduplication of retried events via compound unique index `{ serverId: 1, eventId: 1 }`.
   - Maximum batch ingestion limits (1000 events/request).
   - Dynamic collector health evaluation (`ONLINE` <= 30s, `STALE` <= 90s, `OFFLINE` > 90s).

5. **Monitoring, Alerts & Simulation Engine (`monitoring.test.js` — 28 Tests)**
   - Background monitoring scheduler with overlap prevention mutex.
   - Deterministic alert deduplication via `dedupKey` preventing duplicate alerts.
   - Alert lifecycle: `OPEN` → `ACKNOWLEDGED` → `RESOLVED`.
   - Automatic alert resolution when underlying condition clears.
   - Controlled attack simulator executing 7 red-team drills against isolated fixtures.

6. **Sentinel AI Autonomous Investigation (`ai.test.js` — 12 Tests)**
   - Bounded telemetry retrieval (clamped to `maxEvidenceItems`).
   - Secret redaction (Bearer tokens, SSH keys, passwords, API tokens).
   - Prompt injection containment in system prompts.
   - Structured JSON output schema validation (summary, risk score, findings, recommendations).
   - Graceful degradation and fallback report generation when AI API is unavailable.

7. **Authentication & RBAC (`auth.test.js` — 20 Tests)**
   - Bcrypt password hashing and salting.
   - Express session issuance and cookie lifecycle.
   - Role-based authorization (`Admin` vs `Security Analyst`).
   - Server-level CRUD authorization.

8. **Server Inventory Management (`server.test.js` — 14 Tests)**
   - Server registration and metadata validation.
   - Single-use enrollment tokens with 15-minute expiration.
   - Collector credential generation and rotation.
   - Host isolation preventing cross-server data pollution.

---

### B. Security Regression Test Suite (`backend/tests/securityRegression.test.js`)

Phase 9 introduces an automated security regression test suite asserting 14 mandatory security properties:

```text
[PASS] Security Regression 1: Unauthorized API access is rejected with HTTP 401
[PASS] Security Regression 2: Cross-server data access is strictly isolated
[PASS] Security Regression 3: Public signup cannot escalate privileges to Admin
[PASS] Security Regression 4: Single-use enrollment token replay is rejected
[PASS] Security Regression 5: Revoked or rotated collector credentials are rejected
[PASS] Security Regression 6: Idempotent deduplication rejects duplicate event submissions
[PASS] Security Regression 7: Concurrent batch ingestion maintains atomic sequence ordering
[PASS] Security Regression 8: Modified log triggers HASH_MISMATCH and deleted log triggers SEQUENCE_GAP
[PASS] Security Regression 9: Diverging previousHash triggers BROKEN_CHAIN_LINK
[PASS] Security Regression 10: Mutated database history diverges from anchored blockchain commitment
[PASS] Security Regression 11: Blockchain RPC outage returns honest UNAVAILABLE status without false success
[PASS] Security Regression 12: Embedded prompt injection in log payload is neutralized and secrets redacted
[PASS] Security Regression 13: Secrets (password hashes, signing keys) are never exposed via API responses
[PASS] Security Regression 14: Attack simulator refuses to run against production configuration
```

---

### C. Smart Contract Hardhat Test Suite (`blockchain/test/checkpointRegistry.test.cjs`)

Executes 11 Solidity unit tests against the compiled `LogSentinelCheckpointRegistry.sol` contract:

1. **Contract Initialization:** Owner address initialized to deployer.
2. **Submitter Authorization:** Owner can authorize and revoke submitter addresses.
3. **Submitter Access Control:** Unauthorized non-submitters revert with `UnauthorizedSubmitter`.
4. **Ownership Transfer:** Two-step ownership transfer and event emission.
5. **Valid Checkpoint Anchoring:** Successfully stores domain-separated commitment and emits `CheckpointAnchored`.
6. **Zero-Commitment Rejection:** Reverts with `InvalidZeroCommitment` if any parameter is `0x0`.
7. **Sequence Range Validation:** Reverts with `InvalidSequenceRange` if `startSequence == 0` or `endSequence < startSequence`.
8. **Duplicate Checkpoint Prevention:** Reverts with `CheckpointAlreadyExists` on re-submission of existing `checkpointId`.
9. **Conflicting Range Rejection:** Reverts with `ConflictingRangeCommitment` if identical sequence range has different root.
10. **Query by Checkpoint ID:** Returns exact stored commitment envelope.
11. **Query Non-Existent Checkpoint:** Reverts with `CheckpointNotFound`.

---

### D. Linux Collector Daemon Unit Suite (`collector/tests/`)

Executes 10 standalone unit tests with zero third-party dependencies:

1. `test_config.js`: Validates CLI argument parsing, missing endpoint/server validation, and credential redaction.
2. `test_permissions.js`: Asserts file permissions (`0700` state dir, `0600` config file) on POSIX filesystems.
3. `test_normalizer.js`: Asserts event normalization, ISO timestamps, and source classification.
4. `test_queue.js`: Asserts FIFO queue persistence, maximum queue capacity (10,000 items), and drop policy.
5. `test_tailer.js`: Tests partial-line buffering, newline splitting, file rotation handling, and exponential backoff.

---

## 4. Frontend Verification & Production Build

The React 19 frontend is verified through:
- Production compilation with Vite: `npm --prefix frontend run build`.
- Zero bundle compilation warnings or missing imports.
- TypeScript/ESLint syntax checks.
- Verification that all API interactions handle loading, empty, and unavailable error states.
