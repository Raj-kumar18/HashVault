import mongoose from 'mongoose';
import crypto from 'crypto';

export const ANALYSIS_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const FINDING_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const findingSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `fnd_${crypto.randomBytes(6).toString('hex')}`,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: FINDING_SEVERITIES,
      default: 'MEDIUM',
    },
    observedFacts: {
      type: [String],
      default: [],
    },
    supportingEvidenceRefs: {
      type: [String],
      default: [],
    },
    interpretation: {
      type: String,
      default: '',
    },
    alternativeExplanations: {
      type: String,
      default: '',
    },
    recommendedNextStep: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const timelineItemSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
    },
    evidenceRef: {
      type: String,
      default: null,
    },
    factualDescription: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      default: 'telemetry',
    },
    interpretation: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    helpful: {
      type: Boolean,
      required: true,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const analysisReportSchema = new mongoose.Schema(
  {
    analysisId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `anl_${crypto.randomBytes(12).toString('hex')}`,
    },
    requestingUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestingUserName: {
      type: String,
      required: true,
    },
    requestingUserRole: {
      type: String,
      default: 'Analyst',
    },
    serverId: {
      type: String,
      required: true,
      index: true,
    },
    serverName: {
      type: String,
      required: true,
    },
    timeRange: {
      startTime: {
        type: Date,
        required: true,
      },
      endTime: {
        type: Date,
        required: true,
      },
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    selectedAlertIds: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ANALYSIS_STATUSES,
      default: 'PENDING',
      index: true,
    },
    failureCode: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },

    // Deterministic Authoritative Results (AI cannot alter)
    integritySummary: {
      verified: { type: Boolean, default: null },
      status: { type: String, default: 'UNAVAILABLE' },
      recordsChecked: { type: Number, default: 0 },
      totalEventsInChain: { type: Number, default: 0 },
      chainHeadHash: { type: String, default: null },
      findings: { type: Array, default: [] },
    },
    blockchainSummary: {
      status: { type: String, default: 'UNAVAILABLE' },
      checkpointCount: { type: Number, default: 0 },
      checkpoints: { type: Array, default: [] },
      message: { type: String, default: null },
    },
    collectorStatus: {
      type: String,
      default: 'UNKNOWN',
    },
    ingestionContinuity: {
      isContinuous: { type: Boolean, default: true },
      gapDetected: { type: Boolean, default: false },
      message: { type: String, default: '' },
    },

    // Evidence Volume & Privacy Metrics
    evidenceMetadata: {
      logEventsCount: { type: Number, default: 0 },
      alertsCount: { type: Number, default: 0 },
      evidenceIds: { type: [String], default: [] },
      redactedItemsCount: { type: Number, default: 0 },
    },

    // Structured AI Findings
    executiveSummary: {
      type: String,
      default: '',
    },
    overallRiskLevel: {
      type: String,
      enum: RISK_LEVELS,
      default: 'LOW',
      index: true,
    },
    confidenceLevel: {
      type: Number,
      default: 85,
      min: 0,
      max: 100,
    },
    confidenceExplanation: {
      type: String,
      default: '',
    },
    potentialImpact: {
      type: String,
      default: '',
    },
    findings: {
      type: [findingSchema],
      default: [],
    },
    timeline: {
      type: [timelineItemSchema],
      default: [],
    },
    recommendedInvestigationSteps: {
      type: [String],
      default: [],
    },
    missingEvidenceAndLimitations: {
      type: [String],
      default: [],
    },

    // Execution Audit & Traceability
    modelMetadata: {
      provider: { type: String, default: 'sentinel-intelligence-engine' },
      model: { type: String, default: 'sentinel-core-v1' },
      promptVersion: { type: String, default: 'v1.0' },
      durationMs: { type: Number, default: 0 },
    },

    // Analyst Evaluation & Feedback
    analystFeedback: {
      type: [feedbackSchema],
      default: [],
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common lookups and pagination
analysisReportSchema.index({ serverId: 1, createdAt: -1 });
analysisReportSchema.index({ requestingUserId: 1, createdAt: -1 });
analysisReportSchema.index({ status: 1, overallRiskLevel: 1, createdAt: -1 });

export const AnalysisReport = mongoose.model('AnalysisReport', analysisReportSchema);
