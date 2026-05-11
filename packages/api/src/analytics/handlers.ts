import type { Request, RequestHandler, Response } from 'express';
import type { AnalyticsService, CreateMockInteractionParams } from './service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

export interface AnalyticsHandlerDeps {
  createMockInteraction: AnalyticsService['createMockInteraction'];
  getSummary: AnalyticsService['getSummary'];
  getInteractions: AnalyticsService['getInteractions'];
}

export interface AnalyticsHandlers {
  postMockInteraction: RequestHandler;
  getSummary: RequestHandler;
  getInteractions: RequestHandler;
}

function parsePageSize(rawPageSize: unknown): number | undefined {
  if (typeof rawPageSize !== 'string') {
    return undefined;
  }

  const parsed = parseInt(rawPageSize, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

export function createAnalyticsHandlers(deps: AnalyticsHandlerDeps): AnalyticsHandlers {
  const postMockInteraction: RequestHandler = async (req: Request, res: Response) => {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const { userMessage, model } = req.body as {
        userMessage?: string;
        model?: string;
      };

      if (typeof userMessage !== 'string' || userMessage.trim() === '') {
        res.status(400).json({ error: 'userMessage is required' });
        return;
      }

      const payload: CreateMockInteractionParams = {
        user: authenticatedRequest.user?.id ?? '',
        userMessage: userMessage.trim(),
        ...(typeof model === 'string' ? { model } : {}),
      };
      const interaction = await deps.createMockInteraction(payload);

      res.status(201).json(interaction);
      return;
    } catch (error) {
      console.error('[analytics/postMockInteraction] Error creating mock interaction:', error);
      res.status(500).json({ error: 'Failed to create mock interaction' });
      return;
    }
  };

  const getSummary: RequestHandler = async (req: Request, res: Response) => {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const summary = await deps.getSummary({ user: authenticatedRequest.user?.id ?? '' });
      res.status(200).json(summary);
      return;
    } catch (error) {
      console.error('[analytics/getSummary] Error fetching interaction summary:', error);
      res.status(500).json({ error: 'Failed to fetch interaction summary' });
      return;
    }
  };

  const getInteractions: RequestHandler = async (req: Request, res: Response) => {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await deps.getInteractions({
        user: authenticatedRequest.user?.id ?? '',
        pageSize,
        cursor,
      });

      res.status(200).json(result);
      return;
    } catch (error) {
      console.error('[analytics/getInteractions] Error fetching interactions:', error);
      res.status(500).json({ error: 'Failed to fetch interactions' });
      return;
    }
  };

  return {
    postMockInteraction,
    getSummary,
    getInteractions,
  };
}
