import mongoose from 'mongoose';

const CHECKPOINT_STATUSES = ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REORGED'];

const verificationAttemptSchema = new mongoose.Schema(
  {
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['VERIFIED', 'MISMATCH', 'INCOMPLETE', 'UNANCHORED', 'UNAVAILABLE'],
      required: true,
    },
    recomputedRoot: {
      type: String,
    },
    onChainRoot: {
      type: String,
    },
    checkedRange: {
      fromSequence: Number,
      toSequence: Number,
      recordCount: Number,
    },
    findings: [
      {
        code: String,
        message: String,
        sequenceNumber: Number,
        expected: String,
        actual: String,
      },
    ],
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: true }
);

const checkpointSchema = new mongoose.Schema(
  {
    checkpointId: {
      type: String,
      required: [true, 'checkpointId is required'],
      unique: true,
      trim: true,
    },
    applicationId: {
      type: String,
      required: [true, 'applicationId is required'],
      trim: true,
    },
    serverId: {
      type: String,
      required: [true, 'serverId is required'],
      trim: true,
      index: true,
    },
    serverCommitment: {
      type: String,
      required: [true, 'serverCommitment is required'],
      trim: true,
    },
    startSequence: {
      type: Number,
      required: [true, 'startSequence is required'],
      min: 1,
    },
    endSequence: {
      type: Number,
      required: [true, 'endSequence is required'],
      min: 1,
    },
    eventCount: {
      type: Number,
      required: [true, 'eventCount is required'],
      min: 1,
    },
    commitmentVersion: {
      type: String,
      default: '1',
      trim: true,
    },
    startBoundaryHash: {
      type: String,
      required: [true, 'startBoundaryHash is required'],
      trim: true,
    },
    endBoundaryHash: {
      type: String,
      required: [true, 'endBoundaryHash is required'],
      trim: true,
    },
    checkpointRoot: {
      type: String,
      required: [true, 'checkpointRoot is required'],
      trim: true,
    },
    networkChainId: {
      type: Number,
      required: [true, 'networkChainId is required'],
    },
    networkName: {
      type: String,
      default: 'Hardhat Localhost',
      trim: true,
    },
    contractAddress: {
      type: String,
      required: [true, 'contractAddress is required'],
      trim: true,
    },
    transactionHash: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    transactionNonce: {
      type: Number,
    },
    transactionStatus: {
      type: String,
      enum: CHECKPOINT_STATUSES,
      default: 'PENDING',
      index: true,
    },
    blockNumber: {
      type: Number,
    },
    blockHash: {
      type: String,
      trim: true,
    },
    transactionIndex: {
      type: Number,
    },
    confirmationCount: {
      type: Number,
      default: 0,
    },
    anchoredAt: {
      type: Date,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastErrorCode: {
      type: String,
      trim: true,
    },
    lastErrorMessage: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verificationHistory: [verificationAttemptSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee logical checkpoint idempotency per server and range
checkpointSchema.index({ serverId: 1, startSequence: 1, endSequence: 1 }, { unique: true });
checkpointSchema.index({ serverId: 1, endSequence: -1 });

checkpointSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    checkpointId: this.checkpointId,
    applicationId: this.applicationId,
    serverId: this.serverId,
    serverCommitment: this.serverCommitment,
    startSequence: this.startSequence,
    endSequence: this.endSequence,
    eventCount: this.eventCount,
    commitmentVersion: this.commitmentVersion,
    startBoundaryHash: this.startBoundaryHash,
    endBoundaryHash: this.endBoundaryHash,
    checkpointRoot: this.checkpointRoot,
    networkChainId: this.networkChainId,
    networkName: this.networkName,
    contractAddress: this.contractAddress,
    transactionHash: this.transactionHash || null,
    transactionNonce: this.transactionNonce ?? null,
    transactionStatus: this.transactionStatus,
    blockNumber: this.blockNumber ?? null,
    blockHash: this.blockHash || null,
    confirmationCount: this.confirmationCount || 0,
    anchoredAt: this.anchoredAt || null,
    lastAttemptAt: this.lastAttemptAt,
    retryCount: this.retryCount || 0,
    lastErrorCode: this.lastErrorCode || null,
    lastErrorMessage: this.lastErrorMessage || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    latestVerification:
      this.verificationHistory && this.verificationHistory.length > 0
        ? this.verificationHistory[this.verificationHistory.length - 1]
        : null,
  };
};

export const Checkpoint = mongoose.model('Checkpoint', checkpointSchema);
export { CHECKPOINT_STATUSES };
