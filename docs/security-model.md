# LogSentinel — Security Model & Cryptographic Guarantees

**Product:** LogSentinel — Every Log. Verifiable Trust.  
**Phase:** 9 — Production-Readiness Assessment & Final Delivery  
**Document Version:** 1.0.0

---

## 1. Threat Model & Adversary Profiles

LogSentinel is engineered against three distinct adversary tiers:

### Adversary Tier 1: Host-Level Compromised User
* **Capabilities:** Has gained unauthorized access to an enrolled server (e.g., web shell, compromised service account).
* **Objective:** Tamper with local `/var/log` log files to conceal malicious commands.
* **LogSentinel Defense:** The local collector tails files in real-time. By the time the attacker attempts to clear `/var/log`, logs have already been ingested, canonically serialized, hashed, and sealed into MongoDB.

### Adversary Tier 2: Network / In-Transit Interceptor
* **Capabilities:** Positioned on the internal corporate network (man-in-the-middle).
* **Objective:** Replay historical collector log batches, inject spoofed server heartbeats, or forge enrollment tokens.
* **LogSentinel Defense:** TLS encryption on all ingestion endpoints; single-use enrollment tokens with 15-minute expiration; server-specific collector credentials stored only as SHA-256 hashes; server-side deduplication rejecting replayed batches.

### Adversary Tier 3: Privileged Database Administrator / Malicious Insider
* **Capabilities:** Possesses direct root access to the MongoDB instance or backend host.
* **Objective:** Manually run database updates (`updateOne`, `deleteOne`) to alter incriminating audit logs or remove security findings.
* **LogSentinel Defense:**
  * Modifying any log message invalidates the SHA-256 hash-chain, producing a `HASH_MISMATCH` during audit.
  * Deleting a record introduces an unbridgeable `SEQUENCE_GAP`.
  * Even if the attacker attempts to recalculate the entire MongoDB hash-chain, the previously anchored **Blockchain Merkle Checkpoint** stored on Ethereum will not match the forged database root, proving historical tampering beyond doubt (`CHECKPOINT_MISMATCH`).

---

## 2. Accurate Security Claims & Inherent Limitations

In accordance with strict application security and cryptographic engineering standards, LogSentinel documents the boundaries of its cryptographic guarantees:

### 1. Hash-Chaining Requires a Known Head or Anchor
* SHA-256 hash chaining makes alterations detectable **when compared against a known trustworthy chain head or independent on-chain anchor**.
* If a range has **never been anchored** to the blockchain and an attacker possesses root database access, they could theoretically recalculate the entire unanchored history from sequence #1 to sequence #N.
* **Mitigation:** Regular, automated blockchain checkpoint rollups (e.g. hourly or every 100 events) ensure the unanchored window is tightly bounded.

### 2. Checkpoints Anchor Commitments, Not Raw Data
* Blockchain transactions store **32-byte cryptographic Merkle roots**, not raw log text.
* A checkpoint proves that the exact sequence of logs existed in a specific state at a given block number; it does not store the full log content on-chain.

### 3. Checkpoint Protection Applies Strictly to Anchored Ranges
* Only the sequence numbers covered by a `CONFIRMED` checkpoint (`startSequence` to `endSequence`) receive immutable blockchain notarization.
* Uncheckpointed logs (e.g. sequences arriving after the latest checkpoint) rely on local hash-chaining until the next anchoring cycle.

### 4. Non-Repudiation vs. Factuality
* A valid cryptographic hash chain and blockchain checkpoint prove that a log event **has not been modified since ingestion**.
* It **does not prove that the software generating the log event was truthful** or identify the human author behind a forged application log.

### 5. AI Reasoning is Not Cryptographic Proof
* Sentinel AI is an **investigative security assistant**, not a cryptographic verifier.
* AI findings and recommendations are probabilistic interpretations. They must always be verified against the deterministic cryptographic verifier (`/api/integrity/servers/:id/verify`) and smart contract transaction receipts.

### 6. Shared Security Dependencies
* The host operating system, collector process permissions, backend API server, database, Ethereum signer private key, and JSON-RPC node are all part of the overarching security perimeter. Compromise of the signing private key allows fraudulent checkpoints to be submitted to the smart contract.

### 7. Local Test Chains vs. Public Blockchains
* Development Hardhat chains provide rapid, zero-cost transaction testing for demonstration purposes. They **do not provide permanent public immutability** across node restarts. Production deployments require a public testnet (e.g. Ethereum Sepolia) or enterprise L2 ledger.

### 8. Outages vs. Tampering
* Missing telemetry, unreachable collector heartbeats, and RPC provider timeouts must **never be conflated with confirmed tampering**.
* LogSentinel strictly classifies infrastructure outages as `COLLECTOR_STALE` or `BLOCKCHAIN_UNAVAILABLE` (operational warnings), reserving `CRITICAL` tampering verdicts for confirmed mathematical divergences (`HASH_MISMATCH`, `SEQUENCE_GAP`, `BROKEN_CHAIN_LINK`).

---

## 3. Role-Based Access Control (RBAC) Matrix

| Platform Capability | Admin | Security Analyst | Viewer |
| :--- | :---: | :---: | :---: |
| **View Dashboard & Telemetry** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Browse Logs Explorer** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Inspect Integrity Explorer** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Execute Deterministic Chain Verification** | ✅ Yes | ✅ Yes | ❌ No |
| **Trigger Blockchain Checkpoint Anchor** | ✅ Yes | ❌ No | ❌ No |
| **Verify On-Chain Checkpoint Audit** | ✅ Yes | ✅ Yes | ❌ No |
| **Triage & Acknowledge / Resolve Alerts** | ✅ Yes | ✅ Yes | ❌ No |
| **Run Sentinel AI Investigations** | ✅ Yes | ✅ Yes | ❌ No |
| **Register / Delete Server Nodes** | ✅ Yes | ❌ No | ❌ No |
| **Generate Enrollment Tokens & Rotate Credentials**| ✅ Yes | ❌ No | ❌ No |
| **Execute Controlled Attack Simulations (Drills)** | ✅ Yes | ❌ No | ❌ No |

---

## 4. Multi-Tenant Isolation & Object Ownership

* **User Scoping:** Every server node in MongoDB is bound to an `ownerId`.
* **Cross-Tenant Denial:** Backend endpoints strictly scope server lookups (`{ serverId, ownerId: req.user._id }`). If User A attempts to query, modify, or delete a server owned by User B, the backend returns `HTTP 404 Not Found` without disclosing the resource's existence.
* **Collector Decoupling:** Collectors do not authenticate with web sessions or bearer JWTs containing user identities. They authenticate strictly with per-server credentials (`X-Server-Id` and `Authorization: Bearer <col_sec_...>`), ensuring that compromised collector credentials cannot access other servers or web console features.
