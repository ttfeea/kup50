import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  attachReportItems,
  confirmReport,
  createReport,
  previewIntegrationItems,
} from '../services/reports';
import { useAuth } from '../contexts/AuthContext';
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

const periodOptions = [30, 45] as const;

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
  activityCreatedAt: string;
  activityUpdatedAt: string;
};

function createRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getReportPeriodStart(periodDays: number) {
  return new Date(
    Date.now() - (periodDays - 1) * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatPeriodRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

function renderRepositoryLinks(value: string) {
  return value.split('\n').map((line, index) => {
    const link = line.trim();

    return link.startsWith('http') ? (
      <a
        key={`${link}-${index}`}
        href={link}
        target="_blank"
        rel="noreferrer"
        className="block text-emerald-700 underline dark:text-emerald-300"
      >
        {link}
      </a>
    ) : (
      <span key={`${link}-${index}`} className="block">
        {line}
      </span>
    );
  });
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
    activityCreatedAt: timestamp,
    activityUpdatedAt: timestamp,
    employeeId: userInfo.employeeId || '',
    name: userInfo.name || '',
    title:
      titleValue && departmentValue
        ? `${titleValue} / ${departmentValue}`
        : titleValue || departmentValue || '—',
    manager: userInfo.manager || '',
    month: monthLabel,
    workTitles: '',
    workStages: '',
    repoLinks: '—',
  };
}

export function NewReportPage() {
  const auth = useAuth();
  const user = auth.user;
  const accessToken = auth.accessToken;
  const navigate = useNavigate();
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [customPeriodStart, setCustomPeriodStart] = useState(() =>
    toDateInputValue(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
  );
  const [customPeriodEnd, setCustomPeriodEnd] = useState(() =>
    toDateInputValue(new Date()),
  );

  const activePeriodDays = periodDays === 0 ? 30 : periodDays;
  const reportPeriodStart = useMemo(
    () =>
      periodDays === 0
        ? new Date(`${customPeriodStart}T00:00:00`).toISOString()
        : getReportPeriodStart(activePeriodDays),
    [activePeriodDays, customPeriodStart, periodDays],
  );
  const reportPeriodEnd = useMemo(
    () =>
      periodDays === 0
        ? new Date(`${customPeriodEnd}T23:59:59.999`).toISOString()
        : new Date().toISOString(),
    [customPeriodEnd, periodDays],
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
    setMessage(null);

    try {
      const items = await previewIntegrationItems(
        accessToken,
        100,
        activePeriodDays,
        periodDays === 0
          ? new Date(`${customPeriodStart}T00:00:00`).toISOString()
          : undefined,
        periodDays === 0
          ? new Date(`${customPeriodEnd}T23:59:59.999`).toISOString()
          : undefined,
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
      setMessage(
        items.length
          ? `Loaded ${items.length} integration work items.`
          : 'No integration items returned. Check connections in Settings.',
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Could not fetch work items.',
      );
    } finally {
      setLoadingItems(false);
    }
  }

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
        next[index] = { ...row, [field]: value };
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
        activePeriodDays,
        periodDays === 0
          ? new Date(`${customPeriodStart}T00:00:00`).toISOString()
          : undefined,
        periodDays === 0
          ? new Date(`${customPeriodEnd}T23:59:59.999`).toISOString()
          : undefined,
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
  const isCustomPeriod = periodDays === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New report"
        description="Build the report table directly by loading integration rows, adding manual rows, and saving a draft before confirming."
        actions={
          <button
            type="button"
            onClick={() => requestNavigation('/dashboard')}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to dashboard
          </button>
        }
      />

      {message ? (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink dark:text-white">
              Report information
            </h2>
            <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
              Edit profile information in Settings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFullPreview(true)}
            disabled={rows.length === 0}
            className="rounded-md border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink dark:text-white">
              Report builder
            </h2>
            <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
              {
                'The table below is your main workspace. Load rows, add manual rows, then save a draft.'
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-slate-400">
              <span>Period</span>
              <select
                value={periodDays}
                onChange={(event) => setPeriodDays(Number(event.target.value))}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              >
                {periodOptions.map((value) => (
                  <option key={value} value={value}>
                    Last {value} days
                  </option>
                ))}
                <option value={0}>Custom</option>
              </select>
            </label>
            {isCustomPeriod ? (
              <>
                <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-slate-400">
                  <span>From</span>
                  <input
                    type="date"
                    value={customPeriodStart}
                    onChange={(event) =>
                      setCustomPeriodStart(event.target.value)
                    }
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-slate-400">
                  <span>To</span>
                  <input
                    type="date"
                    value={customPeriodEnd}
                    onChange={(event) => setCustomPeriodEnd(event.target.value)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </label>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void handleFetchItems()}
              disabled={loadingItems}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              {loadingItems ? 'Loading…' : 'Load from integrations'}
            </button>
            <button
              type="button"
              onClick={handleAddManualRow}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              Add manual row
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
            {
              'Load integration rows or add a manual row to begin building the report.'
            }
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-ink-muted dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Creative Work Titles
                  </th>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Creative Work Stages
                  </th>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Repository Links
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.rowId}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-3">
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
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                      {row.url && row.source === 'JIRA' ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-xs text-emerald-700 underline dark:text-emerald-300"
                        >
                          Open Jira task
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
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
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                      {row.stageUrl ? (
                        <a
                          href={row.stageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-xs text-emerald-700 underline dark:text-emerald-300"
                        >
                          Open Jira stage
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-2">
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
                          rows={Math.max(1, row.repositoryLinks.length)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {row.repositoryLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-emerald-700 underline dark:text-emerald-300"
                          >
                            {link.label}
                          </a>
                        ))}
                        <button
                          type="button"
                          onClick={() => deleteRow(rowIndex)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-slate-800 dark:text-rose-300 dark:hover:bg-slate-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void handleSaveReport(false);
            }}
            disabled={!canSaveDraft}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSaveReport(true);
            }}
            disabled={!canSaveDraft}
            className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          >
            {saving ? 'Saving…' : 'Save and confirm'}
          </button>
        </div>
      </Panel>

      {showFullPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-7xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-ink dark:text-white">
                  Full KUP50 table preview
                </h3>
                <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
                  This is the final data shape for future export and email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Close
              </button>
            </div>
            <div className="overflow-auto p-5">
              <table className="min-w-[1600px] w-full border-collapse text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900">
                  <tr>
                    {[
                      'Employee ID',
                      'Imię i nazwisko Pracownika / Name Surname',
                      'Stanowisko służbowe i departament Pracownika / Title',
                      'Imię i nazwisko Menadżera / Approving manager',
                      'Okres ewidencji / Month',
                      'Tytuły / nazwy Wyników Pracy Twórczej / Creative work titles',
                      'Tytuły / nazwy oraz etap (o ile występuje) Projektu B+R / Creative work stages',
                      'Wskazanie miejsca przechowywania lub miejsca dostarczenia Pracodawcy Wyników Pracy Twórczej (...) / Repository links',
                    ].map((header) => (
                      <th
                        key={header}
                        className="border border-slate-200 px-3 py-3 align-top font-semibold text-ink dark:border-slate-700 dark:text-white"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fullPreviewRows.map((row, index) => (
                    <tr key={rows[index]?.rowId ?? index}>
                      <td className="border border-slate-200 px-3 py-3 align-top dark:border-slate-700">
                        {row.employeeId}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top dark:border-slate-700">
                        {row.name}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top dark:border-slate-700">
                        {row.title}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top dark:border-slate-700">
                        {row.manager}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top dark:border-slate-700">
                        {row.month}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top whitespace-pre-wrap dark:border-slate-700">
                        {row.workTitles}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top whitespace-pre-wrap dark:border-slate-700">
                        {row.workStages}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top whitespace-pre-wrap break-words dark:border-slate-700">
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

      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-950">
            <h3 className="text-lg font-semibold text-ink dark:text-white">
              Unsaved work detected
            </h3>
            <p className="mt-3 text-sm text-ink-muted dark:text-slate-400">
              {
                'You have unsaved changes in the report builder. Choose an action before leaving.'
              }
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLeaveModal}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                Continue editing
              </button>
              <button
                type="button"
                onClick={() => leaveWithoutSaving()}
                className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveDraftAndLeave();
                }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Save draft and leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
