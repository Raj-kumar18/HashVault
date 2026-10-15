import mongoose from 'mongoose';
import crypto from 'crypto';

export const SERVER_OS = ['Linux', 'Windows'];
export const SERVER_ENVIRONMENTS = ['Development', 'Staging', 'Production'];
export const ENROLLMENT_STATUSES = ['PENDING_ENROLLMENT', 'ENROLLED', 'DISABLED'];
export const CONNECTION_STATUSES = ['ONLINE', 'OFFLINE', 'UNKNOWN'];

const serverSchema = new mongoose.Schema(
  {
    serverId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `srv_${crypto.randomBytes(12).toString('hex')}`,
    },
    serverName: {
      type: String,
      required: [true, 'Server name is required'],
      trim: true,
      minlength: [2, 'Server name must be at least 2 characters long'],
      maxlength: [100, 'Server name must be at most 100 characters long'],
    },
    hostname: {
      type: String,
      required: [true, 'Hostname is required'],
      trim: true,
      minlength: [2, 'Hostname must be at least 2 characters long'],
      maxlength: [253, 'Hostname must be at most 253 characters long'],
      match: [
        /^[a-zA-Z0-9]([a-zA-Z0-9-_.]{0,251}[a-zA-Z0-9])?$/,
        'Please provide a valid hostname (letters, numbers, dots, dashes, underscores)',
      ],
    },
    os: {
      type: String,
      required: [true, 'Operating system is required'],
      enum: {
        values: SERVER_OS,
        message: 'Operating system must be Linux or Windows',
      },
    },
    environment: {
      type: String,
      required: [true, 'Environment is required'],
      enum: {
        values: SERVER_ENVIRONMENTS,
        message: 'Environment must be Development, Staging, or Production',
      },
      default: 'Production',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters long'],
      default: '',
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    enrollmentStatus: {
      type: String,
      enum: {
        values: ENROLLMENT_STATUSES,
        message: 'Invalid enrollment status',
      },
      default: 'PENDING_ENROLLMENT',
      index: true,
    },
    connectionStatus: {
      type: String,
      enum: {
        values: CONNECTION_STATUSES,
        message: 'Invalid connection status',
      },
      default: 'UNKNOWN',
      index: true,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    credentialHash: {
      type: String,
      default: null,
      select: false, // Never returned in normal find queries
    },
    credentialVersion: {
      type: Number,
      default: 1,
    },
    disabledAt: {
      type: Date,
      default: null,
    },
    chainHeadSequence: {
      type: Number,
      default: 0,
    },
    chainHeadHash: {
      type: String,
      default: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    chainHeadUpdatedAt: {
      type: Date,
      default: null,
    },
    lastVerificationStatus: {
      type: String,
      enum: ['VERIFIED', 'TAMPERED', 'INCOMPLETE', 'NOT_VERIFIED'],
      default: 'NOT_VERIFIED',
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    lastVerifiedRange: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user-scoped queries and performance
serverSchema.index({ ownerId: 1, createdAt: -1 });
serverSchema.index({ ownerId: 1, enrollmentStatus: 1 });
serverSchema.index({ ownerId: 1, serverName: 1 });

/**
 * Returns safe server representation hiding sensitive hashes and internal Mongoose fields.
 * Derives connectionStatus dynamically based on documented heartbeat freshness threshold (120 seconds).
 */
serverSchema.methods.toSafeObject = function () {
  let computedConnectionStatus = this.connectionStatus || 'UNKNOWN';
  let computedCollectorHealth = 'UNKNOWN';

  if (this.enrollmentStatus === 'DISABLED') {
    computedConnectionStatus = 'OFFLINE';
    computedCollectorHealth = 'DISABLED';
  } else if (!this.lastHeartbeatAt) {
    computedConnectionStatus = 'UNKNOWN';
    computedCollectorHealth = 'UNKNOWN';
  } else {
    const freshnessWindowMs = 120 * 1000; // 120 seconds legacy threshold
    const staleMs = parseInt(process.env.HEARTBEAT_STALE_THRESHOLD_MS || '90000', 10);
    const offlineMs = parseInt(process.env.HEARTBEAT_OFFLINE_THRESHOLD_MS || '300000', 10);
    const ageMs = Date.now() - new Date(this.lastHeartbeatAt).getTime();
    computedConnectionStatus = ageMs <= freshnessWindowMs ? 'ONLINE' : 'OFFLINE';

    if (ageMs > offlineMs) {
      computedCollectorHealth = 'OFFLINE';
    } else if (ageMs > staleMs) {
      computedCollectorHealth = 'STALE';
    } else {
      computedCollectorHealth = 'ONLINE';
    }
  }

  const lastHeartbeatAgeSeconds = this.lastHeartbeatAt
    ? Math.round((Date.now() - new Date(this.lastHeartbeatAt).getTime()) / 1000)
    : null;

  return {
    serverId: this.serverId,
    serverName: this.serverName,
    hostname: this.hostname,
    os: this.os,
    environment: this.environment,
    description: this.description || '',
    enrollmentStatus: this.enrollmentStatus,
    connectionStatus: computedConnectionStatus,
    collectorHealth: computedCollectorHealth,
    lastHeartbeatAt: this.lastHeartbeatAt,
    lastHeartbeatAgeSeconds,
    credentialVersion: this.credentialVersion,
    disabledAt: this.disabledAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    isEnrolled: this.enrollmentStatus === 'ENROLLED',
    chainHeadSequence: this.chainHeadSequence || 0,
    chainHeadHash: this.chainHeadHash || '0000000000000000000000000000000000000000000000000000000000000000',
    lastVerificationStatus: this.lastVerificationStatus || 'NOT_VERIFIED',
    lastVerifiedAt: this.lastVerifiedAt || null,
  };
};

export const Server = mongoose.model('Server', serverSchema);
