# LogSentinel — REST API Reference Specification

**Base API URL:** `/api`  
**Authentication:** Cookie-based session (`logsentinel.sid`) with CSRF protection (`X-CSRF-Token`) for browser clients, or `Authorization: Bearer <col_sec_...>` for collector daemons.  
**Version:** 1.0.0

---

## 1. Authentication & Session Management (`/api/auth`)

### `GET /api/auth/csrf-token`
* **Access:** Public
* **Description:** Issues a 64-character hex CSRF token and sets `XSRF-TOKEN` cookie.
* **Response (200):**
  ```json
  { "csrfToken": "a1b2c3d4..." }
  ```

### `POST /api/auth/signup`
* **Access:** Public (Rate-limited: 15 req / 15 min)
* **Description:** Registers a new user account. Role is strictly assigned as non-admin (`Viewer`).
* **Request Body:**
  ```json
  { "name": "Security Analyst", "email": "analyst@company.com", "password": "SecurePassword123!" }
  ```
* **Response (201):** Returns safe user profile object.

### `POST /api/auth/login`
* **Access:** Public (Rate-limited: 15 req / 15 min)
* **Description:** Authenticates user credentials, regenerates session ID, and issues session cookie.
* **Request Body:**
  ```json
  { "email": "admin@logsentinel.local", "password": "AdminPassword2026!" }
  ```

### `POST /api/auth/logout`
* **Access:** Authenticated
* **Description:** Destroys session in MongoDB and clears session cookie.

### `GET /api/auth/me`
* **Access:** Authenticated
* **Description:** Returns the currently authenticated user's profile. Excludes `passwordHash`.

---

## 2. Server Fleet Management (`/api/servers`)

### `GET /api/servers`
* **Access:** Authenticated (Scoped strictly to `ownerId`)
* **Description:** Lists all registered servers with live health and chain head sequences.

### `POST /api/servers`
* **Access:** Admin only (Requires CSRF)
* **Description:** Registers a new infrastructure server node.
* **Request Body:**
  ```json
  {
    "serverName": "PROD-INGRESS-01",
    "hostname": "ingress.company.internal",
    "os": "Linux (Ubuntu 24.04 LTS)",
    "environment": "Production",
    "description": "Primary edge gateway."
  }
  ```

### `GET /api/servers/:id`
* **Access:** Authenticated (Owner scoped)
* **Description:** Returns detailed configuration, telemetry state, and latest verification verdict.

### `POST /api/servers/:id/enrollment-token`
* **Access:** Admin only (Requires CSRF)
* **Description:** Generates a single-use enrollment token valid for 15 minutes.
* **Response (201):**
  ```json
  { "success": true, "enrollmentToken": "tok_sec_..." }
  ```

### `POST /api/servers/:id/rotate-credential`
* **Access:** Admin only (Requires CSRF)
* **Description:** Rotates credentials, immediately revoking the previous collector secret.

### `DELETE /api/servers/:id`
* **Access:** Admin only (Requires CSRF)
* **Description:** Deletes server and cascades deletion across its logs, integrity records, and alerts.

---

## 3. Collector Ingestion & Heartbeat (`/api/collector`)

### `POST /api/collector/enroll`
* **Access:** Public (Requires valid enrollment token; Rate-limited)
* **Description:** Exchanges a single-use enrollment token for a permanent collector secret.
* **Request Body:**
  ```json
  { "token": "tok_sec_...", "serverId": "srv_12345" }
  ```
* **Response (200):**
  ```json
  { "success": true, "credential": "col_sec_...", "credentialVersion": 2 }
  ```

### `POST /api/collector/logs`
* **Access:** Collector Authentication (`X-Server-Id` + `Authorization: Bearer <credential>`)
* **Description:** Ingests a batch of normalized log events (max 500 per batch).
* **Request Body:**
  ```json
  {
    "batchId": "batch_98765",
    "events": [
      { "eventId": "evt_001", "source": "/var/log/syslog", "message": "System booted", "observedAt": "2026-10-13T06:00:00Z" }
    ]
  }
  ```
* **Response (200):**
  ```json
  { "success": true, "acceptedCount": 1, "duplicateCount": 0, "chainHeadSequence": 1, "chainHeadHash": "a1b2..." }
  ```

### `POST /api/collector/heartbeat`
* **Access:** Collector Authentication
* **Description:** Records real-time collector daemon health telemetry.

---

## 4. Tamper-Evident Integrity Engine (`/api/integrity`)

### `GET /api/integrity/servers/:serverId/summary`
* **Access:** Authenticated
* **Description:** Returns the server's chain head sequence, chain head hash, and last audit verdict.

### `GET /api/integrity/servers/:serverId/events`
* **Access:** Authenticated (Supports pagination: `?page=1&limit=50&fromSequence=1&toSequence=100`)
* **Description:** Returns immutable integrity records with sequence numbers and SHA-256 event hashes.

### `POST /api/integrity/servers/:serverId/verify`
* **Access:** Admin & Security Analyst
* **Description:** Executes deterministic zero-trust recomputation of the SHA-256 hash-chain.
* **Response (200):**
  ```json
  {
    "status": "VERIFIED",
    "recordsChecked": 50,
    "findings": []
  }
  ```

---

## 5. Blockchain Checkpoint Registry (`/api/blockchain` & `/api/integrity`)

### `GET /api/blockchain/status`
* **Access:** Authenticated
* **Description:** Returns JSON-RPC node status, connected network, contract address, and signer address.

### `POST /api/integrity/servers/:serverId/checkpoints`
* **Access:** Admin only
* **Description:** Constructs a deterministic Merkle checkpoint commitment and submits it to Ethereum.
* **Request Body:**
  ```json
  { "startSequence": 1, "endSequence": 50 }
  ```

### `GET /api/integrity/servers/:serverId/checkpoints`
* **Access:** Authenticated
* **Description:** Lists all anchored checkpoints for the server with transaction receipts and block numbers.

### `POST /api/integrity/servers/:serverId/checkpoints/:checkpointId/verify`
* **Access:** Admin & Security Analyst
* **Description:** Compares the MongoDB local records against the immutable smart contract on-chain root.

---

## 6. Security Alerts Center (`/api/alerts`)

### `GET /api/alerts`
* **Access:** Authenticated (Supports filters: `?status=OPEN&severity=CRITICAL&search=...`)
* **Description:** Returns deduplicated active security alerts and anomaly detections.

### `POST /api/alerts/:id/acknowledge`
* **Access:** Admin & Security Analyst
* **Description:** Transitions alert lifecycle state from `OPEN` to `ACKNOWLEDGED`.

### `POST /api/alerts/:id/resolve`
* **Access:** Admin & Security Analyst
* **Description:** Resolves an alert. Requires `{ "resolutionNotes": "..." }`.

---

## 7. Controlled Attack Simulator (`/api/simulations`)

### `GET /api/simulations`
* **Access:** Authenticated
* **Description:** Lists available red-team attack scenarios and previous simulation run history.

### `POST /api/simulations/:scenario/run`
* **Access:** Admin only (Forbidden in production without `ALLOW_ATTACK_SIMULATION=true`)
* **Description:** Runs a controlled attack drill against an isolated disposable fixture server.
* **Scenarios:** `modify_event_payload`, `delete_event_record`, `break_chain_link`, `alter_event_hash`, `simulate_stale_collector`, `simulate_rpc_outage`, `checkpoint_mismatch_simulation`.

---

## 8. Sentinel AI Investigation Engine (`/api/ai`)

### `GET /api/ai/status`
* **Access:** Authenticated
* **Description:** Reports AI provider readiness, model name, and timeout bounds without leaking secrets.

### `POST /api/ai/investigate`
* **Access:** Admin & Security Analyst
* **Description:** Runs an autonomous evidence-linked investigation through LangGraph.
* **Request Body:**
  ```json
  {
    "serverId": "srv_demo_01",
    "question": "Investigate root cause of recent hash chain warnings and SSH activity.",
    "startTime": "2026-10-13T00:00:00Z",
    "endTime": "2026-10-13T06:00:00Z"
  }
  ```
* **Response (200):**
  ```json
  {
    "success": true,
    "analysis": {
      "analysisId": "anl_98765",
      "executiveSummary": "...",
      "confidenceScore": 92,
      "findings": [ ... ],
      "authoritativeVerdicts": { "integrityStatus": "VERIFIED", "blockchainStatus": "VERIFIED" }
    }
  }
  ```

### `GET /api/ai/analyses`
* **Access:** Authenticated
* **Description:** Returns paginated historical AI investigation reports.

### `POST /api/ai/analyses/:id/feedback`
* **Access:** Admin & Security Analyst
* **Description:** Records analyst feedback (`HELPFUL`, `ACCURATE`, `FALSE_POSITIVE`, `UNHELPFUL`).
