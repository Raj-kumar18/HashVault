import { z } from 'zod';

/**
 * Validates incoming investigation trigger requests.
 */
export const InvestigationRequestSchema = z
  .object({
    serverId: z
      .string({ required_error: 'serverId is required' })
      .trim()
      .min(1, 'serverId cannot be empty'),
    startTime: z
      .string({ required_error: 'startTime is required' })
      .datetime({ message: 'startTime must be a valid ISO 8601 datetime string' }),
    endTime: z
      .string({ required_error: 'endTime is required' })
      .datetime({ message: 'endTime must be a valid ISO 8601 datetime string' }),
    alertIds: z
      .array(z.string().trim())
      .optional()
      .default([]),
    question: z
      .string({ required_error: 'question is required' })
      .trim()
      .min(5, 'Investigation question must be at least 5 characters long')
      .max(2000, 'Investigation question cannot exceed 2000 characters'),
  })
  .refine(
    (data) => new Date(data.startTime) <= new Date(data.endTime),
    {
      message: 'startTime must be prior to or equal to endTime',
      path: ['startTime'],
    }
  )
  .refine(
    (data) => {
      const diffMs = new Date(data.endTime) - new Date(data.startTime);
      const maxMs = 30 * 24 * 60 * 60 * 1000; // 30 days maximum
      return diffMs <= maxMs;
    },
    {
      message: 'Investigation time range cannot exceed 30 days',
      path: ['endTime'],
    }
  );

/**
 * Validates feedback submitted by analysts on an investigation report.
 */
export const AnalystFeedbackSchema = z.object({
  helpful: z.boolean({ required_error: 'helpful boolean is required' }),
  notes: z
    .string()
    .trim()
    .max(1000, 'Feedback notes cannot exceed 1000 characters')
    .optional()
    .default(''),
});

/**
 * Schema for an individual evidence-linked finding.
 */
export const FindingSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Finding title cannot be empty'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  observedFacts: z.array(z.string()).default([]),
  supportingEvidenceRefs: z.array(z.string()).default([]),
  interpretation: z.string().default(''),
  alternativeExplanations: z.string().default(''),
  recommendedNextStep: z.string().default(''),
});

/**
 * Schema for an event in the chronological attack timeline.
 */
export const TimelineItemSchema = z.object({
  timestamp: z.string().or(z.date()),
  evidenceRef: z.string().nullable().optional(),
  factualDescription: z.string().min(1, 'Factual description cannot be empty'),
  source: z.string().default('telemetry'),
  interpretation: z.string().nullable().optional(),
});

/**
 * Full structured output schema generated and validated for Sentinel AI investigations.
 */
export const StructuredAnalysisSchema = z.object({
  executiveSummary: z
    .string()
    .min(10, 'Executive summary must be at least 10 characters long'),
  overallRiskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidenceLevel: z.number().min(0).max(100).default(85),
  confidenceExplanation: z.string().default(''),
  potentialImpact: z.string().default(''),
  findings: z.array(FindingSchema).default([]),
  timeline: z.array(TimelineItemSchema).default([]),
  recommendedInvestigationSteps: z.array(z.string()).default([]),
  missingEvidenceAndLimitations: z.array(z.string()).default([]),
});
