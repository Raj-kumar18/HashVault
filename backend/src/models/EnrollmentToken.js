import mongoose from 'mongoose';
import crypto from 'crypto';

const enrollmentTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    serverId: {
      type: String,
      required: true,
      index: true,
    },
    serverRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB TTL index to automatically purge old tokens after expiration
enrollmentTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for querying active tokens
enrollmentTokenSchema.index({ serverId: 1, isConsumed: 1, expiresAt: 1 });

/**
 * Computes deterministic SHA-256 hash of a raw token string
 */
enrollmentTokenSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

export const EnrollmentToken = mongoose.model('EnrollmentToken', enrollmentTokenSchema);
