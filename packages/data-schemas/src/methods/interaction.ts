import { Types } from 'mongoose';
import type { FilterQuery, Model } from 'mongoose';
import type {
  CreateInteractionParams,
  GetInteractionsParams,
  IInteraction,
  InteractionCursorQuery,
  InteractionCursorValue,
  InteractionListFilter,
  InteractionPage,
  InteractionSummary,
  InteractionSummaryBucket,
  InteractionSummaryRow,
} from '~/types/interaction';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePageSize(pageSize?: number): number {
  if (typeof pageSize !== 'number' || Number.isNaN(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(1, Math.trunc(pageSize)), MAX_PAGE_SIZE);
}

function encodeCursor(value: InteractionCursorValue): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor(cursor?: string | null): InteractionCursorValue | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<InteractionCursorValue>;

    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }

    if (!Types.ObjectId.isValid(parsed.id) || Number.isNaN(new Date(parsed.createdAt).getTime())) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function buildListFilter({ user, model }: GetInteractionsParams): InteractionListFilter {
  const filter: InteractionListFilter = { user };

  if (typeof model === 'string' && model.trim() !== '') {
    filter.model = model.trim();
  }

  return filter;
}

function buildCursorQuery(
  cursor: InteractionCursorValue | null,
): InteractionCursorQuery | undefined {
  if (!cursor) {
    return undefined;
  }

  const createdAt = new Date(cursor.createdAt);
  const objectId = new Types.ObjectId(cursor.id);

  return {
    $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: objectId } }],
  };
}

function assertUser(user: string): void {
  if (!user || typeof user !== 'string') {
    throw new Error('User is required');
  }
}

export interface InteractionMethods {
  createInteraction(params: CreateInteractionParams): Promise<IInteraction>;
  getInteractions(params: GetInteractionsParams): Promise<InteractionPage>;
  getInteractionSummary(params: { user: string }): Promise<InteractionSummary>;
}

export function createInteractionMethods(mongoose: typeof import('mongoose')): InteractionMethods {
  async function createInteraction(params: CreateInteractionParams): Promise<IInteraction> {
    assertUser(params.user);

    const Interaction = mongoose.models.Interaction as Model<IInteraction>;
    const interactionPayload = {
      user: params.user,
      userMessageId: params.userMessageId ?? null,
      assistantMessageId: params.assistantMessageId ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      userMessage: params.userMessage,
      assistantMessage: params.assistantMessage,
      status: params.status ?? 'success',
      model: params.model ?? null,
      endpoint: params.endpoint ?? null,
      conversationId: params.conversationId ?? null,
      latencyMs: params.latencyMs ?? null,
      metadata: params.metadata,
    };

    let idempotencyFilter:
      | { user: string; assistantMessageId: string }
      | { user: string; idempotencyKey: string }
      | null = null;
    if (params.assistantMessageId != null && params.assistantMessageId.trim() !== '') {
      idempotencyFilter = { user: params.user, assistantMessageId: params.assistantMessageId };
    } else if (params.idempotencyKey != null && params.idempotencyKey.trim() !== '') {
      idempotencyFilter = { user: params.user, idempotencyKey: params.idempotencyKey };
    }

    if (idempotencyFilter == null) {
      const created = await Interaction.create(interactionPayload);

      return created.toObject();
    }

    const interaction = await Interaction.findOneAndUpdate(
      idempotencyFilter,
      { $setOnInsert: interactionPayload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    if (!interaction) {
      throw new Error('Interaction upsert failed');
    }

    return interaction.toObject();
  }

  async function getInteractions(params: GetInteractionsParams): Promise<InteractionPage> {
    assertUser(params.user);

    const Interaction = mongoose.models.Interaction as Model<IInteraction>;
    const pageSize = normalizePageSize(params.pageSize);
    const decodedCursor = decodeCursor(params.cursor);
    const filter: FilterQuery<IInteraction> = buildListFilter(params);
    const cursorQuery = buildCursorQuery(decodedCursor);

    if (cursorQuery) {
      filter.$and = [cursorQuery];
    }

    const results = await Interaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)
      .lean<IInteraction[]>();

    const hasMore = results.length > pageSize;
    const interactions = hasMore ? results.slice(0, pageSize) : results;
    const lastInteraction = interactions[interactions.length - 1];

    return {
      interactions,
      nextCursor:
        hasMore && lastInteraction?._id && lastInteraction.createdAt
          ? encodeCursor({
              createdAt: lastInteraction.createdAt.toISOString(),
              id: lastInteraction._id.toString(),
            })
          : null,
    };
  }

  async function getInteractionSummary({ user }: { user: string }): Promise<InteractionSummary> {
    assertUser(user);

    const Interaction = mongoose.models.Interaction as Model<IInteraction>;

    const rows = await Interaction.aggregate<InteractionSummaryRow>([
      {
        $match: {
          user,
        },
      },
      {
        $group: {
          _id: {
            $ifNull: ['$model', null],
          },
          count: {
            $sum: 1,
          },
          totalUserMessageLength: {
            $sum: {
              $strLenCP: {
                $ifNull: ['$userMessage', ''],
              },
            },
          },
          totalAssistantMessageLength: {
            $sum: {
              $strLenCP: {
                $ifNull: ['$assistantMessage', ''],
              },
            },
          },
          firstCreatedAt: {
            $min: '$createdAt',
          },
          lastCreatedAt: {
            $max: '$createdAt',
          },
        },
      },
      {
        $sort: {
          count: -1,
          _id: 1,
        },
      },
    ]);

    const byModel: InteractionSummaryBucket[] = rows.map((row) => ({
      model: row._id,
      count: row.count,
      firstCreatedAt: row.firstCreatedAt ?? null,
      lastCreatedAt: row.lastCreatedAt ?? null,
    }));

    const summary = rows.reduce<InteractionSummary>(
      (summary, row) => {
        const firstCreatedAt =
          summary.firstCreatedAt == null ||
          (row.firstCreatedAt != null && row.firstCreatedAt < summary.firstCreatedAt)
            ? row.firstCreatedAt
            : summary.firstCreatedAt;
        const lastCreatedAt =
          summary.lastCreatedAt == null ||
          (row.lastCreatedAt != null && row.lastCreatedAt > summary.lastCreatedAt)
            ? row.lastCreatedAt
            : summary.lastCreatedAt;

        return {
          totalInteractions: summary.totalInteractions + row.count,
          uniqueModels: summary.uniqueModels + 1,
          averageUserMessageLength:
            summary.averageUserMessageLength + (row.totalUserMessageLength ?? 0),
          averageAssistantMessageLength:
            summary.averageAssistantMessageLength + (row.totalAssistantMessageLength ?? 0),
          firstCreatedAt,
          lastCreatedAt,
          byModel: [...summary.byModel],
        };
      },
      {
        totalInteractions: 0,
        uniqueModels: 0,
        averageUserMessageLength: 0,
        averageAssistantMessageLength: 0,
        firstCreatedAt: null,
        lastCreatedAt: null,
        byModel: [],
      },
    );

    if (summary.totalInteractions === 0) {
      return {
        ...summary,
        byModel,
      };
    }

    return {
      ...summary,
      byModel,
      averageUserMessageLength: Number(
        (summary.averageUserMessageLength / summary.totalInteractions).toFixed(1),
      ),
      averageAssistantMessageLength: Number(
        (summary.averageAssistantMessageLength / summary.totalInteractions).toFixed(1),
      ),
    };
  }

  return {
    createInteraction,
    getInteractions,
    getInteractionSummary,
  };
}

export type { CreateInteractionParams, GetInteractionsParams, InteractionPage, InteractionSummary };
