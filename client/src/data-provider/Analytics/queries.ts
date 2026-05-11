import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type {
  QueryObserverResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
} from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';

export const useInteractionAnalyticsSummaryQuery = (
  config?: UseQueryOptions<t.TInteractionAnalyticsSummary>,
): QueryObserverResult<t.TInteractionAnalyticsSummary> => {
  return useQuery<t.TInteractionAnalyticsSummary>(
    [QueryKeys.interactionAnalyticsSummary],
    () => dataService.getInteractionAnalyticsSummary(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useInteractionLogsQuery = (
  params: t.InteractionAnalyticsListParams = {},
  config?: UseQueryOptions<t.TInteractionLogsResponse>,
): QueryObserverResult<t.TInteractionLogsResponse> => {
  return useQuery<t.TInteractionLogsResponse>(
    [QueryKeys.interactionAnalyticsInteractions, params],
    () => dataService.getInteractionLogs(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useCreateMockInteractionMutation = (
  options?: UseMutationOptions<
    t.TCreateMockInteractionResponse,
    Error,
    t.TCreateMockInteractionRequest
  >,
): UseMutationResult<t.TCreateMockInteractionResponse, Error, t.TCreateMockInteractionRequest> => {
  const queryClient = useQueryClient();

  return useMutation<t.TCreateMockInteractionResponse, Error, t.TCreateMockInteractionRequest>(
    (payload: t.TCreateMockInteractionRequest) => dataService.createMockInteraction(payload),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.interactionAnalyticsSummary]);
        queryClient.invalidateQueries([QueryKeys.interactionAnalyticsInteractions]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};
