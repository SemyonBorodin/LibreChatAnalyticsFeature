import { createAnalyticsHandlers } from './handlers';
import { createAnalyticsService } from './service';

export * from './service';
export * from './handlers';

export function createInteractionAnalyticsHandlers(
  deps: Parameters<typeof createAnalyticsService>[0],
) {
  const service = createAnalyticsService(deps);
  return createAnalyticsHandlers(service);
}
