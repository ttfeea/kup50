import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  attachReportItems,
  confirmReport,
  createReport,
  previewIntegrationItems,
} from '../services/reports';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { WorkItem, WorkItemType } from '../types/work-item';
import {
  formatMonthFromDate,
  formatTitleWithDepartment,
  ReportRow,
  safeString,
} from '../types/report-row';
import { normalizeWorkItemsToRows } from '../types/report-normalizer';

type RepositoryLink = {
  label: string;
  url: string;
};

type BuilderRow = ReportRow & {
  rowId: string;
  source: WorkItem['source'];
  itemType: WorkItemType;
  externalId: string;
  itemTitle: string;
  url?: string;
  stageUrl?: string;
  repositoryLinks: RepositoryLink[];
  repositorySummaryLinks: RepositoryLink[];
  activityCreatedAt: string;
  activityUpdatedAt: string;
};

function createRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toPeriodStart(date: string) {
  return `${date}T00:00:00.000Z`;
}

function toPeriodEnd(date: string) {
  return `${date}T23:59:59.999Z`;
}

function formatPeriodRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

function renderRepositoryLinks(value: string) {
  const lines = value.split('\n').filter((line) => line.trim());
  const rendered = lines.map((line, index) => {
    const link = line.trim();

    return link.startsWith('http') ? (
      <a
        key={`${link}-${index}`}
        href={link}
        target="_blank"
        rel="noreferrer"
        className="block text-primary underline transition-colors hover:text-white"
      >
        {link}
      </a>
    ) : (
      <span key={`${link}-${index}`} className="block text-white/70">
        {line}
      </span>
    );
  });

  return lines.length > 4 ? (
    <details>
      <summary className="cursor-pointer text-primary underline">
        View all links ({lines.length})
      </summary>
      <div className="mt-2 space-y-1">{rendered}</div>
    </details>
  ) : (
    rendered
  );
}

function linksFromText(value: string, current: RepositoryLink[]) {
  const labels = new Map(current.map((link) => [link.url, link.label]));
  const links = new Map<string, RepositoryLink>();

  for (const line of value.split('\n')) {
    const url = line.trim();
    if (!/^https?:\/\//i.test(url) || links.has(url)) {
      continue;
    }
    links.set(url, { label: labels.get(url) || url, url });
  }

  return [...links.values()];
}

function buildReportRows(
  workItems: WorkItem[],
  userInfo: {
    employeeId?: string;
    name?: string;
    title?: string;
    department?: string;
    manager?: string;
  },
  reportPeriodStart: string,
): BuilderRow[] {
  const normalized = normalizeWorkItemsToRows(
    workItems,
    userInfo,
    reportPeriodStart,
  );

  return workItems.map((item, index) => ({
    ...normalized[index],
    rowId: createRowId(),
    source: item.source,
    itemType: item.type,
    externalId: item.externalId,
    itemTitle: item.title?.trim() || item.externalId,
    url: item.url ?? undefined,
    stageUrl:
      typeof item.metadata?.stageUrl === 'string'
        ? item.metadata.stageUrl
        : undefined,
    repositoryLinks: Array.isArray(item.metadata?.repositoryLinks)
      ? (item.metadata.repositoryLinks as RepositoryLink[]).filter(
          (link) =>
            typeof link?.label === 'string' && typeof link?.url === 'string',
        )
      : [],
    repositorySummaryLinks: Array.isArray(item.metadata?.repositorySummaryLinks)
      ? (item.metadata.repositorySummaryLinks as RepositoryLink[]).filter(
          (link) =>
            typeof link?.label === 'string' && typeof link?.url === 'string',
        )
      : [],
    activityCreatedAt: item.activityCreatedAt ?? new Date().toISOString(),
    activityUpdatedAt: item.activityUpdatedAt ?? new Date().toISOString(),
  }));
}

function generateManualRow(
  userInfo: {
    employeeId?: string;
    name?: string;
    title?: string;
    department?: string;
    manager?: string;
  },
  monthLabel: string,
): BuilderRow {
  const timestamp = new Date().toISOString();

  const titleValue =
    typeof userInfo.title === 'string' && userInfo.title.trim()
      ? userInfo.title.trim()
      : '';
  const departmentValue =
    typeof userInfo.department === 'string' && userInfo.department.trim()
      ? userInfo.department.trim()
      : '';

  return {
    rowId: createRowId(),
    source: 'MANUAL',
    itemType: 'CUSTOM',
    externalId: `manual:${createRowId()}`,
    itemTitle: '',
    url: undefined,
    stageUrl: undefined,
    repositoryLinks: [],
    repositorySummaryLinks: [],
    activityCreatedAt: timestamp,
    activityUpdatedAt: timestamp,
    employeeId: userInfo.employeeId || '',
    name: userInfo.name || '',
    title:
      titleValue && departmentValue
        ? `${titleValue} / ${departmentValue}`
        : titleValue || departmentValue || '-',
    manager: userInfo.manager || '',
    month: monthLabel,
    workTitles: '',
    workStages: '',
    repoLinks: '-',
  };
}

export function NewReportPage() {
  const auth = useAuth();
  const { showSnackbar } = useSnackbar();
  const user = auth.user;
  const accessToken = auth.accessToken;
  const navigate = useNavigate();
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadItemsError, setLoadItemsError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [customPeriodStart, setCustomPeriodStart] = useState(() =>
    toDateInputValue(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
  );
  const [customPeriodEnd, setCustomPeriodEnd] = useState(() =>
    toDateInputValue(new Date()),
  );
  const hasAutoLoadedItems = useRef(false);

  const reportPeriodStart = useMemo(
    () => toPeriodStart(customPeriodStart),
    [customPeriodStart],
  );
  const reportPeriodEnd = useMemo(
    () => toPeriodEnd(customPeriodEnd),
    [customPeriodEnd],
  );
  const reportInfo = useMemo(
    () => ({
      employeeId: safeString(user?.employeeId),
      name: safeString(user?.name),
      title: formatTitleWithDepartment(user?.position, user?.department),
      manager: safeString(user?.managerName),
      month: formatMonthFromDate(reportPeriodStart),
      period: formatPeriodRange(reportPeriodStart, reportPeriodEnd),
    }),
    [reportPeriodEnd, reportPeriodStart, user],
  );
  const fullPreviewRows = useMemo<ReportRow[]>(
    () =>
      rows.map((row) => ({
        employeeId: reportInfo.employeeId,
        name: reportInfo.name,
        title: reportInfo.title,
        manager: reportInfo.manager,
        month: reportInfo.month,
        workTitles: row.workTitles,
        workStages: row.workStages,
        repoLinks: row.repoLinks,
      })),
    [reportInfo, rows],
  );

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    if (message) {
      showSnackbar(message, 'success');
    }
  }, [message, showSnackbar]);

  useEffect(() => {
    if (error) {
      showSnackbar(error, 'error');
    }
  }, [error, showSnackbar]);

  function markDirty() {
    if (!dirty) {
      setDirty(true);
    }
  }

  async function handleFetchItems() {
    if (!accessToken) {
      return;
    }

    const currentUser = user;
    setLoadingItems(true);
    setError(null);
    setLoadItemsError(null);
    setMessage(null);

    try {
      if (
        !customPeriodStart ||
        !customPeriodEnd ||
        customPeriodStart > customPeriodEnd
      ) {
        throw new Error('From date must be on or before To date.');
      }

      const items = await previewIntegrationItems(
        accessToken,
        100,
        30,
        toPeriodStart(customPeriodStart),
        toPeriodEnd(customPeriodEnd),
      );
      const userInfo = currentUser
        ? (() => {
            const employeeId = currentUser.employeeId;
            const name = currentUser.name;
            const title = currentUser.position;
            const department = currentUser.department;
            const manager = currentUser.managerName;

            return { employeeId, name, title, department, manager };
          })()
        : {};
      setRows((current) => [
        ...current.filter((row) => row.source === 'MANUAL'),
        ...buildReportRows(items, userInfo, reportPeriodStart),
      ]);
      markDirty();
      if (items.length) {
        setMessage(`Loaded ${items.length} integration work items.`);
      } else {
        setMessage(null);
        showSnackbar(
          'No integration items returned. Check connections in Settings.',
          'warning',
        );
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : 'Could not load work items';
      setLoadItemsError('Could not load work items');
      setError(message);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    if (!accessToken || hasAutoLoadedItems.current) {
      return;
    }

    hasAutoLoadedItems.current = true;
    void handleFetchItems();
  }, [accessToken]);

  function handleAddManualRow() {
    const currentUser = user;
    if (!currentUser) {
      setError('Please sign in to add a manual row.');
      return;
    }

    const employeeId = currentUser.employeeId;
    const name = currentUser.name;
    const title = currentUser.position;
    const department = currentUser.department;
    const manager = currentUser.managerName;
    const userInfo = { employeeId, name, title, department, manager };

    setRows((current) => [
      ...current,
      generateManualRow(userInfo, reportPeriodStart),
    ]);
    markDirty();
    setMessage('Manual row added to the report builder.');
  }

  function updateRowField(
    index: number,
    field: keyof ReportRow,
    value: string,
  ) {
    setRows((current) => {
      const next = [...current];
      const row = next[index];
      if (row) {
        next[index] = {
          ...row,
          [field]: value,
          ...(field === 'repoLinks'
            ? {
                repositoryLinks: linksFromText(value, row.repositoryLinks),
                repositorySummaryLinks: [],
              }
            : {}),
        };
      }
      return next;
    });
    markDirty();
  }

  function deleteRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    markDirty();
  }

  async function handleSaveReport(shouldConfirm: boolean, redirectTo?: string) {
    if (!accessToken) {
      setError('Not authenticated.');
      return;
    }

    if (rows.length === 0) {
      setError('Add rows before saving.');
      return;
    }

    if (
      !customPeriodStart ||
      !customPeriodEnd ||
      customPeriodStart > customPeriodEnd
    ) {
      setError('From date must be on or before To date.');
      return;
    }

    const invalidManual = rows.find(
      (row) => row.source === 'MANUAL' && !row.workTitles.trim(),
    );

    if (invalidManual) {
      setError('Manual rows must include Creative Work Titles before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const report = await createReport(
        accessToken,
        30,
        toPeriodStart(customPeriodStart),
        toPeriodEnd(customPeriodEnd),
      );
      const itemsToAttach = rows.map((row) => ({
        source: row.source,
        type: row.itemType,
        externalId: row.externalId,
        title:
          row.source === 'MANUAL'
            ? row.workTitles || '(manual item)'
            : row.itemTitle || row.workTitles || row.workStages || '(item)',
        url: row.url,
        activityCreatedAt: row.activityCreatedAt,
        activityUpdatedAt: row.activityUpdatedAt,
        metadata: {
          workTitles: row.workTitles,
          workStages: row.workStages,
          repoLinks: row.repoLinks,
          stageUrl: row.stageUrl,
          repositoryLinks: row.repositoryLinks,
          repositorySummaryLinks: row.repositorySummaryLinks,
          repositoryLinksCollapsed: row.repositoryLinks.length > 4,
        },
      }));

      if (itemsToAttach.length) {
        await attachReportItems(accessToken, report.id, itemsToAttach);
      }

      if (shouldConfirm) {
        await confirmReport(accessToken, report.id);
      }

      setDirty(false);
      if (redirectTo) {
        navigate(redirectTo);
      } else {
        navigate(`/report/${report.id}`);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save report snapshot.',
      );
    } finally {
      setSaving(false);
    }
  }

  function requestNavigation(target: string) {
    if (!dirty) {
      navigate(target);
      return;
    }

    setPendingLocation(target);
    setShowLeaveModal(true);
  }

  function closeLeaveModal() {
    setPendingLocation(null);
    setShowLeaveModal(false);
  }

  function leaveWithoutSaving() {
    closeLeaveModal();
    if (pendingLocation) {
      navigate(pendingLocation);
    }
  }

  async function saveDraftAndLeave() {
    closeLeaveModal();
    await handleSaveReport(false, pendingLocation ?? '/dashboard');
  }

  const canSaveDraft = rows.length > 0 && !saving;
  return (
    <div className="new-report-page page-shell page-view space-y-6">
      <PageHeader
        className="mb-0"
        title="New report"
        actions={
          <button
            type="button"
            onClick={() => requestNavigation('/dashboard')}
            className="btn-outline w-full sm:w-auto"
          >
            Back to dashboard
          </button>
        }
      />

      <Panel className="card-hover">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink dark:text-white">
              Report information
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowFullPreview(true)}
            disabled={rows.length === 0}
            className="btn-outline w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
          >
            Preview full KUP50 table
          </button>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Employee ID', reportInfo.employeeId],
            ['Full Name', reportInfo.name],
            ['Position + Department', reportInfo.title],
            ['Manager Name', reportInfo.manager],
            ['Month', reportInfo.month],
            ['Period range', reportInfo.period],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted dark:text-slate-400">
                {label}
              </dt>
              <dd className="mt-1 text-ink dark:text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Report builder
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink-muted dark:text-slate-400">
              <span>From date</span>
              <input
                type="date"
                value={customPeriodStart}
                max={customPeriodEnd}
                onChange={(event) => setCustomPeriodStart(event.target.value)}
                className="input-glass"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-muted dark:text-slate-400">
              <span>To date</span>
              <input
                type="date"
                value={customPeriodEnd}
                min={customPeriodStart}
                onChange={(event) => setCustomPeriodEnd(event.target.value)}
                className="input-glass"
              />
            </label>
            {loadingItems ? (
              <span className="pb-3 text-sm text-ink-muted dark:text-slate-400">
                Loading items...
              </span>
            ) : null}
          </div>
          {loadItemsError ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-ink-muted dark:text-slate-400">
                Could not load work items
              </span>
              <button
                type="button"
                onClick={() => void handleFetchItems()}
                className="btn-outline px-5"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="mt-5 text-sm text-ink-muted dark:text-slate-400">
            No rows loaded.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/10 shadow-[0_12px_30px_rgba(136,33,232,0.12)]">
            <table className="w-full min-w-[940px] table-fixed text-left text-sm text-[#eae9fc]">
              <colgroup>
                <col className="w-[33%]" />
                <col className="w-[29%]" />
                <col className="w-[33%]" />
                <col className="w-[5%]" />
              </colgroup>
              <thead className="bg-white/[0.08] text-xs uppercase tracking-wide text-[#eae9fc] backdrop-blur-sm">
                <tr>
                  <th className="sticky top-0 border-b border-white/10 px-3 py-3 text-left text-white/80">
                    Work Titles
                  </th>
                  <th className="sticky top-0 border-b border-white/10 px-3 py-3 text-left text-white/80">
                    Work Stages
                  </th>
                  <th className="sticky top-0 border-b border-white/10 px-3 py-3 text-left text-white/80">
                    Repository Links
                  </th>
                  <th
                    className="sticky top-0 border-b border-white/10 px-2 py-3 text-center text-white/80"
                    aria-label="Row actions"
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.rowId}
                    className="border-b border-white/10 align-middle transition-colors last:border-b-0 hover:bg-violet-500/[0.06]"
                  >
                    <td className="px-4 py-4 align-middle">
                      <input
                        value={row.workTitles}
                        placeholder="Creative work title"
                        onChange={(event) =>
                          updateRowField(
                            rowIndex,
                            'workTitles',
                            event.target.value,
                          )
                        }
                        className="input-glass min-h-11 w-full"
                      />
                      {row.url && row.source === 'JIRA' ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block truncate text-xs text-primary underline transition-colors hover:text-white"
                          title={row.url}
                        >
                          Open Jira task
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <input
                        value={row.workStages}
                        placeholder="Creative work stage"
                        onChange={(event) =>
                          updateRowField(
                            rowIndex,
                            'workStages',
                            event.target.value,
                          )
                        }
                        className="input-glass min-h-11 w-full"
                      />
                      {row.stageUrl ? (
                        <a
                          href={row.stageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block truncate text-xs text-primary underline transition-colors hover:text-white"
                          title={row.stageUrl}
                        >
                          Open Jira stage
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <textarea
                        value={row.repoLinks}
                        placeholder="Repository links"
                        onChange={(event) =>
                          updateRowField(
                            rowIndex,
                            'repoLinks',
                            event.target.value,
                          )
                        }
                        rows={Math.max(
                          2,
                          Math.min(4, row.repositoryLinks.length),
                        )}
                        className="input-glass min-h-[72px] w-full resize-y break-all"
                      />
                    </td>
                    <td className="px-2 py-4 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => deleteRow(rowIndex)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/30 text-rose-300 transition-colors hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
                        aria-label={`Delete row ${rowIndex + 1}`}
                        title="Delete row"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleAddManualRow}
            className="btn-outline w-full sm:w-auto"
          >
            Add manual row
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                void handleSaveReport(false);
              }}
              disabled={!canSaveDraft}
              className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving...' : 'Save report'}
            </button>
          </div>
        </div>
      </Panel>

      {/* ── Full preview modal ── */}
      {showFullPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgba(19,5,43,0.92)] shadow-[0_40px_120px_rgba(73,0,164,0.30)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Full KUP50 table preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="btn-outline rounded-full border-white/20 px-4 py-2 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
            <div className="overflow-auto p-5">
              <table className="min-w-[1600px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/10 text-white/80">
                  <tr>
                    {' '}
                    {[
                      'Employee ID',
                      'Name Surname',
                      'Title and department',
                      'Approving manager',
                      'Month',
                      'Creative work titles',
                      'Creative work stages',
                      'Repository links',
                    ].map((header) => (
                      <th
                        key={header}
                        className="border border-white/10 px-3 py-3 align-top font-semibold text-white"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fullPreviewRows.map((row, index) => (
                    <tr key={rows[index]?.rowId ?? index}>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">
                        {row.employeeId}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">
                        {row.name}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">
                        {row.title}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">
                        {row.manager}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">
                        {row.month}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top whitespace-pre-wrap text-white/80">
                        {row.workTitles}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top whitespace-pre-wrap text-white/80">
                        {row.workStages}
                      </td>
                      <td className="border border-white/10 px-3 py-3 align-top whitespace-pre-wrap break-words text-white/80">
                        {renderRepositoryLinks(row.repoLinks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Leave modal ── */}
      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[rgba(19,5,43,0.92)] p-6 shadow-[0_40px_120px_rgba(73,0,164,0.30)] backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white">
              Unsaved work detected
            </h3>
            <p className="mt-3 text-sm text-white/60">
              {
                'You have unsaved changes in the report builder. Choose an action before leaving.'
              }
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLeaveModal}
                className="btn-outline w-full sm:w-auto"
              >
                Continue editing
              </button>
              <button
                type="button"
                onClick={() => leaveWithoutSaving()}
                className="btn-outline border-rose-400/30 text-rose-300 hover:bg-rose-500/10 w-full sm:w-auto"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveDraftAndLeave();
                }}
                className="btn-primary w-full sm:w-auto"
              >
                Save report and leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
