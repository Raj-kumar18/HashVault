import mongoose from 'mongoose';

const logEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
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
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    sourceOffset: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      required: true,
    },
    observedAt: {
      type: Date,
      required: true,
      index: true,
    },
    ingestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    collectorMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sequenceNumber: {
      type: Number,
      default: null,
      index: true,
    },
    eventHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for idempotent event deduplication per server
logEventSchema.index({ serverId: 1, eventId: 1 }, { unique: true });

// Efficient querying by server and chronological order
logEventSchema.index({ serverId: 1, observedAt: -1 });
logEventSchema.index({ serverId: 1, ingestedAt: -1 });

export const LogEvent = mongoose.model('LogEvent', logEventSchema);
