import mongoose from 'mongoose';
import { HASH_VERSION, GENESIS_PREVIOUS_HASH, GENESIS_SEQUENCE_NUMBER } from '../crypto/canonicalizer.js';

const integrityRecordSchema = new mongoose.Schema(
  {
    serverId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    serverRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
      min: GENESIS_SEQUENCE_NUMBER,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    canonicalPayload: {
      type: String,
      required: true,
    },
    previousHash: {
      type: String,
      required: true,
      match: [/^[0-9a-f]{64}$/, 'previousHash must be a 64-character lowercase hexadecimal hash'],
    },
    eventHash: {
      type: String,
      required: true,
      match: [/^[0-9a-f]{64}$/, 'eventHash must be a 64-character lowercase hexadecimal hash'],
      index: true,
    },
    hashVersion: {
      type: String,
      required: true,
      default: HASH_VERSION,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      default: '',
    },
    observedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index guaranteeing single-sequence append-only invariant per server
integrityRecordSchema.index({ serverId: 1, sequenceNumber: 1 }, { unique: true });

// Compound unique index guaranteeing idempotency: duplicate event retries cannot create duplicate integrity entries
integrityRecordSchema.index({ serverId: 1, eventId: 1 }, { unique: true });

// Chronological and sequence ordering queries
integrityRecordSchema.index({ serverId: 1, sequenceNumber: -1 });
integrityRecordSchema.index({ serverId: 1, receivedAt: -1 });

/**
 * Returns safe view object without internal Mongoose fields
 */
integrityRecordSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    serverId: this.serverId,
    sequenceNumber: this.sequenceNumber,
    eventId: this.eventId,
    canonicalPayload: this.canonicalPayload,
    previousHash: this.previousHash,
    eventHash: this.eventHash,
    hashVersion: this.hashVersion,
    receivedAt: this.receivedAt,
    source: this.source,
    message: this.message,
    observedAt: this.observedAt,
    createdAt: this.createdAt,
  };
};

export const IntegrityRecord = mongoose.model('IntegrityRecord', integrityRecordSchema);
export { HASH_VERSION, GENESIS_PREVIOUS_HASH, GENESIS_SEQUENCE_NUMBER };
