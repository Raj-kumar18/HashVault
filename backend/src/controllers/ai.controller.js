import { AnalysisReport } from '../models/AnalysisReport.js';
import { Server } from '../models/Server.js';
import { runSentinelInvestigation } from '../ai/sentinelGraph.js';
import { getAiProviderStatus } from '../ai/provider.js';
import {
  InvestigationRequestSchema,
  AnalystFeedbackSchema,
} from '../ai/schemas.js';

/**
 * POST /api/ai/analyses
 * Initiates an evidence-backed security investigation through the LangGraph engine.
 */
export async function createAnalysis(req, res, next) {
  try {
    const parseResult = InvestigationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues || parseResult.error.errors || [];
      const errMsg = issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return res.status(400).json({
        error: 'ValidationError',
        message: `Invalid investigation parameters: ${errMsg}`,
      });
    }

    const { serverId } = parseResult.data;

    // Check server existence and ownership before invocation
    const server = await Server.findOne({ serverId });
    if (!server) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Workstation with ID ${serverId} does not exist.`,
      });
    }

    const isAdmin = req.user.role === 'Admin';
    const isOwner =
      server.ownerId && server.ownerId.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: workstation is outside your authorized fleet scope.',
      });
    }

    // Execute LangGraph workflow
    const report = await runSentinelInvestigation({
      rawRequest: parseResult.data,
      user: req.user,
    });

    if (report.status === 'FAILED') {
      const statusCode =
        report.failureCode === 'UNAUTHORIZED'
          ? 401
          : report.failureCode === 'FORBIDDEN'
          ? 403
          : report.failureCode === 'SERVER_NOT_FOUND'
          ? 404
          : 422;

      return res.status(statusCode).json({
        success: false,
        error: report.failureCode,
        message: report.failureReason,
        report,
      });
    }

    return res.status(201).json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/analyses
 * Lists paginated, filterable historical investigation reports scoped to authorized servers.
 */
export async function listAnalyses(req, res, next) {
  try {
    const {
      serverId,
      riskLevel,
      status,
      page = 1,
      limit = 15,
      search,
    } = req.query;

    const query = {};

    // Scope check: Non-admins can only see reports for servers they own
    if (req.user.role !== 'Admin') {
      const ownedServers = await Server.find({ ownerId: req.user._id }).select('serverId');
      const ownedIds = ownedServers.map((s) => s.serverId);
      query.serverId = { $in: ownedIds };
    }

    if (serverId) {
      // If user specified serverId, ensure they have access to it
      if (req.user.role !== 'Admin') {
        const hasAccess = Array.isArray(query.serverId?.$in) && query.serverId.$in.includes(serverId);
        if (!hasAccess) {
          return res.status(200).json({
            success: true,
            reports: [],
            pagination: { page: 1, limit: Number(limit), total: 0, totalPages: 1 },
          });
        }
      }
      query.serverId = serverId;
    }

    if (riskLevel && riskLevel !== 'ALL') {
      query.overallRiskLevel = riskLevel;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { question: regex },
        { serverName: regex },
        { executiveSummary: regex },
        { analysisId: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [reports, total] = await Promise.all([
      AnalysisReport.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AnalysisReport.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/analyses/:analysisId
 * Fetches an individual investigation report with full evidence links.
 */
export async function getAnalysisById(req, res, next) {
  try {
    const { analysisId } = req.params;

    const report = await AnalysisReport.findOne({ analysisId }).lean();
    if (!report) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Investigation report ${analysisId} not found.`,
      });
    }

    // Ownership check for non-admin
    if (req.user.role !== 'Admin') {
      const server = await Server.findOne({ serverId: report.serverId });
      const isOwner = server && server.ownerId?.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: this report is outside your authorized fleet scope.',
        });
      }
    }

    res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ai/analyses/:analysisId/feedback
 * Records analyst feedback on finding accuracy and usefulness.
 */
export async function submitFeedback(req, res, next) {
  try {
    const { analysisId } = req.params;
    const parseResult = AnalystFeedbackSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid feedback data: helpful boolean required.',
      });
    }

    const report = await AnalysisReport.findOne({ analysisId });
    if (!report) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Investigation report ${analysisId} not found.`,
      });
    }

    // Scope check
    if (req.user.role !== 'Admin') {
      const server = await Server.findOne({ serverId: report.serverId });
      const isOwner = server && server.ownerId?.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: report is outside your authorized fleet scope.',
        });
      }
    }

    report.analystFeedback.push({
      userId: req.user._id,
      userName: req.user.name,
      helpful: parseResult.data.helpful,
      notes: parseResult.data.notes || '',
      submittedAt: new Date(),
    });

    await report.save();

    res.status(200).json({
      success: true,
      message: 'Analyst feedback recorded successfully.',
      feedback: report.analystFeedback,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/analyses/:analysisId/compare/:otherId
 * Compares two historical analyses for the same server.
 */
export async function compareAnalyses(req, res, next) {
  try {
    const { analysisId, otherId } = req.params;

    const [reportA, reportB] = await Promise.all([
      AnalysisReport.findOne({ analysisId }).lean(),
      AnalysisReport.findOne({ analysisId: otherId }).lean(),
    ]);

    if (!reportA || !reportB) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'One or both of the specified investigation reports do not exist.',
      });
    }

    if (reportA.serverId !== reportB.serverId) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Cannot compare analyses across different workstations.',
      });
    }

    // Scope check
    if (req.user.role !== 'Admin') {
      const server = await Server.findOne({ serverId: reportA.serverId });
      const isOwner = server && server.ownerId?.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: workstation is outside your authorized fleet scope.',
        });
      }
    }

    // Distinguish evidence differences vs model version differences
    const evidenceDelta = {
      reportAEvents: reportA.evidenceMetadata?.logEventsCount || 0,
      reportBEvents: reportB.evidenceMetadata?.logEventsCount || 0,
      reportAAlerts: reportA.evidenceMetadata?.alertsCount || 0,
      reportBAlerts: reportB.evidenceMetadata?.alertsCount || 0,
    };

    const integrityDelta = {
      reportAIntegrityStatus: reportA.integritySummary?.status || 'UNKNOWN',
      reportBIntegrityStatus: reportB.integritySummary?.status || 'UNKNOWN',
    };

    const blockchainDelta = {
      reportABlockchainStatus: reportA.blockchainSummary?.status || 'UNKNOWN',
      reportBBlockchainStatus: reportB.blockchainSummary?.status || 'UNKNOWN',
    };

    const modelDelta = {
      reportAModel: 'Sentinel Autonomous Core',
      reportBModel: 'Sentinel Autonomous Core',
      isSameModel: true,
    };

    const riskDelta = {
      reportARisk: reportA.overallRiskLevel,
      reportBRisk: reportB.overallRiskLevel,
      riskChanged: reportA.overallRiskLevel !== reportB.overallRiskLevel,
    };

    res.status(200).json({
      success: true,
      serverId: reportA.serverId,
      serverName: reportA.serverName,
      reportA: {
        analysisId: reportA.analysisId,
        createdAt: reportA.createdAt,
        riskLevel: reportA.overallRiskLevel,
        findingsCount: reportA.findings?.length || 0,
      },
      reportB: {
        analysisId: reportB.analysisId,
        createdAt: reportB.createdAt,
        riskLevel: reportB.overallRiskLevel,
        findingsCount: reportB.findings?.length || 0,
      },
      comparison: {
        evidenceDelta,
        integrityDelta,
        blockchainDelta,
        modelDelta,
        riskDelta,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ai/status
 * Returns safe AI provider readiness.
 */
export async function getAiStatus(req, res) {
  const status = getAiProviderStatus();
  res.status(200).json({
    success: true,
    ...status,
  });
}
