import { useMemo } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import type { TInteractionLog } from 'librechat-data-provider';
import { useInteractionAnalyticsSummaryQuery, useInteractionLogsQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';

type DailyInteractionBucket = {
  day: string;
  count: number;
};

function createDailyBuckets(interactions: TInteractionLog[]): DailyInteractionBucket[] {
  const counts = new Map<string, number>();

  interactions.forEach((interaction) => {
    const dayKey = format(new Date(interaction.createdAt), 'MMM d');
    counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
  });

  return Array.from(counts.entries()).map(([day, count]) => ({
    day,
    count,
  }));
}

function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return '--';
  }

  return format(new Date(timestamp), 'MMM d, yyyy HH:mm');
}

export default function Analytics() {
  const localize = useLocalize();

  const summaryQuery = useInteractionAnalyticsSummaryQuery();
  const interactionsQuery = useInteractionLogsQuery({ pageSize: 20 });

  const summary = summaryQuery.data;
  const interactions = useMemo(
    () => interactionsQuery.data?.interactions ?? [],
    [interactionsQuery.data?.interactions],
  );
  const dailyBuckets = useMemo(() => createDailyBuckets(interactions), [interactions]);
  const maxBucketCount = dailyBuckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);

  const isLoading =
    (summaryQuery.isLoading && summary == null) ||
    (interactionsQuery.isLoading && interactionsQuery.data == null);
  const isEmpty = interactions.length === 0;

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-white px-5 py-4 text-sm text-text-secondary shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Spinner className="text-text-primary" />
          <span>{localize('com_ui_interaction_analytics_loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50 px-4 py-6 text-text-primary dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {localize('com_ui_interaction_analytics_heading')}
          </h1>
          <p className="text-sm text-text-secondary">
            {localize('com_ui_interaction_analytics_subheading')}
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-text-secondary">
              {localize('com_ui_interaction_analytics_total')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{summary?.totalInteractions ?? 0}</p>
          </article>
          <article className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-text-secondary">
              {localize('com_ui_interaction_analytics_models')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{summary?.uniqueModels ?? 0}</p>
          </article>
          <article className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-text-secondary">
              {localize('com_ui_interaction_analytics_latest')}
            </p>
            <p className="mt-3 text-sm font-medium">{formatTimestamp(summary?.lastCreatedAt)}</p>
          </article>
          <article className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-text-secondary">
              {localize('com_ui_interaction_analytics_avg_user_length')}
            </p>
            <p className="mt-3 text-3xl font-semibold">{summary?.averageUserMessageLength ?? 0}</p>
          </article>
          <article className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-text-secondary">
              {localize('com_ui_interaction_analytics_avg_assistant_length')}
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {summary?.averageAssistantMessageLength ?? 0}
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {localize('com_ui_interaction_analytics_chart_title')}
              </h2>
              <p className="text-sm text-text-secondary">
                {localize('com_ui_interaction_analytics_chart_subtitle')}
              </p>
            </div>
          </div>

          {dailyBuckets.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border-light bg-gray-50 px-6 text-center text-sm text-text-secondary dark:border-gray-700 dark:bg-gray-950/40">
              {localize('com_ui_interaction_analytics_chart_empty')}
            </div>
          ) : (
            <div className="flex min-h-56 items-end gap-3 overflow-x-auto rounded-2xl bg-gradient-to-b from-blue-50 to-transparent p-4 dark:from-blue-950/30">
              {dailyBuckets.map((bucket) => {
                const heightPercent =
                  maxBucketCount === 0 ? 0 : Math.max((bucket.count / maxBucketCount) * 100, 16);

                return (
                  <div
                    key={bucket.day}
                    className="flex min-w-20 flex-1 flex-col items-center gap-3"
                  >
                    <span className="text-xs font-medium text-text-secondary">{bucket.count}</span>
                    <div className="flex h-32 w-full items-end rounded-2xl bg-gray-100 px-2 py-2 dark:bg-gray-800">
                      <div
                        className="w-full rounded-xl bg-blue-500 transition-all dark:bg-blue-400"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-text-primary">{bucket.day}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border-light bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              {localize('com_ui_interaction_analytics_recent_title')}
            </h2>
            <p className="text-sm text-text-secondary">
              {localize('com_ui_interaction_analytics_recent_subtitle')}
            </p>
          </div>

          {isEmpty ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-gray-50 px-6 text-center dark:border-gray-700 dark:bg-gray-950/40">
              <h3 className="text-lg font-semibold">
                {localize('com_ui_interaction_analytics_empty_title')}
              </h3>
              <p className="mt-2 max-w-xl text-sm text-text-secondary">
                {localize('com_ui_interaction_analytics_empty_description')}
              </p>
              <Link
                className="mt-5 inline-flex items-center justify-center rounded-2xl border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover dark:border-gray-700 dark:bg-gray-900"
                to="/c/new"
              >
                {localize('com_ui_interaction_analytics_empty_cta')}
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border-light dark:border-gray-800">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-light text-left text-sm dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-950/60">
                    <tr>
                      <th className="px-4 py-3 font-medium text-text-secondary">
                        {localize('com_ui_interaction_analytics_col_day')}
                      </th>
                      <th className="px-4 py-3 font-medium text-text-secondary">
                        {localize('com_ui_interaction_analytics_col_user')}
                      </th>
                      <th className="px-4 py-3 font-medium text-text-secondary">
                        {localize('com_ui_interaction_analytics_col_assistant')}
                      </th>
                      <th className="px-4 py-3 font-medium text-text-secondary">
                        {localize('com_ui_interaction_analytics_col_model')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-gray-800">
                    {interactions.map((interaction) => (
                      <tr key={interaction._id} className="align-top">
                        <td className="px-4 py-4 text-text-secondary">
                          {format(new Date(interaction.createdAt), 'MMM d')}
                        </td>
                        <td className="px-4 py-4 font-medium">{interaction.userMessage}</td>
                        <td className="px-4 py-4 text-text-secondary">
                          {interaction.assistantMessage}
                        </td>
                        <td className="px-4 py-4 text-text-secondary">
                          {interaction.model ?? localize('com_ui_unknown')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
