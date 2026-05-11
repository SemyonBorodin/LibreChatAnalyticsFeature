import mongoose, { Schema } from 'mongoose';
import type { IInteraction } from '~/types/interaction';

const interactionSchema: Schema<IInteraction> = new Schema(
  {
    user: {
      type: String,
      required: true,
      index: true,
    },
    userMessageId: {
      type: String,
      default: null,
    },
    assistantMessageId: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
    userMessage: {
      type: String,
      required: true,
      trim: true,
    },
    assistantMessage: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['success'],
      default: 'success',
      required: true,
    },
    model: {
      type: String,
      default: null,
    },
    endpoint: {
      type: String,
      default: null,
    },
    conversationId: {
      type: String,
      default: null,
    },
    latencyMs: {
      type: Number,
      default: null,
      min: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true },
);

interactionSchema.index({ user: 1, createdAt: -1, _id: -1 });
interactionSchema.index({ user: 1, model: 1 });
interactionSchema.index({ conversationId: 1 });
interactionSchema.index(
  { user: 1, assistantMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { assistantMessageId: { $type: 'string' } },
  },
);
interactionSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);

export default interactionSchema;
