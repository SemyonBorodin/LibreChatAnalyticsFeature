import type { Document, Types } from 'mongoose';

export interface IInteraction extends Document {
  user: string;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  idempotencyKey?: string | null;
  userMessage: string;
  assistantMessage: string;
  status: 'success';
  model?: string | null;
  endpoint?: string | null;
  conversationId?: string | null;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

export interface CreateInteractionParams {
  user: string;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  idempotencyKey?: string | null;
  userMessage: string;
  assistantMessage: string;
  status?: 'success';
  model?: string | null;
  endpoint?: string | null;
  conversationId?: string | null;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
}

export interface GetInteractionsParams {
  user: string;
  pageSize?: number;
  cursor?: string | null;
  model?: string | null;
}

export interface InteractionCursorValue {
  createdAt: string;
  id: string;
}

export interface InteractionPage {
  interactions: IInteraction[];
  nextCursor: string | null;
}

export interface InteractionSummaryBucket {
  model: string | null;
  count: number;
  firstCreatedAt: Date | null;
  lastCreatedAt: Date | null;
}

export interface InteractionSummary {
  totalInteractions: number;
  uniqueModels: number;
  averageUserMessageLength: number;
  averageAssistantMessageLength: number;
  firstCreatedAt: Date | null;
  lastCreatedAt: Date | null;
  byModel: InteractionSummaryBucket[];
}

export interface InteractionSummaryRow {
  _id: string | null;
  count: number;
  totalUserMessageLength: number;
  totalAssistantMessageLength: number;
  firstCreatedAt: Date | null;
  lastCreatedAt: Date | null;
}

export interface InteractionListFilter {
  user: string;
  model?: string | null;
}

export interface InteractionCursorQuery {
  $or: Array<{ createdAt: { $lt: Date } } | { createdAt: Date; _id: { $lt: Types.ObjectId } }>;
}
