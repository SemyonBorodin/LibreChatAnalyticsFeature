import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockRefetchSummary = jest.fn();
const mockRefetchInteractions = jest.fn();

jest.mock(
  '@librechat/client',
  () => ({
    Spinner: () => null,
  }),
  { virtual: true },
);

jest.mock('~/data-provider', () => ({
  useInteractionAnalyticsSummaryQuery: jest.fn(() => ({
    data: {
      totalInteractions: 12,
      uniqueModels: 2,
      averageUserMessageLength: 18.5,
      averageAssistantMessageLength: 29.5,
      firstCreatedAt: '2026-05-09T10:00:00.000Z',
      lastCreatedAt: '2026-05-10T10:00:00.000Z',
      byModel: [
        {
          model: 'mock-model',
          count: 9,
          firstCreatedAt: '2026-05-09T10:00:00.000Z',
          lastCreatedAt: '2026-05-10T10:00:00.000Z',
        },
      ],
    },
    isLoading: false,
    refetch: mockRefetchSummary,
  })),
  useInteractionLogsQuery: jest.fn(() => ({
    data: {
      interactions: [
        {
          _id: 'interaction-1',
          user: 'user-1',
          userMessage: 'How many tokens did that use?',
          assistantMessage: 'Mock response: How many tokens did that use?',
          model: 'mock-model',
          endpoint: 'mock',
          conversationId: null,
          latencyMs: 42,
          metadata: undefined,
          createdAt: '2026-05-10T10:00:00.000Z',
          updatedAt: '2026-05-10T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    },
    isLoading: false,
    refetch: mockRefetchInteractions,
  })),
}));

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(() => (key: string) => {
    const dictionary: Record<string, string> = {
      com_ui_interaction_analytics_heading: 'Interaction analytics',
      com_ui_interaction_analytics_subheading:
        'Review user and AI interactions recorded from the normal chat flow.',
      com_ui_interaction_analytics_total: 'Total interactions',
      com_ui_interaction_analytics_models: 'Models used',
      com_ui_interaction_analytics_latest: 'Latest activity',
      com_ui_interaction_analytics_avg_user_length: 'Average request length',
      com_ui_interaction_analytics_avg_assistant_length: 'Average response length',
      com_ui_interaction_analytics_chart_title: 'Interactions by day',
      com_ui_interaction_analytics_chart_subtitle:
        'Recent interaction volume from recorded chat exchanges.',
      com_ui_interaction_analytics_chart_empty: 'No chart data yet.',
      com_ui_interaction_analytics_recent_title: 'Recent interactions',
      com_ui_interaction_analytics_recent_subtitle:
        'Latest saved user and assistant exchanges for this account.',
      com_ui_interaction_analytics_empty_title: 'No interactions yet',
      com_ui_interaction_analytics_empty_description:
        'Start a chat to generate the first recorded user and assistant exchange.',
      com_ui_interaction_analytics_empty_cta: 'Go to chat',
      com_ui_interaction_analytics_col_day: 'Day',
      com_ui_interaction_analytics_col_user: 'User message',
      com_ui_interaction_analytics_col_assistant: 'Assistant response',
      com_ui_interaction_analytics_col_model: 'Model',
      com_ui_unknown: 'Unknown',
    };
    return dictionary[key] ?? key;
  }),
}));

describe('Analytics route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders heading, summary, average lengths, chart label, and recent row', async () => {
    const { default: AnalyticsRoute } = await import('../Analytics');

    render(
      <MemoryRouter>
        <AnalyticsRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Interaction analytics' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('18.5')).toBeInTheDocument();
    expect(screen.getByText('29.5')).toBeInTheDocument();
    expect(screen.getAllByText(/May 10/i).length).toBeGreaterThan(0);
    expect(screen.getByText('How many tokens did that use?')).toBeInTheDocument();
  });
});
