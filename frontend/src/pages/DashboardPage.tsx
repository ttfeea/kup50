import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatReportPeriod, listReports } from '../services/reports';
import { useAuth } from '../contexts/AuthContext';
import { useIntegrations } from '../contexts/IntegrationsContext';
import type { ReportDto } from '../models/dtos/report.dto';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import {
  formatWorkItemActivity,
  workItemTypeLabels,
  WorkItem,
} from '../types/work-item';

export function DashboardPage() {
  const { accessToken } = useAuth();
  const { connectedCount, connectedProviders } = useIntegrations();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setReports([]);
      setLoading(false);
      return;
    }

    const authToken = accessToken;
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError(null);

      try {
        const nextReports = await listReports(authToken);
        if (!cancelled) {
          setReports(nextReports);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load reports.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const latestReport = reports[0];

  const draftCount = useMemo(
    () => reports.filter((report) => report.status === 'DRAFT').length,
    [reports],
  );

  const latestWorkItems = useMemo(() => {
    const items: Array<WorkItem & { reportId: string; reportStatus: string }> =
      [];

    for (const report of reports) {
      for (const item of report.workItems) {
        items.push({
          ...item,
          reportId: report.id,
          reportStatus: report.status,
        });
      }
    }

    const sortedItems = items.sort(
        (a, b) =>
          new Date(b.activityUpdatedAt ?? 0).getTime() -
          new Date(a.activityUpdatedAt ?? 0).getTime(),
      );
    const uniqueItems = new Map<string, (typeof sortedItems)[number]>();

    for (const item of sortedItems) {
      const key = `${item.source}:${item.type}:${item.externalId}`;
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, item);
      }
    }

    return [...uniqueItems.values()].slice(0, 10);
  }, [reports]);

  return (
    <div className="dashboard-page page-shell page-view space-y-6 bg-[#0a0115]">
      <PageHeader
        className="mb-0"
        title="Dashboard"
        actions={
          <Link
            to="/report/new"
            className="btn-primary w-full justify-center sm:w-auto"
          >
            New report
          </Link>
        }
      />

      {error ? (
        <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <p className="text-sm text-ink-muted dark:text-slate-400">
            Open drafts
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink dark:text-white">
            {loading ? '…' : draftCount}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-ink-muted dark:text-slate-400">
            Connected sources
          </p>
          <p className="mt-3 text-3xl font-semibold text-ink dark:text-white">
            {connectedCount}
          </p>
          <p
            className={`mt-2 truncate text-xs ${
              connectedProviders.length ? 'text-success' : 'text-[#eae9fc]'
            }`}
          >
            {connectedProviders.length
              ? `Connected: ${connectedProviders
                  .map((provider) =>
                    provider === 'JIRA'
                      ? 'Jira'
                      : provider === 'GITHUB'
                        ? 'GitHub'
                        : 'GitLab',
                  )
                  .join(', ')}`
              : 'No sources connected'}
          </p>
        </Panel>
      </div>

      {latestReport ? (
        <Panel>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Latest report snapshot
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted dark:text-slate-400">
            <span>{formatReportPeriod(latestReport)}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                latestReport.status === 'SUBMITTED'
                  ? 'font-medium text-success'
                  : 'font-medium text-[#EAE9FC]'
              }
            >
              {latestReport.status === 'SUBMITTED' ? 'Sent' : 'Draft'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{latestReport.workItems.length} items</span>
          </div>
          <Link
            to={`/report/${latestReport.id}`}
            className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/20 hover:text-white"
          >
            View report
          </Link>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Recent reports
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              Loading reports…
            </p>
          ) : reports.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              No reports yet.{' '}
              <Link
                to="/report/new"
                className="text-primary"
              >
                Create a report
              </Link>{' '}
              to get started.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  to={`/report/${report.id}`}
                  className="my-2 grid cursor-pointer grid-cols-3 gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-[rgba(240,230,255,0.85)] transition hover:border-primary/50 hover:bg-primary/10 hover:text-white"
                >
                  <span>{formatReportPeriod(report)}</span>
                  <span
                    className={
                      report.status === 'SUBMITTED'
                        ? 'font-medium text-success'
                        : 'font-medium text-[#EAE9FC]'
                    }
                  >
                    {report.status === 'SUBMITTED' ? 'Sent' : 'Draft'}
                  </span>
                  <span className="text-right">
                    {report.workItems.length} items
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Latest stored work items
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              Loading items…
            </p>
          ) : latestWorkItems.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              Saved work items from reports will appear here.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {latestWorkItems.map((item) => (
                <Link
                  key={`${item.reportId}-${item.id ?? item.externalId}`}
                  to={`/report/${item.reportId}`}
                  className="block cursor-pointer rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 transition hover:border-primary/50 hover:bg-[rgba(136,33,232,0.12)]"
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                    {workItemTypeLabels[item.type]} · {item.source} ·{' '}
                    {formatWorkItemActivity(item)} ·{' '}
                    <span
                      className={
                        item.reportStatus === 'SUBMITTED'
                          ? 'text-success'
                          : 'text-[#EAE9FC]'
                      }
                    >
                      {item.reportStatus === 'SUBMITTED' ? 'Sent' : 'Draft'}
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
