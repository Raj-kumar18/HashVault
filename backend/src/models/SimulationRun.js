import mongoose from 'mongoose';
import crypto from 'crypto';

const simulationRunSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `sim_${crypto.randomBytes(12).toString('hex')}`,
    },
    scenarioName: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    testEnvironment: {
      type: String,
      required: true,
      default: () => process.env.NODE_ENV || 'development',
    },
    intendedModification: {
      type: String,
      required: true,
    },
    verificationPerformed: {
      type: String,
      required: true,
    },
    observedResult: {
      type: String,
      required: true,
    },
    detected: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
    },
    alertId: {
      type: String,
      default: null,
    },
    findings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => [],
    },
    tamperedLog: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    failureDetails: {
      type: String,
      default: null,
    },
    executedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    executedByName: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

simulationRunSchema.index({ createdAt: -1 });

export const SimulationRun = mongoose.model('SimulationRun', simulationRunSchema);
