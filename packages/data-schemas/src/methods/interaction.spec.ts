import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { IInteraction } from '~/types/interaction';
import { createModels } from '../models';
import { createInteractionMethods } from './interaction';

jest.mock('~/config/winston', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let mongoServer: InstanceType<typeof MongoMemoryServer>;
let Interaction: mongoose.Model<IInteraction>;
let createInteraction: ReturnType<typeof createInteractionMethods>['createInteraction'];
let getInteractions: ReturnType<typeof createInteractionMethods>['getInteractions'];
let getInteractionSummary: ReturnType<typeof createInteractionMethods>['getInteractionSummary'];

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  const models = createModels(mongoose);
  Object.assign(mongoose.models, models);
  Interaction = mongoose.models.Interaction;

  const methods = createInteractionMethods(mongoose);
  createInteraction = methods.createInteraction;
  getInteractions = methods.getInteractions;
  getInteractionSummary = methods.getInteractionSummary;

  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Interaction Methods', () => {
  beforeEach(async () => {
    await Interaction.deleteMany({});
  });

  it('creates an interaction for the scoped user', async () => {
    const interaction = await createInteraction({
      user: 'user-1',
      userMessageId: 'user-msg-1',
      assistantMessageId: 'assistant-msg-1',
      userMessage: 'Hello',
      assistantMessage: 'Hi there',
      model: 'mock-model',
    });

    expect(interaction.user).toBe('user-1');
    expect(interaction.userMessage).toBe('Hello');
    expect(interaction.assistantMessage).toBe('Hi there');
    expect(interaction.userMessageId).toBe('user-msg-1');
    expect(interaction.assistantMessageId).toBe('assistant-msg-1');
    expect(interaction.status).toBe('success');
    expect(interaction.model).toBe('mock-model');
  });

  it('is idempotent by assistantMessageId', async () => {
    const first = await createInteraction({
      user: 'user-1',
      userMessageId: 'user-msg-1',
      assistantMessageId: 'assistant-msg-1',
      userMessage: 'Hello',
      assistantMessage: 'Hi there',
      model: 'model-a',
    });

    const second = await createInteraction({
      user: 'user-1',
      userMessageId: 'user-msg-1',
      assistantMessageId: 'assistant-msg-1',
      userMessage: 'Hello again',
      assistantMessage: 'Different duplicate payload',
      model: 'model-b',
    });

    const count = await Interaction.countDocuments({});

    expect(count).toBe(1);
    expect(second._id.toString()).toBe(first._id.toString());
    expect(second.userMessage).toBe('Hello');
    expect(second.assistantMessage).toBe('Hi there');
    expect(second.model).toBe('model-a');
  });

  it('keeps idempotency scoped per user', async () => {
    await createInteraction({
      user: 'user-1',
      userMessageId: 'user-msg-1',
      assistantMessageId: 'shared-assistant-msg',
      userMessage: 'Hello from user one',
      assistantMessage: 'Hi user one',
      model: 'model-a',
    });

    await createInteraction({
      user: 'user-2',
      userMessageId: 'user-msg-2',
      assistantMessageId: 'shared-assistant-msg',
      userMessage: 'Hello from user two',
      assistantMessage: 'Hi user two',
      model: 'model-a',
    });

    const count = await Interaction.countDocuments({});
    const userOne = await getInteractions({ user: 'user-1' });
    const userTwo = await getInteractions({ user: 'user-2' });

    expect(count).toBe(2);
    expect(userOne.interactions).toHaveLength(1);
    expect(userOne.interactions[0].userMessage).toBe('Hello from user one');
    expect(userTwo.interactions).toHaveLength(1);
    expect(userTwo.interactions[0].userMessage).toBe('Hello from user two');
  });

  it('lists interactions with user scoping and cursor pagination', async () => {
    await createInteraction({
      user: 'user-1',
      userMessage: 'first',
      assistantMessage: 'assistant-first',
      model: 'model-a',
    });
    await sleep(5);
    await createInteraction({
      user: 'user-1',
      userMessage: 'second',
      assistantMessage: 'assistant-second',
      model: 'model-a',
    });
    await sleep(5);
    await createInteraction({
      user: 'user-1',
      userMessage: 'third',
      assistantMessage: 'assistant-third',
      model: 'model-b',
    });
    await createInteraction({
      user: 'user-2',
      userMessage: 'other-user',
      assistantMessage: 'assistant-other',
      model: 'model-a',
    });

    const firstPage = await getInteractions({
      user: 'user-1',
      pageSize: 2,
    });

    expect(firstPage.interactions).toHaveLength(2);
    expect(firstPage.interactions.map((interaction) => interaction.userMessage)).toEqual([
      'third',
      'second',
    ]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await getInteractions({
      user: 'user-1',
      pageSize: 2,
      cursor: firstPage.nextCursor,
    });

    expect(secondPage.interactions).toHaveLength(1);
    expect(secondPage.interactions[0].userMessage).toBe('first');
    expect(secondPage.nextCursor).toBeNull();
  });

  it('aggregates summary data per model for the scoped user', async () => {
    await createInteraction({
      user: 'user-1',
      userMessage: 'one',
      assistantMessage: 'assistant-one',
      model: 'model-a',
    });
    await createInteraction({
      user: 'user-1',
      userMessage: 'two',
      assistantMessage: 'assistant-two',
      model: 'model-a',
    });
    await createInteraction({
      user: 'user-1',
      userMessage: 'three',
      assistantMessage: 'assistant-three',
      model: 'model-b',
    });
    await createInteraction({
      user: 'user-2',
      userMessage: 'four',
      assistantMessage: 'assistant-four',
      model: 'model-z',
    });

    const summary = await getInteractionSummary({ user: 'user-1' });

    expect(summary.totalInteractions).toBe(3);
    expect(summary.uniqueModels).toBe(2);
    expect(summary.averageUserMessageLength).toBeCloseTo(3.7, 1);
    expect(summary.averageAssistantMessageLength).toBeCloseTo(13.7, 1);
    expect(summary.byModel).toEqual([
      expect.objectContaining({ model: 'model-a', count: 2 }),
      expect.objectContaining({ model: 'model-b', count: 1 }),
    ]);
    expect(summary.firstCreatedAt).toBeInstanceOf(Date);
    expect(summary.lastCreatedAt).toBeInstanceOf(Date);
  });
});
