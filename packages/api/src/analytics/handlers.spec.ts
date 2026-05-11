import express from 'express';
import request from 'supertest';
import { createAnalyticsHandlers } from './handlers';

type AnalyticsHandlersMockDeps = {
  createMockInteraction: jest.Mock;
  getSummary: jest.Mock;
  getInteractions: jest.Mock;
};

function createApp(deps: AnalyticsHandlersMockDeps, userId = 'user-1') {
  const app = express();
  const handlers = createAnalyticsHandlers(deps);

  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user?: { id: string } }).user = { id: userId };
    next();
  });

  app.post('/mock-interaction', handlers.postMockInteraction);
  app.get('/summary', handlers.getSummary);
  app.get('/interactions', handlers.getInteractions);

  return app;
}

describe('createAnalyticsHandlers', () => {
  it('POST mock-interaction rejects an empty userMessage', async () => {
    const deps: AnalyticsHandlersMockDeps = {
      createMockInteraction: jest.fn(),
      getSummary: jest.fn(),
      getInteractions: jest.fn(),
    };
    const app = createApp(deps);

    const response = await request(app).post('/mock-interaction').send({
      userMessage: '   ',
      model: 'mock-model',
    });

    expect(response.status).toBe(400);
    expect(deps.createMockInteraction).not.toHaveBeenCalled();
  });

  it('POST mock-interaction creates interaction for req.user.id', async () => {
    const deps: AnalyticsHandlersMockDeps = {
      createMockInteraction: jest.fn().mockResolvedValue({
        id: 'interaction-1',
        user: 'user-42',
      }),
      getSummary: jest.fn(),
      getInteractions: jest.fn(),
    };
    const app = createApp(deps, 'user-42');

    const response = await request(app).post('/mock-interaction').send({
      userMessage: 'hello',
      model: 'mock-model',
    });

    expect(response.status).toBe(201);
    expect(deps.createMockInteraction).toHaveBeenCalledWith({
      user: 'user-42',
      userMessage: 'hello',
      model: 'mock-model',
    });
  });

  it('GET summary calls dependency with req.user.id', async () => {
    const deps: AnalyticsHandlersMockDeps = {
      createMockInteraction: jest.fn(),
      getSummary: jest.fn().mockResolvedValue({
        totalInteractions: 0,
        uniqueModels: 0,
        firstCreatedAt: null,
        lastCreatedAt: null,
        byModel: [],
      }),
      getInteractions: jest.fn(),
    };
    const app = createApp(deps, 'user-77');

    const response = await request(app).get('/summary');

    expect(response.status).toBe(200);
    expect(deps.getSummary).toHaveBeenCalledWith({ user: 'user-77' });
  });

  it('GET interactions passes user, pageSize, cursor', async () => {
    const deps: AnalyticsHandlersMockDeps = {
      createMockInteraction: jest.fn(),
      getSummary: jest.fn(),
      getInteractions: jest.fn().mockResolvedValue({
        interactions: [],
        nextCursor: null,
      }),
    };
    const app = createApp(deps, 'user-99');

    const response = await request(app).get('/interactions?pageSize=25&cursor=cursor-1');

    expect(response.status).toBe(200);
    expect(deps.getInteractions).toHaveBeenCalledWith({
      user: 'user-99',
      pageSize: 25,
      cursor: 'cursor-1',
    });
  });
});
