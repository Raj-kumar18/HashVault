# LogSentinel — Hackathon Live Demo Runbook & Script

**Tagline:** Every Log. Verifiable Trust.  
**Target Audience:** Hackathon Judges, Security Architects, DevOps Engineers  
**Demo Duration:** 5–7 Minutes  
**Prerequisites:** Backend running on `http://localhost:5001`, Frontend running on `http://localhost:5173`, MongoDB connected.

---

## 0. Pre-Demo Setup (1-Minute Preparation)

Before taking the stage, run the automated seed script to bootstrap clean test accounts and demo servers:

```bash
# 1. Seed demo environment with Admin, Analyst, and sample server
npm run seed:demo
```

### Credentials Ready:
* **Admin Login:** `admin@logsentinel.local` / `LogSentinel@Admin2026`
* **Analyst Login:** `analyst@logsentinel.local` / `LogSentinel@Analyst2026`

---

## 1. Demo Narrative: The 5-Minute Incident Lifecycle

### ACT 1: Establish the Trust Pipeline (Scenario A — 90 Seconds)

**What to Say:**
> *"Judges, in almost every modern breach—from SolarWinds to cloud credential thefts—the first thing an attacker does after gaining root access is modify or wipe `/var/log` to cover their tracks. Centralized SIEMs fail because whoever holds database or root credentials can edit records without leaving a trace.*  
> *LogSentinel solves this with mathematically verifiable logging."*

**What to Do in the UI:**
1. Open `http://localhost:5173/login`.
2. Sign in as Admin (`admin@logsentinel.local`).
3. Land on **Security Overview** (`/`):
   * Point out the **real-time metrics**: Enrolled Collectors, Sealed Log Events, Blockchain Anchors.
4. Navigate to **Server Fleet** (`/servers`):
   * Show the enrolled node `DEMO-GATEWAY-01`.
   * Click **Inspect Details** (`/servers/:id`):
   * Point out the **Chain Head Sequence: #10** and the **Chain Head SHA-256 Hash**.
5. Navigate to **Logs Explorer** (`/logs`):
   * Show the 10 real persisted logs (Systemd, SSH logins, AppArmor profile loads).
   * Expand a log line to show the exact RFC 8785 canonical hash and previous hash link.

---

### ACT 2: Cryptographic Verification & Blockchain Anchoring (Scenario B — 60 Seconds)

**What to Say:**
> *"Every log is chained to the previous one using SHA-256. But what if a rogue database administrator alters the MongoDB database itself? That's where our Ethereum smart contract comes in."*

**What to Do in the UI:**
1. Navigate to **Integrity Explorer** (`/integrity`):
   * Select `DEMO-GATEWAY-01`.
   * Click **"Run Full Chain Verification"**.
   * Show the green **VERIFIED** badge: 10/10 records mathematically validated in under 15ms.
2. Navigate to **Blockchain Registry** (`/checkpoints`):
   * Show Checkpoint #1 covering sequences #1 to #5.
   * Point out:
     * **Transaction Hash:** `0x...`
     * **Merkle Root Commitment:** `0x...`
     * **On-Chain Status:** `CONFIRMED`
   * Click **"Anchor New Checkpoint"**:
     * Watch it automatically pre-fill the next range (#6 to #10).
     * Click **"Anchor to Blockchain"** to seal the next batch.
   * Click **"Verify On-Chain"** to demonstrate independent RPC query comparing the database state directly against the smart contract.

---

### ACT 3: Catching an Attacker in the Act (Scenario C — 90 Seconds)

**What to Say:**
> *"Now let's simulate a sophisticated attack. An attacker gains database access and modifies a historical SSH login log to hide their intrusion."*

**What to Do in the UI:**
1. Navigate to **Monitoring & Drills** (`/monitoring`):
   * Point out the **Controlled Attack Simulator** tab.
   * Highlight that simulations run against isolated, disposable test fixtures so production logs are never modified.
2. Select **"Modify Historical Log Payload (Database Tampering)"**.
3. Click **"Launch Simulation"** and confirm **"Execute Drill"**:
   * Watch the engine execute the tamper drill.
   * **Result:** **TRAP DETECTED!**
   * Point out the exact diagnostic:
     * Expected Finding: `HASH_MISMATCH`
     * Recomputed SHA-256 hash diverged from the sealed record.
4. Also highlight the other scenarios available:
   * Record Deletion (`SEQUENCE_GAP`)
   * Previous Hash pointer corruption (`BROKEN_CHAIN_LINK`)
   * RPC node outages classified honestly as `BLOCKCHAIN_UNAVAILABLE` (operational warning, not false tampering).

---

### ACT 4: Sentinel AI Incident Investigation (Scenario D — 60 Seconds)

**What to Say:**
> *"Security analysts don't have hours to manually inspect hex hashes. Sentinel AI is our autonomous investigative assistant built on LangGraph."*

**What to Do in the UI:**
1. Navigate to **Sentinel AI** (`/ai`):
2. Select `DEMO-GATEWAY-01` and enter the prompt:
   > *"Investigate recent integrity warnings, SSH activity, and verify smart contract commitments."*
3. Click **"Run Investigation"**:
   * Point out the structured analysis generated:
     * **Executive Summary:** Clear risk assessment.
     * **Confidence Score:** e.g. 95%.
     * **Evidence-Linked Findings:** Every finding cites a verifiable log, alert, or checkpoint ID.
     * **Data Minimization:** Note that all passwords, bearer tokens, and private keys were redacted before sending to the model.
   * **Crucial Soundbite:**
     > *"Notice that LogSentinel separates AI interpretation from cryptographic proof: the verifier provides mathematical certainty; the AI provides investigative context."*

---

### ACT 5: Role-Based Access Control (Scenario E — 45 Seconds)

**What to Say:**
> *"Finally, least-privilege security is strictly enforced through our RBAC architecture."*

**What to Do in the UI:**
1. Click **Log Out** in TopNav.
2. Sign in as the Security Analyst:
   * Email: `analyst@logsentinel.local`
   * Password: `LogSentinel@Analyst2026`
3. Notice that the Analyst can:
   * View all logs, search alerts, and inspect integrity verifications.
4. But when the Analyst views servers:
   * **"Delete Server"** and **"Rotate Credentials"** buttons are disabled or hidden.
   * In Monitoring, the **Attack Simulator** is strictly restricted (non-admins receive HTTP 403 Forbidden).

---

## 2. Key Answers for Technical Judges

| Question from Judge | Recommended Answer |
| :--- | :--- |
| **"Doesn't storing logs on blockchain cost too much gas?"** | *"We never store raw logs on-chain. We batch 50 to 500 logs into a single 32-byte Merkle root commitment. One transaction seals hundreds of thousands of events, costing pennies in gas."* |
| **"What if the collector itself is killed?"** | *"Our autonomous monitoring engine tracks real-time collector heartbeats. If a collector goes silent for more than 90 seconds, a `COLLECTOR_STALE` alert is triggered immediately."* |
| **"Can the AI hallucinate an attack?"** | *"No, because our LangGraph validation node strictly enforces evidence reference integrity. An AI finding cannot be returned if it cites a phantom record that doesn't exist in our verified database."* |
| **"What if the Ethereum RPC node goes down?"** | *"LogSentinel handles network outages honestly: it flags `BLOCKCHAIN_UNAVAILABLE` as an operational warning, without falsely crying wolf about log tampering."* |
