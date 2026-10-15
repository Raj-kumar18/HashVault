import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore in environments where not supported
}

import { StructuredAnalysisSchema } from './schemas.js';

/**
 * AI Provider Layer for Sentinel AI
 * Supports Groq AI (blazing-fast open-source inference), OpenAI, Google GenAI,
 * and high-performance deterministic fallback intelligence.
 */

export function getAiConfig() {
  const envProvider = (process.env.AI_PROVIDER || '').toLowerCase();
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  let provider = envProvider;
  if (!provider) {
    if (apiKey.startsWith('gsk_')) {
      provider = 'groq';
    } else {
      provider = 'groq';
    }
  }

  let defaultModel = 'openai/gpt-oss-120b';
  if (provider === 'google') defaultModel = 'gemini-1.5-flash';
  else if (provider === 'openai') defaultModel = 'gpt-4o-mini';
  else if (provider === 'groq') defaultModel = 'openai/gpt-oss-120b';

  const model = process.env.AI_MODEL || defaultModel;
  const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS, 10) || 30000;
  const maxRetries = parseInt(process.env.AI_MAX_RETRIES, 10) || 2;
  const maxEvidenceItems = parseInt(process.env.AI_MAX_EVIDENCE_ITEMS, 10) || 100;

  const isConfigured = Boolean(apiKey || provider === 'mock');

  return {
    provider,
    model,
    apiKey,
    timeoutMs,
    maxRetries,
    maxEvidenceItems,
    isConfigured,
  };
}

/**
 * Returns safe provider readiness status without leaking keys or specific model identities.
 */
export function getAiProviderStatus() {
  const config = getAiConfig();
  return {
    ready: config.isConfigured,
    provider: 'Sentinel AI',
    model: 'Sentinel Autonomous Core',
    maxEvidenceItems: config.maxEvidenceItems,
    timeoutMs: config.timeoutMs,
    supportedProviders: ['Sentinel AI'],
  };
}

/**
 * Builds deterministic fallback intelligence from actual telemetry.
 * Used when running in mock mode, during CI/tests, or when external AI is unconfigured.
 */
export function generateDeterministicIntelligence({
  question,
  server,
  logs,
  alerts,
  integrity,
  blockchain,
  collectorStatus,
  timeRange,
}) {
  const findings = [];
  const timeline = [];
  let riskLevel = 'LOW';
  let impactDescription = 'Normal telemetry operations observed with no verified security anomalies.';

  // 1. Evaluate Authoritative Cryptographic Integrity
  if (integrity.status === 'TAMPERED') {
    riskLevel = 'CRITICAL';
    impactDescription = 'Cryptographic hash-chain discontinuity detected. Potential retroactive log manipulation or event deletion.';
    const firstMismatch = integrity.findings?.[0];

    findings.push({
      id: 'fnd_integrity_tamper',
      title: 'Cryptographic Hash-Chain Verification Discontinuity',
      severity: 'CRITICAL',
      observedFacts: [
        `Deterministic SHA-256 hash-chain verification status returned TAMPERED across sequence range [${integrity.range?.[0] || 1}..${integrity.range?.[1] || integrity.totalEventsInChain}].`,
        firstMismatch?.message || 'Sequence gap or invalid hash link detected in ledger history.',
        `Chain head hash: ${integrity.chainHeadHash || 'UNAVAILABLE'}.`,
      ],
      supportingEvidenceRefs: firstMismatch?.sequenceNumber
        ? [`integrity:${firstMismatch.sequenceNumber}`]
        : [`server:${server.serverId}`],
      interpretation: 'The mathematical hash chain has been broken. This indicates either direct database manipulation bypassing the ingestion pipeline or severe sequence loss.',
      alternativeExplanations: 'Database storage corruption or unsynchronized restore from an out-of-order snapshot.',
      recommendedNextStep: 'Quarantine server ingestion keys, preserve database forensics image, and verify against immutable Ethereum blockchain checkpoints.',
    });
  } else if (integrity.status === 'VERIFIED') {
    findings.push({
      id: 'fnd_integrity_valid',
      title: 'Immutable SHA-256 Hash Chain Verified',
      severity: 'LOW',
      observedFacts: [
        `All ${integrity.recordsChecked || integrity.totalEventsInChain || 0} event hashes in the analyzed range match mathematical RFC 8785 canonical commitments.`,
        'Zero sequence gaps or altered previousHash links discovered.',
      ],
      supportingEvidenceRefs: [`server:${server.serverId}`],
      interpretation: 'Log integrity remains intact throughout the evaluated chronological window.',
      alternativeExplanations: 'None. Verification is mathematically deterministic.',
      recommendedNextStep: 'Continue standard telemetry ingestion monitoring.',
    });
  }

  // 2. Evaluate Blockchain Anchoring
  if (blockchain.status === 'VERIFIED') {
    findings.push({
      id: 'fnd_blockchain_anchor',
      title: 'Ethereum Smart Contract Anchor Validated',
      severity: 'LOW',
      observedFacts: [
        `Root commitment verified against Sepolia contract. Total checkpoints checked: ${blockchain.checkpointCount}.`,
      ],
      supportingEvidenceRefs: blockchain.checkpoints?.[0]?.checkpointId
        ? [`checkpoint:${blockchain.checkpoints[0].checkpointId}`]
        : [`server:${server.serverId}`],
      interpretation: 'The local cryptographic ledger matches third-party smart contract state anchors.',
      alternativeExplanations: 'None. Contract state verified directly via RPC.',
      recommendedNextStep: 'Maintain regular hourly checkpoint submissions.',
    });
  } else if (blockchain.status === 'UNANCHORED') {
    findings.push({
      id: 'fnd_blockchain_unanchored',
      title: 'Telemetry History Pending Blockchain Anchor',
      severity: 'MEDIUM',
      observedFacts: [
        'No on-chain checkpoint has been confirmed for the evaluated time window.',
      ],
      supportingEvidenceRefs: [`server:${server.serverId}`],
      interpretation: 'Recent logs are authenticated via local hash-chaining but have not yet completed the hourly on-chain rollup cycle.',
      alternativeExplanations: 'Checkpoint submission window is currently open or scheduled for next batch cycle.',
      recommendedNextStep: 'Monitor next scheduled checkpoint batch run or trigger manual anchoring via Admin console.',
    });
  } else if (blockchain.status === 'UNAVAILABLE') {
    findings.push({
      id: 'fnd_blockchain_rpc_down',
      title: 'Blockchain RPC Provider Unavailable',
      severity: 'MEDIUM',
      observedFacts: [
        'The configured Ethereum RPC node timed out or refused connection during checkpoint lookup.',
      ],
      supportingEvidenceRefs: [`server:${server.serverId}`],
      interpretation: 'Operational RPC network impairment. Logs are NOT considered tampered solely due to RPC unavailability.',
      alternativeExplanations: 'Ethereum network congestion, rate limiting, or gateway connectivity outage.',
      recommendedNextStep: 'Verify RPC node provider status and retry verification once network recovers.',
    });
  }

  // 3. Evaluate Alerts
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL');
  const highAlerts = alerts.filter((a) => a.severity === 'HIGH');

  if (criticalAlerts.length > 0) {
    riskLevel = 'CRITICAL';
    impactDescription = 'Multiple critical security alerts active on target workstation fleet.';
    findings.push({
      id: 'fnd_critical_alerts',
      title: `Critical Alert Convergence (${criticalAlerts.length} Active)`,
      severity: 'CRITICAL',
      observedFacts: criticalAlerts.map(
        (a) => `[${a.alertType}] ${a.title} detected at ${new Date(a.detectedAt).toISOString()}`
      ),
      supportingEvidenceRefs: criticalAlerts.map((a) => `alert:${a.alertId}`),
      interpretation: 'The system has escalated active critical conditions requiring immediate containment.',
      alternativeExplanations: 'Multiple unrelated system failures coincidentally triggering simultaneously.',
      recommendedNextStep: 'Acknowledge alerts in SOC console and initiate incident triage protocol.',
    });
  } else if (highAlerts.length > 0 && riskLevel !== 'CRITICAL') {
    riskLevel = 'HIGH';
    impactDescription = 'High severity security indicators identified requiring analyst review.';
    findings.push({
      id: 'fnd_high_alerts',
      title: `Elevated Security Alerts (${highAlerts.length} Flagged)`,
      severity: 'HIGH',
      observedFacts: highAlerts.map(
        (a) => `[${a.alertType}] ${a.title} (alertId: ${a.alertId})`
      ),
      supportingEvidenceRefs: highAlerts.map((a) => `alert:${a.alertId}`),
      interpretation: 'Behavioral anomalies or collector dropouts detected on host.',
      alternativeExplanations: 'Scheduled maintenance or network transition.',
      recommendedNextStep: 'Inspect collector daemon logs and verify host network route.',
    });
  }

  // 4. Build Chronological Attack Timeline from Real Telemetry
  const combinedTimelineEvents = [];

  for (const log of logs) {
    combinedTimelineEvents.push({
      timestamp: new Date(log.observedAt),
      evidenceRef: `log:${log.eventId}`,
      factualDescription: `[seq #${log.sequenceNumber || 'N/A'}] ${log.source}: ${log.message.slice(0, 150)}`,
      source: log.source || 'collector',
      interpretation: log.message.toLowerCase().includes('fail')
        ? 'Authentication or process failure event'
        : 'Telemetry event ingested and hash-chained',
    });
  }

  for (const alert of alerts) {
    combinedTimelineEvents.push({
      timestamp: new Date(alert.detectedAt),
      evidenceRef: `alert:${alert.alertId}`,
      factualDescription: `[ALERT: ${alert.severity}] ${alert.title}`,
      source: 'monitoring_engine',
      interpretation: alert.description?.slice(0, 150) || 'Automated rule triggered',
    });
  }

  // Sort chronological strictly
  combinedTimelineEvents.sort((a, b) => a.timestamp - b.timestamp);

  // Take top 25 chronologically representative events
  const selectedTimeline = combinedTimelineEvents.slice(0, 25);

  // 5. Build Executive Summary
  const executiveSummary = `Sentinel AI evaluated ${logs.length} log events and ${alerts.length} alerts for host ${server.serverName} (${server.hostname}) within the window ${new Date(timeRange.startTime).toISOString()} to ${new Date(timeRange.endTime).toISOString()}. Investigation inquiry: "${question}". Cryptographic hash-chain status is ${integrity.status}. Blockchain anchor registry status is ${blockchain.status}. Overall fleet risk is assessed as ${riskLevel}.`;

  const recommendedInvestigationSteps = [
    'Cross-reference server IP and auth telemetry against active directory logs.',
    'Review collector connection status and verify daemon process PID on host.',
    'Inspect correlated alert timeline for preceding privilege escalation markers.',
  ];

  if (integrity.status === 'TAMPERED') {
    recommendedInvestigationSteps.unshift('Execute cold offline memory snapshot and isolate host network interface.');
  }

  const missingEvidenceAndLimitations = [];
  if (logs.length === 0) {
    missingEvidenceAndLimitations.push('No application or system log events were ingested for this server during the selected time range.');
  }
  if (blockchain.status === 'UNAVAILABLE') {
    missingEvidenceAndLimitations.push('Blockchain RPC status was unavailable during analysis; external anchoring could not be independently corroborated.');
  }
  if (alerts.length === 0) {
    missingEvidenceAndLimitations.push('No monitoring alerts matched the specified window.');
  }

  return {
    executiveSummary,
    overallRiskLevel: riskLevel,
    confidenceLevel: logs.length > 0 || alerts.length > 0 ? 90 : 65,
    confidenceExplanation: 'Calibrated based on availability of RFC 8785 canonical hash-chain records and real-time monitoring engine alerts.',
    potentialImpact: impactDescription,
    findings,
    timeline: selectedTimeline,
    recommendedInvestigationSteps,
    missingEvidenceAndLimitations,
  };
}

/**
 * Invokes the configured AI model with structured output,
 * falling back to deterministic intelligence if external provider is absent or encounters error.
 */
export async function executeAiInvestigation({
  promptContent,
  rawTelemetryPackage,
}) {
  const config = getAiConfig();

  // If mock provider is explicitly selected or no external API key is provided, use deterministic engine
  if (config.provider === 'mock' || !config.apiKey) {
    return {
      output: generateDeterministicIntelligence(rawTelemetryPackage),
      providerUsed: 'Sentinel AI Engine',
      modelUsed: 'Sentinel Autonomous Core',
    };
  }

  // When external provider is configured (Groq / OpenAI / Google)
  try {
    let result;

    if (config.provider === 'groq') {
      const { ChatOpenAI } = await import('@langchain/openai');
      const modelInstance = new ChatOpenAI({
        apiKey: config.apiKey,
        modelName: config.model || 'openai/gpt-oss-120b',
        configuration: {
          baseURL: 'https://api.groq.com/openai/v1',
        },
        temperature: 0.1,
        maxRetries: config.maxRetries || 2,
        timeout: config.timeoutMs || 30000,
        modelKwargs: {
          response_format: { type: 'json_object' },
        },
      });

      const systemPrompt = `You are Sentinel AI, the autonomous security intelligence analyst in LogSentinel.
Mission: Turn raw security telemetry, cryptographic verification states, and alerts into clear, evidence-backed, human-readable security intelligence.

You MUST produce a comprehensive, structured security incident report in STRICT valid JSON format matching this schema:
{
  \"executiveSummary\": \"A clear, well-written executive summary (at least 2-3 sentences) detailing host status, whether log tampering occurred, alert correlations, and overall security posture.\",
  \"overallRiskLevel\": \"LOW\" | \"MEDIUM\" | \"HIGH\" | \"CRITICAL\",
  \"confidenceLevel\": 88,
  \"confidenceExplanation\": \"Explanation of analytical confidence grounded in deterministic cryptographic verification.\",
  \"potentialImpact\": \"Clear assessment of potential fleet impact or operational threat.\",
  \"findings\": [
    {
      \"id\": \"fnd_1\",
      \"title\": \"Clear finding headline\",
      \"severity\": \"LOW\" | \"MEDIUM\" | \"HIGH\" | \"CRITICAL\",
      \"observedFacts\": [\"Fact 1\", \"Fact 2\"],
      \"supportingEvidenceRefs\": [\"ref1\"],
      \"interpretation\": \"Clear explanation of what this means in plain English\",
      \"alternativeExplanations\": \"Any plausible benign explanation\",
      \"recommendedNextStep\": \"Immediate actionable SOC recommendation\"
    }
  ],
  \"timeline\": [
    {
      \"timestamp\": \"ISO-8601 string\",
      \"evidenceRef\": \"ref tag\",
      \"factualDescription\": \"Plain English factual description\",
      \"source\": \"collector | monitoring_engine | auth_daemon | system\",
      \"interpretation\": \"Contextual meaning of the event\"
    }
  ],
  \"recommendedInvestigationSteps\": [
    \"Actionable step 1\",
    \"Actionable step 2\"
  ],
  \"missingEvidenceAndLimitations\": [
    \"Any limitation in collected evidence\"
  ]
}
Return ONLY valid JSON.`;

      const response = await modelInstance.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptContent },
      ]);

      const parsed = JSON.parse(response.content);

      result = {
        executiveSummary:
          parsed.executiveSummary || 'Security telemetry evaluated by Sentinel AI.',
        overallRiskLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(
          parsed.overallRiskLevel?.toUpperCase()
        )
          ? parsed.overallRiskLevel.toUpperCase()
          : 'LOW',
        confidenceLevel:
          typeof parsed.confidenceLevel === 'number'
            ? Math.min(100, Math.max(0, parsed.confidenceLevel))
            : 88,
        confidenceExplanation:
          parsed.confidenceExplanation ||
          'Grounded in deterministic SHA-256 hash-chain verification.',
        potentialImpact:
          parsed.potentialImpact || 'No uncontained lateral impact observed.',
        findings: Array.isArray(parsed.findings)
          ? parsed.findings.map((f, i) => ({
              id: f.id || `fnd_${i + 1}`,
              title: f.title || 'Security Telemetry Assessment',
              severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(
                f.severity?.toUpperCase()
              )
                ? f.severity.toUpperCase()
                : 'LOW',
              observedFacts: Array.isArray(f.observedFacts)
                ? f.observedFacts
                : [String(f.observedFacts || 'Observed telemetry event')],
              supportingEvidenceRefs: Array.isArray(f.supportingEvidenceRefs)
                ? f.supportingEvidenceRefs
                : [],
              interpretation: f.interpretation || '',
              alternativeExplanations: f.alternativeExplanations || '',
              recommendedNextStep: f.recommendedNextStep || 'Review server telemetry.',
            }))
          : [],
        timeline: Array.isArray(parsed.timeline)
          ? parsed.timeline.map((t) => ({
              timestamp: t.timestamp
                ? new Date(t.timestamp).toISOString()
                : new Date().toISOString(),
              evidenceRef: t.evidenceRef || null,
              factualDescription: t.factualDescription || 'Telemetry record',
              source: t.source || 'telemetry',
              interpretation: t.interpretation || null,
            }))
          : [],
        recommendedInvestigationSteps: Array.isArray(
          parsed.recommendedInvestigationSteps
        )
          ? parsed.recommendedInvestigationSteps
          : ['Review server status and verify collector heartbeat continuity.'],
        missingEvidenceAndLimitations: Array.isArray(
          parsed.missingEvidenceAndLimitations
        )
          ? parsed.missingEvidenceAndLimitations
          : [],
      };

      return {
        output: result,
        providerUsed: 'Sentinel AI Engine',
        modelUsed: 'Sentinel Autonomous Core',
      };
    } else if (config.provider === 'openai') {
      const { ChatOpenAI } = await import('@langchain/openai');
      const modelInstance = new ChatOpenAI({
        apiKey: config.apiKey,
        modelName: config.model,
        temperature: 0.1,
        maxRetries: config.maxRetries,
        timeout: config.timeoutMs,
      });
      const structuredLlm = modelInstance.withStructuredOutput(StructuredAnalysisSchema);
      const res = await structuredLlm.invoke(promptContent);
      return {
        output: res,
        providerUsed: 'Sentinel AI Engine',
        modelUsed: 'Sentinel Autonomous Core',
      };
    } else if (config.provider === 'google') {
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
      const modelInstance = new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        modelName: config.model,
        temperature: 0.1,
        maxRetries: config.maxRetries,
      });
      const structuredLlm = modelInstance.withStructuredOutput(StructuredAnalysisSchema);
      const res = await structuredLlm.invoke(promptContent);
      return {
        output: res,
        providerUsed: 'Sentinel AI Engine',
        modelUsed: 'Sentinel Autonomous Core',
      };
    } else {
      return {
        output: generateDeterministicIntelligence(rawTelemetryPackage),
        providerUsed: 'Sentinel AI Engine',
        modelUsed: 'Sentinel Autonomous Core',
      };
    }
  } catch (error) {
    console.warn(`[Sentinel AI] Provider error: ${error.message}. Falling back to deterministic engine.`);
    return {
      output: generateDeterministicIntelligence(rawTelemetryPackage),
      providerUsed: 'Sentinel AI Engine',
      modelUsed: 'Sentinel Autonomous Core',
      fallbackNotice: `Provider encountered: ${error.message}`,
    };
  }
}
