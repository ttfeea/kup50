import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../contexts/AuthContext';
import { useIntegrations } from '../contexts/IntegrationsContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import type { IntegrationProvider } from '../models/dtos/integration.dto';
import type { ReportDto } from '../models/dtos/report.dto';
import {
  formatReportPeriod,
  getReportStatusLabel,
  listReports,
  previewIntegrationItems,
} from '../services/reports';
import {
  formatWorkItemActivity,
  workItemTypeLabels,
  type WorkItem,
} from '../types/work-item';

const REPORT_DEADLINE_DAY = 27;
const HISTORY_REPORT_LIMIT = 5;
const RECENT_WORK_ITEM_LIMIT = 5;

const providerLabels: Record<IntegrationProvider, string> = {
  JIRA: 'Jira',
  GITLAB: 'GitLab',
  GITHUB: 'GitHub',
};

function getCurrentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const label = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(now);

  return { now, start, label };
}

function isSameMonth(value: string, month: Date) {
  const date = new Date(value);

  return (
    date.getFullYear() === month.getFullYear() &&
    date.getMonth() === month.getMonth()
  );
}

function isReportInMonth(report: ReportDto, month: Date) {
  return (
    isSameMonth(report.periodStart, month) ||
    isSameMonth(report.periodEnd, month)
  );
}

function sortReportsByUpdated(reports: ReportDto[]) {
  return [...reports].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function getDeadlineLabel(now: Date) {
  const deadline = new Date(
    now.getFullYear(),
    now.getMonth(),
    REPORT_DEADLINE_DAY,
    23,
    59,
    59,
  );
  const days = Math.max(
    0,
    Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  return days === 1 ? '1 day remaining' : `${days} days remaining`;
}

function formatShortDateTime(value?: string | null) {
  if (!value) {
    return 'Not checked';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function IconLink({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-[#EAE9FC] transition hover:border-primary/60 hover:bg-primary/15 hover:text-white"
      aria-label={label}
      title={label}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: ReportDto['status'] }) {
  const sent = status === 'SUBMITTED';

  return (
    <span
      className={
        sent
          ? 'shrink-0 font-medium text-success'
          : 'shrink-0 font-medium text-[#EAE9FC]'
      }
    >
      {getReportStatusLabel(status)}
    </span>
  );
}

export function DashboardPage() {
  const { accessToken } = useAuth();
  const {
    integrations,
    connectedCount,
    connectedProviders,
    loading: integrationsLoading,
  } = useIntegrations();
  const { showSnackbar } = useSnackbar();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [recentItems, setRecentItems] = useState<WorkItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setReports([]);
      setLoadingReports(false);
      return;
    }

    const authToken = accessToken;
    let cancelled = false;

    async function loadReports() {
      setLoadingReports(true);
      setReportsError(null);

      try {
        const nextReports = await listReports(authToken);
        if (!cancelled) {
          setReports(nextReports);
        }
      } catch (loadError) {
        if (!cancelled) {
          setReportsError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load reports.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingReports(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (reportsError) {
      showSnackbar(reportsError, 'error');
    }
  }, [reportsError, showSnackbar]);

  const loadRecentItems = useCallback(async () => {
    if (!accessToken || connectedCount === 0) {
      setRecentItems([]);
      setItemsError(null);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);
    setItemsError(null);

    try {
      const items = await previewIntegrationItems(
        accessToken,
        RECENT_WORK_ITEM_LIMIT,
        30,
      );
      setRecentItems(items.slice(0, RECENT_WORK_ITEM_LIMIT));
    } catch {
      setRecentItems([]);
      setItemsError('Could not load work items');
    } finally {
      setLoadingItems(false);
    }
  }, [accessToken, connectedCount]);

  useEffect(() => {
    void loadRecentItems();
  }, [loadRecentItems]);

  const monthWindow = useMemo(() => getCurrentMonthWindow(), []);
  const reportsByUpdated = useMemo(
    () => sortReportsByUpdated(reports),
    [reports],
  );
  const currentMonthReport = useMemo(
    () =>
      reportsByUpdated.find((report) =>
        isReportInMonth(report, monthWindow.start),
      ),
    [monthWindow.start, reportsByUpdated],
  );
  const latestReport = reportsByUpdated[0];
  const historyReports = reportsByUpdated.slice(0, HISTORY_REPORT_LIMIT);
  const shouldShowOnboarding =
    !integrationsLoading && !connectedProviders.includes('JIRA');
  const currentMonthStatus = currentMonthReport
    ? getReportStatusLabel(currentMonthReport.status)
    : 'Not Created';

  return (
    <div className="dashboard-page page-shell page-view space-y-4 bg-[#0a0115]">
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

      {shouldShowOnboarding ? (
        <Panel className="card-hover border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-white">
              Connect Jira to start
            </h2>
            <Link
              to="/settings"
              className="btn-primary w-full justify-center sm:w-auto"
            >
              Go to Integration Settings
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="card-hover p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink-muted dark:text-slate-400">
                Current Month Report
              </p>
              <p className="mt-2 text-xl font-semibold text-ink dark:text-white">
                {monthWindow.label}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                currentMonthStatus === 'Sent'
                  ? 'border-success/30 bg-success/10 text-success'
                  : currentMonthStatus === 'Saved'
                    ? 'border-primary/30 bg-primary/10 text-[#EAE9FC]'
                    : 'border-white/15 bg-white/5 text-[#EAE9FC]'
              }`}
            >
              {currentMonthStatus}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-xs text-ink-muted dark:text-slate-400">
                Deadline
              </p>
              <p className="mt-1 font-medium">
                {getDeadlineLabel(monthWindow.now)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-xs text-ink-muted dark:text-slate-400">
                Updated
              </p>
              <p className="mt-1 font-medium">
                {currentMonthReport
                  ? formatShortDateTime(currentMonthReport.updatedAt)
                  : '-'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            {currentMonthReport ? (
              <Link
                to={`/report/${currentMonthReport.id}`}
                className="btn-outline px-5"
              >
                View
              </Link>
            ) : (
              <Link to="/report/new" className="btn-primary px-5">
                Create
              </Link>
            )}
          </div>
        </Panel>

        <Panel className="card-hover p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink-muted dark:text-slate-400">
                Connected sources
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink dark:text-white">
                {integrationsLoading ? '...' : connectedCount}
              </p>
            </div>
            <IconLink to="/settings" label="Integration settings">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </IconLink>
          </div>
          <div className="mt-3 grid gap-2">
            {integrations.map((integration) => {
              const connected = integration.status === 'connected';
              return (
                <div
                  key={integration.provider}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {connected ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="h-4 w-4 shrink-0 text-[#EAE9FC]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-medium">
                      {providerLabels[integration.provider]}
                    </span>
                  </div>
                  <span
                    className={
                      connected
                        ? 'shrink-0 text-success'
                        : 'shrink-0 text-ink-muted'
                    }
                  >
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel className="card-hover p-4">
        <h2 className="text-base font-semibold text-ink dark:text-white">
          Latest Report
        </h2>
        {loadingReports ? (
          <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
            Loading report...
          </p>
        ) : latestReport ? (
          <Link
            to={`/report/${latestReport.id}`}
            className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-3 text-sm text-[rgba(240,230,255,0.9)] transition hover:border-primary/60 hover:bg-primary/15 hover:text-white"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {formatReportPeriod(latestReport)}
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                {latestReport.workItems.length} items / Updated{' '}
                {formatShortDateTime(latestReport.updatedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              <StatusBadge status={latestReport.status} />
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </Link>
        ) : (
          <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
            No reports yet.
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="card-hover p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink dark:text-white">
              History
            </h2>
            <IconLink to="/reports" label="History">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </IconLink>
          </div>
          {loadingReports ? (
            <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
              Loading reports...
            </p>
          ) : historyReports.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
              No reports yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {historyReports.map((report) => (
                <Link
                  key={report.id}
                  to={`/report/${report.id}`}
                  className="block cursor-pointer rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-[rgba(240,230,255,0.85)] transition hover:border-primary/50 hover:bg-primary/10 hover:text-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {formatReportPeriod(report)}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                    {report.workItems.length} items
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="card-hover p-4">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Recent Work Items
          </h2>
          {loadingItems ? (
            <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
              Loading items...
            </p>
          ) : itemsError ? (
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-muted dark:text-slate-400">
                {itemsError}
              </span>
              <button
                type="button"
                onClick={() => {
                  void loadRecentItems();
                }}
                className="btn-outline px-5"
              >
                Retry
              </button>
            </div>
          ) : recentItems.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
              No recent items.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentItems.map((item) => (
                <a
                  key={`${item.source}-${item.type}-${item.externalId}`}
                  href={item.url || undefined}
                  target={item.url ? '_blank' : undefined}
                  rel={item.url ? 'noreferrer' : undefined}
                  className="block cursor-pointer rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-[rgba(240,230,255,0.85)] transition hover:border-primary/50 hover:bg-primary/10 hover:text-white"
                >
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
                    {workItemTypeLabels[item.type]} / {item.source} /{' '}
                    {formatWorkItemActivity(item)}
                  </p>
                </a>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
