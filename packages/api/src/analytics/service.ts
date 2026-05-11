import type {
  CreateInteractionParams,
  GetInteractionsParams,
  IInteraction,
  InteractionPage,
  InteractionSummary,
} from '@librechat/data-schemas';
import { createHash } from 'crypto';

export interface AnalyticsServiceDeps {
  createInteraction: (params: CreateInteractionParams) => Promise<IInteraction>;
  getInteractionSummary: (params: { user: string }) => Promise<InteractionSummary>;
  getInteractions: (params: GetInteractionsParams) => Promise<InteractionPage>;
}

export interface RecordInteractionExchangeParams {
  user: string;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  userMessage?: string | null;
  assistantMessage?: string | null;
  model?: string | null;
  endpoint?: string | null;
  conversationId?: string | null;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
}

export interface CreateMockInteractionParams {
  user: string;
  userMessage: string;
  model?: string;
}

export interface AnalyticsService {
  createMockInteraction(params: CreateMockInteractionParams): Promise<IInteraction>;
  getSummary(params: { user: string }): Promise<InteractionSummary>;
  getInteractions(params: GetInteractionsParams): Promise<InteractionPage>;
}

export function buildMockAssistantMessage(userMessage: string): string {
  return `Mock response: ${userMessage.trim()}`;
}

export function buildMockAssistantLatencyMs(userMessage: string): number {
  const trimmedLength = userMessage.trim().length;
  return 120 + Math.min(480, trimmedLength * 12);
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildFallbackIdempotencyKey(params: {
  conversationId: string | null;
  userMessageId: string | null;
  assistantMessage: string;
}): string | null {
  if (params.conversationId == null || params.userMessageId == null) {
    return null;
  }

  const hash = createHash('sha256').update(params.assistantMessage).digest('hex');
  return `${params.conversationId}:${params.userMessageId}:${hash}`;
}

export async function recordInteractionExchange(
  deps: Pick<AnalyticsServiceDeps, 'createInteraction'>,
  params: RecordInteractionExchangeParams,
): Promise<IInteraction | null> {
  const user = normalizeOptionalString(params.user);
  const userMessageId = normalizeOptionalString(params.userMessageId);
  const assistantMessageId = normalizeOptionalString(params.assistantMessageId);
  const userMessage = normalizeOptionalString(params.userMessage);
  const assistantMessage = normalizeOptionalString(params.assistantMessage);
  const conversationId = normalizeOptionalString(params.conversationId);

  if (user == null || userMessage == null || assistantMessage == null) {
    return null;
  }

  return deps.createInteraction({
    user,
    userMessageId,
    assistantMessageId,
    idempotencyKey:
      assistantMessageId == null
        ? buildFallbackIdempotencyKey({ conversationId, userMessageId, assistantMessage })
        : null,
    userMessage,
    assistantMessage,
    status: 'success',
    model: normalizeOptionalString(params.model),
    endpoint: normalizeOptionalString(params.endpoint),
    conversationId,
    latencyMs: params.latencyMs ?? null,
    metadata: params.metadata,
  });
}

export function createAnalyticsService(deps: AnalyticsServiceDeps): AnalyticsService {
  async function createMockInteraction({
    user,
    userMessage,
    model,
  }: CreateMockInteractionParams): Promise<IInteraction> {
    const trimmedUserMessage = userMessage.trim();

    const interaction = await recordInteractionExchange(deps, {
      user,
      userMessage: trimmedUserMessage,
      assistantMessage: buildMockAssistantMessage(trimmedUserMessage),
      model: typeof model === 'string' && model.trim() !== '' ? model.trim() : 'mock-model',
      endpoint: 'mock',
      latencyMs: buildMockAssistantLatencyMs(trimmedUserMessage),
    });

    if (interaction == null) {
      throw new Error('Failed to create mock interaction');
    }

    return interaction;
  }

  async function getSummary({ user }: { user: string }): Promise<InteractionSummary> {
    return deps.getInteractionSummary({ user });
  }

  async function getInteractions(params: GetInteractionsParams): Promise<InteractionPage> {
    return deps.getInteractions(params);
  }

  return {
    createMockInteraction,
    getSummary,
    getInteractions,
  };
}
