# LogSentinel — Blockchain Checkpoint Registry Module (Phase 5)

> **Tagline:** Every Log. Verifiable Trust.  
> **Status:** Phase 5 Implemented & Fully Operational  
> **Contract Address (Localhost):** `0x5FbDB2315678afecb367f032d93F642f64180aa3` (Chain ID: `31337`)

---

## 1. Overview & Purpose

The **LogSentinel Blockchain Module** anchors cryptographic commitments of contiguous [Phase 4](file:///Users/rajkumar/Desktop/Hackurity/backend/src/services/integrity.service.js) SHA-256 hash chains onto an immutable smart contract ([LogSentinelCheckpointRegistry.sol](file:///Users/rajkumar/Desktop/Hackurity/blockchain/contracts/LogSentinelCheckpointRegistry.sol)).

### Why Blockchain Anchoring?
Internal databases (e.g. MongoDB) can potentially be rewritten, deleted, or altered if an attacker obtains database administrator credentials. By committing sequential cryptographic roots to an external smart contract, LogSentinel provides **non-repudiable proof of log history**:
- Any unauthorized retro-active modification of historical logs immediately causes a root mismatch during on-chain audits.
- Smart contracts prevent overwriting or deleting anchored checkpoints.
- Strict continuity checking prevents attackers from forging sub-sequences or omitting events.

---

## 2. Privacy & Zero-Knowledge Architecture

The smart contract **never receives or stores raw log data, canonical JSON payloads, server names, hostnames, usernames, or PII**. All on-chain records consist of domain-separated `bytes32` cryptographic commitments:

```text
Log Event Ingestion (Collector)
       ↓
RFC 8785 Canonical JSON Serialization
       ↓
SHA-256 Sequential Hash-Chain Linkage (#1 → #N)
       ↓
Domain-Separated Merkle / Range State Accumulator
       ↓
Privacy-Safe bytes32 Commitments:
  • bytes32 checkpointId
  • bytes32 applicationId
  • bytes32 serverCommitment (SHA-256("LOGSENTINEL:SERVER:" + appId + ":" + serverId))
  • uint64  startSequence
  • uint64  endSequence
  • bytes32 checkpointRoot
       ↓
Smart Contract anchorCheckpoint() (Immutable On-Chain Ledger)
```

---

## 3. Smart Contract Specification: `LogSentinelCheckpointRegistry.sol`

### Data Structures

```solidity
struct Checkpoint {
    bytes32 checkpointId;      // Deterministic unique checkpoint identifier
    bytes32 applicationId;     // Tenant or deployment application scope
    bytes32 serverCommitment;  // Privacy-safe server digest
    uint64 startSequence;      // Monotonic sequence start index (>= 1)
    uint64 endSequence;        // Monotonic sequence end index (>= startSequence)
    bytes32 checkpointRoot;    // Cryptographic root commitment
    uint64 createdAt;          // Block timestamp when anchored
    address submitter;         // Authorized account that anchored the record
}
```

### Core Methods

| Method | Access | Description |
| :--- | :--- | :--- |
| `anchorCheckpoint(...)` | Authorized Submitter / Owner | Commits a new sequence range to the ledger. Validates parameters, range ordering, and checks for collisions. |
| `getCheckpoint(bytes32 id)` | Public View | Retrieves the stored `Checkpoint` struct by ID. Reverts if not found. |
| `getLatestCheckpoint(bytes32 serverCommitment)` | Public View | Returns the most recently anchored checkpoint for a server commitment. |
| `getLatestCheckpointId(bytes32 serverCommitment)` | Public View | Returns the latest checkpoint ID for a server commitment. |
| `checkpointExists(bytes32 id)` | Public View | Returns `true` if a checkpoint ID exists in the registry. |
| `setAuthorizedSubmitter(address, bool)` | Owner Only | Grants or revokes permission for backend submitter addresses to anchor checkpoints. |
| `transferOwnership(address)` | Owner Only | Safely transfers contract ownership to a new account. |

### Security Invariants & Custom Errors

1. **Zero-Value Protection (`InvalidZeroCommitment`):** Reverts if `checkpointId`, `applicationId`, `serverCommitment`, or `checkpointRoot` is `bytes32(0)`.
2. **Monotonic Bounds (`InvalidSequenceRange`):** Reverts if `startSequence == 0` or `endSequence < startSequence`.
3. **Idempotent Replay Prevention (`CheckpointAlreadyExists`):** Reverts if a checkpoint with the identical `checkpointId` is submitted again.
4. **Collision & Conflict Prevention (`ConflictingRangeCommitment`):** The contract maintains an internal mapping `keccak256(serverCommitment, startSequence, endSequence) => checkpointRoot`. If an attacker attempts to re-anchor the same range with a different root, the contract immediately reverts.
5. **Access Control (`UnauthorizedCaller`):** Only authorized addresses can invoke state-changing mutations.

---

## 4. Local Development & Deployment

### Dependencies
- Solidity `^0.8.24`
- Hardhat `^2.22.18`
- OpenZeppelin Contracts `^5.2.0`
- Ethers.js `^6.13.5`

### 1. Compile the Contracts
```bash
npm run compile
```

### 2. Run the Hardhat Unit Test Suite
```bash
npm test
```
*Executes 11 automated test cases verifying access control, ownership transfer, range validation, replay prevention, and range collision guards.*

### 3. Start Local Ethereum Node
```bash
npm run node
# Spawns JSON-RPC node on http://127.0.0.1:8545 (Chain ID: 31337)
```

### 4. Deploy Checkpoint Registry to Local Node
```bash
npm run deploy:local
```
Deployment outputs contract address, deployer balance, block number, and persists metadata to:
`blockchain/deployments/localhost.json`.

---

## 5. Verification Flow & Audit Engine

Independent verification is executed via `POST /api/integrity/servers/:serverId/checkpoints/:checkpointId/verify`:
1. Backend queries `LogSentinelCheckpointRegistry.getCheckpoint(checkpointId)` on the blockchain via ethers.js.
2. Reads the immutable `onChainRoot`.
3. Fetches the exact sequence records from MongoDB (`startSequence` to `endSequence`).
4. Re-computes RFC 8785 canonical serialization and SHA-256 hash chaining locally.
5. Derives `recomputedRoot` and strictly asserts `onChainRoot === recomputedRoot`.
6. Generates a verifiable audit verdict:
   - **`VERIFIED`**: Exact cryptographic match (100% Identical).
   - **`MISMATCH`**: Alteration or database forgery detected.
   - **`INCOMPLETE`**: History sequence missing or gapped.
   - **`UNANCHORED`**: Record not found on smart contract.
   - **`UNAVAILABLE`**: Blockchain RPC unreachable.
