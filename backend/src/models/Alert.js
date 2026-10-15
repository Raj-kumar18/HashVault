import mongoose from 'mongoose';
import crypto from 'crypto';

export const ALERT_TYPES = [
  'COLLECTOR_STALE',
  'COLLECTOR_OFFLINE',
  'COLLECTOR_DISABLED',
  'INGESTION_FAILURE',
  'SEQUENCE_GAP',
  'HASH_CHAIN_MISMATCH',
  'CHECKPOINT_MISMATCH',
  'BLOCKCHAIN_UNAVAILABLE',
  'CHECKPOINT_TRANSACTION_FAILED',
  'AUTHENTICATION_FAILURE_SPIKE',
];

export const ALERT_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

const alertSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `alt_${crypto.randomBytes(12).toString('hex')}`,
    },
    alertType: {
      type: String,
      required: true,
      enum: ALERT_TYPES,
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ALERT_SEVERITIES,
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ALERT_STATUSES,
      default: 'OPEN',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    serverId: {
      type: String,
      default: null,
      index: true,
    },
    serverName: {
      type: String,
      default: null,
    },
    serverRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      default: null,
    },
    relatedSequence: {
      type: Number,
      default: null,
    },
    relatedCheckpointId: {
      type: String,
      default: null,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    evidenceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    dedupKey: {
      type: String,
      required: true,
      index: true,
    },
    occurrenceCount: {
      type: Number,
      default: 1,
    },
    lastOccurredAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedByName: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedByName: {
      type: String,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: null,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast query filtering
alertSchema.index({ status: 1, severity: 1, detectedAt: -1 });
alertSchema.index({ serverId: 1, status: 1 });
alertSchema.index({ dedupKey: 1, status: 1 });

export const Alert = mongoose.model('Alert', alertSchema);
