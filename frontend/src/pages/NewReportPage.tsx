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
        className="block text-[#d966ff] underline hover:text-[#bf3fff] transition-colors"
      >
        {link}
      </a>
    ) : (
      <span key={`${link}-${index}`} className="block text-white/70">
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

      {message ? (
        <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm text-white shadow-violet-500/10">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-[rgba(157,0,255,0.10)] px-4 py-3 text-sm text-rose-100 shadow-rose-500/10">
          {error}
        </div>
      ) : null}

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
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_auto_auto] lg:items-end">
            <label className="flex flex-col gap-1 text-sm text-ink-muted dark:text-slate-400">
              <span>Period</span>
              <select
                value={periodDays}
                onChange={(event) => setPeriodDays(Number(event.target.value))}
                className="input-glass period-select min-w-[150px]"
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
                <label className="flex flex-col gap-1 text-sm text-ink-muted dark:text-slate-400">
                  <span>From</span>
                  <input
                    type="date"
                    value={customPeriodStart}
                    onChange={(event) =>
                      setCustomPeriodStart(event.target.value)
                    }
                    className="input-glass"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-muted dark:text-slate-400">
                  <span>To</span>
                  <input
                    type="date"
                    value={customPeriodEnd}
                    onChange={(event) => setCustomPeriodEnd(event.target.value)}
                    className="input-glass"
                  />
                </label>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void handleFetchItems()}
              disabled={loadingItems}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70 lg:col-start-4"
            >
              {loadingItems ? 'Loading…' : 'Load items'}
            </button>
            <button
              type="button"
              onClick={handleAddManualRow}
              className="btn-outline w-full"
            >
              Add manual row
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-5 text-sm text-ink-muted dark:text-slate-400">
            No rows loaded.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/10 shadow-[0_12px_30px_rgba(157,0,255,0.12)]">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm text-[#eae9fc]">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[30%]" />
                <col className="w-[36%]" />
              </colgroup>
              <thead className="bg-white/[0.08] text-xs uppercase tracking-wide text-[#eae9fc] backdrop-blur-sm">
                <tr>
                  <th className="sticky top-0 border-b border-white/10 px-3 py-3 text-left text-white/80">
                    Creative Work Titles
                  </th>
                  <th className="sticky top-0 border-b border-white/10 px-3 py-3 text-left text-white/80">
                    Creative Work Stages
                  </th>
                  <th className="sticky top-0 border-b border-white/10 px-3 py-3 text-left text-white/80">
                    Repository Links
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.rowId}
                    className="border-b border-white/10 align-top transition-colors last:border-b-0 hover:bg-violet-500/[0.06]"
                  >
                    <td className="px-4 py-4">
                      <input
                        value={row.workTitles}
                        placeholder="Creative work title"
                        onChange={(event) =>
                          updateRowField(rowIndex, 'workTitles', event.target.value)
                        }
                        className="input-glass min-h-11 w-full"
                      />
                      {row.url && row.source === 'JIRA' ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block truncate text-xs text-violet-200 underline transition-colors hover:text-white"
                          title={row.url}
                        >
                          Open Jira task
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <input
                        value={row.workStages}
                        placeholder="Creative work stage"
                        onChange={(event) =>
                          updateRowField(rowIndex, 'workStages', event.target.value)
                        }
                        className="input-glass min-h-11 w-full"
                      />
                      {row.stageUrl ? (
                        <a
                          href={row.stageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block truncate text-xs text-violet-200 underline transition-colors hover:text-white"
                          title={row.stageUrl}
                        >
                          Open Jira stage
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <textarea
                          value={row.repoLinks}
                          placeholder="Repository links"
                          onChange={(event) =>
                            updateRowField(rowIndex, 'repoLinks', event.target.value)
                          }
                          rows={Math.max(2, row.repositoryLinks.length)}
                          className="input-glass min-h-[72px] w-full resize-y break-all"
                        />
                        {row.repositoryLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-full truncate text-xs text-violet-200 underline transition-colors hover:text-white"
                            title={link.url}
                          >
                            {link.label}
                          </a>
                        ))}
                        <button
                          type="button"
                          onClick={() => deleteRow(rowIndex)}
                          className="btn-outline border-rose-400/30 text-rose-300 hover:bg-rose-500/10 text-xs w-full sm:w-auto"
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

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => { void handleSaveReport(false); }}
            disabled={!canSaveDraft}
            className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => { void handleSaveReport(true); }}
            disabled={!canSaveDraft}
            className="btn-outline w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving…' : 'Save and confirm'}
          </button>
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
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">{row.employeeId}</td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">{row.name}</td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">{row.title}</td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">{row.manager}</td>
                      <td className="border border-white/10 px-3 py-3 align-top text-white/80">{row.month}</td>
                      <td className="border border-white/10 px-3 py-3 align-top whitespace-pre-wrap text-white/80">{row.workTitles}</td>
                      <td className="border border-white/10 px-3 py-3 align-top whitespace-pre-wrap text-white/80">{row.workStages}</td>
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
              {'You have unsaved changes in the report builder. Choose an action before leaving.'}
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
                onClick={() => { void saveDraftAndLeave(); }}
                className="btn-primary w-full sm:w-auto"
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
