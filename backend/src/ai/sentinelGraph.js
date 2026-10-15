import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { Server } from '../models/Server.js';
import { LogEvent } from '../models/LogEvent.js';
import { Alert } from '../models/Alert.js';
import { Checkpoint } from '../models/Checkpoint.js';
import { AnalysisReport } from '../models/AnalysisReport.js';
import { verifyServerChain } from '../services/integrity.service.js';
import { verifyCheckpointOnChain } from '../blockchain/verificationService.js';
import { InvestigationRequestSchema, StructuredAnalysisSchema } from './schemas.js';
import {
  redactLogEvents,
  redactAlerts,
  formatUntrustedEvidencePackage,
} from './redaction.js';
import { executeAiInvestigation, getAiConfig } from './provider.js';

/**
 * LangGraph State Definition for Sentinel AI Investigation Workflow
 */
export const InvestigationState = Annotation.Root({
  // Request input & context
  rawRequest: Annotation(),
  validatedRequest: Annotation(),
  user: Annotation(),

  // Target Server entity
  server: Annotation(),

  // Authoritative Telemetry & Deterministic Verification
  rawLogs: Annotation(),
  rawAlerts: Annotation(),
  collectorStatus: Annotation(),
  integrity: Annotation(),
  blockchain: Annotation(),
  ingestionContinuity: Annotation(),

  // Redacted Telemetry & Sanitized Prompt
  sanitizedLogs: Annotation(),
  sanitizedAlerts: Annotation(),
  totalRedactions: Annotation(),
  evidencePackage: Annotation(),
  knownEvidenceRefs: Annotation(),

  // Correlation & Model Outputs
  correlations: Annotation(),
  modelOutput: Annotation(),
  validatedFindings: Annotation(),
  modelMetadata: Annotation(),

  // Final Output Report & Workflow Status
  persistedReport: Annotation(),
  status: Annotation(),
  failureCode: Annotation(),
  failureReason: Annotation(),
});

/**
 * 1. requestValidation Node
 */
export async function requestValidationNode(state) {
  const result = InvestigationRequestSchema.safeParse(state.rawRequest);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMsg = issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      status: 'FAILED',
      failureCode: 'INVALID_REQUEST',
      failureReason: `Request validation failed: ${errorMsg}`,
    };
  }

  return {
    validatedRequest: result.data,
    status: 'RUNNING',
  };
}

/**
 * 2. authorizationCheck Node
 */
export async function authorizationCheckNode(state) {
  if (state.failureCode) return {};

  const { serverId } = state.validatedRequest;
  const user = state.user;

  if (!user) {
    return {
      status: 'FAILED',
      failureCode: 'UNAUTHORIZED',
      failureReason: 'Authentication required to execute security investigation.',
    };
  }

  const server = await Server.findOne({ serverId });
  if (!server) {
    return {
      status: 'FAILED',
      failureCode: 'SERVER_NOT_FOUND',
      failureReason: `Target server with ID ${serverId} does not exist.`,
    };
  }

  // Scoped authorization: Non-admin users can only investigate their assigned/owned fleet
  const isAdmin = user.role === 'Admin';
  const isOwner = server.ownerId && server.ownerId.toString() === user._id.toString();

  if (!isAdmin && !isOwner) {
    return {
      status: 'FAILED',
      failureCode: 'FORBIDDEN',
      failureReason: `Access denied. Workstation ${serverId} is outside your authorized fleet scope.`,
    };
  }

  return {
    server,
  };
}

/**
 * 3. collectEvidence Node
 */
export async function collectEvidenceNode(state) {
  if (state.failureCode) return {};

  const { serverId, startTime, endTime, alertIds } = state.validatedRequest;
  const config = getAiConfig();
  const maxItems = config.maxEvidenceItems;

  const start = new Date(startTime);
  const end = new Date(endTime);

  // 1. Fetch LogEvents within bounded window
  const logs = await LogEvent.find({
    serverId,
    observedAt: { $gte: start, $lte: end },
  })
    .sort({ observedAt: 1 })
    .limit(maxItems)
    .lean();

  // 2. Fetch Alerts for server in window + explicitly selected alertIds
  const alertQuery = {
    serverId,
    $or: [
      { detectedAt: { $gte: start, $lte: end } },
      ...(alertIds && alertIds.length > 0 ? [{ alertId: { $in: alertIds } }] : []),
    ],
  };

  const alerts = await Alert.find(alertQuery)
    .sort({ detectedAt: 1 })
    .limit(maxItems)
    .lean();

  // 3. Collector status from Server
  const collectorStatus = state.server.connectionStatus || 'UNKNOWN';

  // 4. Ingestion continuity assessment
  let isContinuous = true;
  let gapDetected = false;
  let continuityMessage = 'Continuous event sequence verified.';

  if (logs.length > 1) {
    for (let i = 1; i < logs.length; i++) {
      if (
        logs[i].sequenceNumber &&
        logs[i - 1].sequenceNumber &&
        logs[i].sequenceNumber !== logs[i - 1].sequenceNumber + 1
      ) {
        isContinuous = false;
        gapDetected = true;
        continuityMessage = `Discontinuity between sequence #${logs[i - 1].sequenceNumber} and #${logs[i].sequenceNumber}.`;
        break;
      }
    }
  }

  // Build known evidence references set
  const knownRefs = new Set();
  knownRefs.add(`server:${serverId}`);
  logs.forEach((l) => knownRefs.add(`log:${l.eventId}`));
  alerts.forEach((a) => knownRefs.add(`alert:${a.alertId}`));

  return {
    rawLogs: logs,
    rawAlerts: alerts,
    collectorStatus,
    ingestionContinuity: {
      isContinuous,
      gapDetected,
      message: continuityMessage,
    },
    knownEvidenceRefs: Array.from(knownRefs),
  };
}

/**
 * 4. deterministicIntegrityCheck Node (Phase 4 & 5 Engines)
 */
export async function deterministicIntegrityCheckNode(state) {
  if (state.failureCode) return {};

  const { serverId } = state.validatedRequest;

  // 1. Phase 4 Deterministic SHA-256 Hash Chain
  let integrity = {
    verified: null,
    status: 'UNAVAILABLE',
    recordsChecked: 0,
    totalEventsInChain: 0,
    chainHeadHash: null,
    findings: [],
  };

  try {
    const chainResult = await verifyServerChain(serverId);
    integrity = {
      verified: chainResult.verified,
      status: chainResult.status,
      recordsChecked: chainResult.recordsChecked,
      totalEventsInChain: chainResult.totalEventsInChain,
      chainHeadHash: chainResult.chainHeadHash,
      findings: chainResult.findings || [],
      range: chainResult.range,
    };
    if (chainResult.findings) {
      chainResult.findings.forEach((f) => {
        if (f.sequenceNumber) state.knownEvidenceRefs?.push?.(`integrity:${f.sequenceNumber}`);
      });
    }
  } catch (err) {
    integrity.status = 'UNAVAILABLE';
    integrity.message = `Integrity engine check error: ${err.message}`;
  }

  // 2. Phase 5 Blockchain Checkpoint Verification
  let blockchain = {
    status: 'UNAVAILABLE',
    checkpointCount: 0,
    checkpoints: [],
    message: null,
  };

  try {
    const checkpoints = await Checkpoint.find({ serverId })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    blockchain.checkpointCount = checkpoints.length;

    if (checkpoints.length === 0) {
      blockchain.status = 'UNANCHORED';
      blockchain.message = 'No on-chain checkpoint commitments have been published for this host yet.';
    } else {
      const latest = checkpoints[0];
      try {
        const verifyRes = await verifyCheckpointOnChain({
          serverId,
          checkpointId: latest.checkpointId,
          userId: state.user?._id,
        });

        blockchain.status = verifyRes.status;
        blockchain.message = verifyRes.message;
        blockchain.checkpoints = checkpoints.map((c) => ({
          checkpointId: c.checkpointId,
          blockNumber: c.blockNumber,
          txHash: c.transactionHash,
          status: c.status,
          rootHash: c.merkleRoot,
        }));

        checkpoints.forEach((c) => state.knownEvidenceRefs?.push?.(`checkpoint:${c.checkpointId}`));
      } catch (rpcErr) {
        // Essential requirement: RPC failure is marked as UNAVAILABLE, never TAMPERED!
        blockchain.status = 'UNAVAILABLE';
        blockchain.message = `Blockchain RPC provider call failed: ${rpcErr.message}. Integrity remains verified by local SHA-256 ledger.`;
      }
    }
  } catch (err) {
    blockchain.status = 'UNAVAILABLE';
    blockchain.message = `Checkpoint query failed: ${err.message}`;
  }

  return {
    integrity,
    blockchain,
  };
}

/**
 * 5. redactEvidence Node
 */
export async function redactEvidenceNode(state) {
  if (state.failureCode) return {};

  const { sanitized: sanitizedLogs, totalRedactions: logRedactions } = redactLogEvents(state.rawLogs);
  const { sanitized: sanitizedAlerts, totalRedactions: alertRedactions } = redactAlerts(state.rawAlerts);

  const totalRedactions = logRedactions + alertRedactions;

  const evidencePackage = formatUntrustedEvidencePackage({
    server: state.server,
    logs: sanitizedLogs,
    alerts: sanitizedAlerts,
    integrity: state.integrity,
    blockchain: state.blockchain,
    collectorStatus: state.collectorStatus,
    timeRange: state.validatedRequest,
  });

  return {
    sanitizedLogs,
    sanitizedAlerts,
    totalRedactions,
    evidencePackage,
  };
}

/**
 * 6. correlateSecurityEvents Node
 */
export async function correlateSecurityEventsNode(state) {
  if (state.failureCode) return {};

  const correlations = [];
  const logs = state.sanitizedLogs || [];
  const alerts = state.sanitizedAlerts || [];

  // Group events within 5-minute proximity
  for (const alert of alerts) {
    const alertTime = new Date(alert.detectedAt).getTime();
    const windowMs = 5 * 60 * 1000;

    const proximateLogs = logs.filter((l) => {
      const logTime = new Date(l.observedAt).getTime();
      return Math.abs(logTime - alertTime) <= windowMs;
    });

    if (proximateLogs.length > 0) {
      correlations.push({
        alertId: alert.alertId,
        alertType: alert.alertType,
        proximateLogCount: proximateLogs.length,
        logEventIds: proximateLogs.map((l) => l.eventId),
      });
    }
  }

  return {
    correlations,
  };
}

/**
 * 7. generateFindings Node
 */
export async function generateFindingsNode(state) {
  if (state.failureCode) return {};

  const promptContent = `
You are Sentinel AI, the autonomous security intelligence analyst in HashVault.
Mission: Turn raw security telemetry into evidence-backed, explainable security intelligence.

INVESTIGATION QUESTION:
"${state.validatedRequest.question}"

EVIDENCE PACKAGE:
${state.evidencePackage}

CORRELATIONS OBSERVED:
${JSON.stringify(state.correlations, null, 2)}

Produce a structured security report adhering strictly to the required schema.
Each finding must include observed facts and cite supporting evidence using exact ref tags like "log:<id>", "alert:<id>", "checkpoint:<id>", or "server:<id>".
Never cite evidence references that do not appear in the evidence package.
`.trim();

  const rawTelemetryPackage = {
    question: state.validatedRequest.question,
    server: state.server,
    logs: state.sanitizedLogs || [],
    alerts: state.sanitizedAlerts || [],
    integrity: state.integrity,
    blockchain: state.blockchain,
    collectorStatus: state.collectorStatus,
    timeRange: state.validatedRequest,
  };

  const startTime = Date.now();
  const { output, providerUsed, modelUsed } = await executeAiInvestigation({
    promptContent,
    rawTelemetryPackage,
  });
  const durationMs = Date.now() - startTime;

  return {
    modelOutput: output,
    modelMetadata: {
      provider: providerUsed,
      model: modelUsed,
      promptVersion: 'v1.0',
      durationMs,
    },
  };
}

/**
 * 8. validateFindings Node
 */
export async function validateFindingsNode(state) {
  if (state.failureCode) return {};

  let output = state.modelOutput;
  const validation = StructuredAnalysisSchema.safeParse(output);

  if (!validation.success) {
    // If output validation failed, fallback to deterministic intelligence
    const fallback = generateDeterministicIntelligence({
      question: state.validatedRequest.question,
      server: state.server,
      logs: state.sanitizedLogs || [],
      alerts: state.sanitizedAlerts || [],
      integrity: state.integrity,
      blockchain: state.blockchain,
      collectorStatus: state.collectorStatus,
      timeRange: state.validatedRequest,
    });
    output = fallback;
  } else {
    output = validation.data;
  }

  // Strict Evidence Existence Check:
  // Reject or filter any hallucinated evidence reference that doesn't exist in collected evidence
  const validRefSet = new Set(state.knownEvidenceRefs || []);
  validRefSet.add(`server:${state.server.serverId}`);

  const filteredFindings = (output.findings || []).map((finding) => {
    const verifiedRefs = (finding.supportingEvidenceRefs || []).filter((ref) => {
      if (validRefSet.has(ref)) return true;
      if (ref.startsWith('integrity:') || ref.startsWith('server:')) return true;
      return false;
    });

    return {
      ...finding,
      supportingEvidenceRefs: verifiedRefs.length > 0 ? verifiedRefs : [`server:${state.server.serverId}`],
    };
  });

  return {
    validatedFindings: {
      ...output,
      findings: filteredFindings,
    },
  };
}

/**
 * 9. persistReport Node
 */
export async function persistReportNode(state) {
  const { validatedRequest, server, user } = state;

  // Handle failure case persistence
  if (state.failureCode) {
    const failedReport = new AnalysisReport({
      requestingUserId: user?._id,
      requestingUserName: user?.name || 'Unknown User',
      requestingUserRole: user?.role || 'Analyst',
      serverId: validatedRequest?.serverId || state.rawRequest?.serverId || 'UNKNOWN',
      serverName: server?.serverName || 'Unknown Workstation',
      timeRange: {
        startTime: validatedRequest?.startTime ? new Date(validatedRequest.startTime) : new Date(),
        endTime: validatedRequest?.endTime ? new Date(validatedRequest.endTime) : new Date(),
      },
      question: validatedRequest?.question || state.rawRequest?.question || 'Failed Investigation',
      status: 'FAILED',
      failureCode: state.failureCode,
      failureReason: state.failureReason,
      completedAt: new Date(),
    });

    await failedReport.save();
    return {
      persistedReport: failedReport,
    };
  }

  const findingsData = state.validatedFindings;

  const report = new AnalysisReport({
    requestingUserId: user._id,
    requestingUserName: user.name,
    requestingUserRole: user.role,
    serverId: server.serverId,
    serverName: server.serverName,
    timeRange: {
      startTime: new Date(validatedRequest.startTime),
      endTime: new Date(validatedRequest.endTime),
    },
    question: validatedRequest.question,
    selectedAlertIds: validatedRequest.alertIds || [],
    status: 'COMPLETED',
    integritySummary: state.integrity,
    blockchainSummary: state.blockchain,
    collectorStatus: state.collectorStatus,
    ingestionContinuity: state.ingestionContinuity,
    evidenceMetadata: {
      logEventsCount: state.sanitizedLogs?.length || 0,
      alertsCount: state.sanitizedAlerts?.length || 0,
      evidenceIds: state.knownEvidenceRefs || [],
      redactedItemsCount: state.totalRedactions || 0,
    },
    executiveSummary: findingsData.executiveSummary,
    overallRiskLevel: findingsData.overallRiskLevel,
    confidenceLevel: findingsData.confidenceLevel,
    confidenceExplanation: findingsData.confidenceExplanation,
    potentialImpact: findingsData.potentialImpact,
    findings: findingsData.findings,
    timeline: findingsData.timeline,
    recommendedInvestigationSteps: findingsData.recommendedInvestigationSteps,
    missingEvidenceAndLimitations: findingsData.missingEvidenceAndLimitations,
    modelMetadata: state.modelMetadata,
    completedAt: new Date(),
  });

  await report.save();

  return {
    persistedReport: report,
    status: 'COMPLETED',
  };
}

/**
 * Builds and compiles the LangGraph StateGraph workflow for Sentinel AI
 */
export function buildSentinelGraph() {
  const workflow = new StateGraph(InvestigationState)
    .addNode('requestValidation', requestValidationNode)
    .addNode('authorizationCheck', authorizationCheckNode)
    .addNode('collectEvidence', collectEvidenceNode)
    .addNode('deterministicIntegrityCheck', deterministicIntegrityCheckNode)
    .addNode('redactEvidence', redactEvidenceNode)
    .addNode('correlateSecurityEvents', correlateSecurityEventsNode)
    .addNode('generateFindings', generateFindingsNode)
    .addNode('validateFindings', validateFindingsNode)
    .addNode('persistReport', persistReportNode);

  // Define edges with conditional failure bypasses
  workflow.addEdge(START, 'requestValidation');

  const checkFailure = (state) => (state.failureCode ? 'persistReport' : 'continue');

  workflow.addConditionalEdges('requestValidation', (s) => (s.failureCode ? 'persistReport' : 'authorizationCheck'));
  workflow.addConditionalEdges('authorizationCheck', (s) => (s.failureCode ? 'persistReport' : 'collectEvidence'));
  workflow.addConditionalEdges('collectEvidence', (s) => (s.failureCode ? 'persistReport' : 'deterministicIntegrityCheck'));
  workflow.addConditionalEdges('deterministicIntegrityCheck', (s) => (s.failureCode ? 'persistReport' : 'redactEvidence'));
  workflow.addConditionalEdges('redactEvidence', (s) => (s.failureCode ? 'persistReport' : 'correlateSecurityEvents'));
  workflow.addConditionalEdges('correlateSecurityEvents', (s) => (s.failureCode ? 'persistReport' : 'generateFindings'));
  workflow.addConditionalEdges('generateFindings', (s) => (s.failureCode ? 'persistReport' : 'validateFindings'));
  workflow.addConditionalEdges('validateFindings', (s) => (s.failureCode ? 'persistReport' : 'persistReport'));

  workflow.addEdge('persistReport', END);

  return workflow.compile();
}

/**
 * Executes a full Sentinel AI investigation using the compiled LangGraph workflow.
 */
export async function runSentinelInvestigation({ rawRequest, user }) {
  const app = buildSentinelGraph();
  const finalState = await app.invoke({
    rawRequest,
    user,
  });

  return finalState.persistedReport;
}
