import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  attachReportItems,
  confirmReport,
  createReport,
  previewIntegrationItems,
} from '../api/reports';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { WorkItem, WorkItemType } from '../types/work-item';
import { ReportRow } from '../types/report-row';
import { normalizeWorkItemsToRows } from '../types/report-normalizer';

const periodOptions = [30, 45, 60] as const;

type AuthUserForReport = {
  employeeId: string;
  name: string;
  position: string;
  department: string;
  managerName: string;
};

type BuilderRow = ReportRow & {
  rowId: string;
  source: WorkItem['source'];
  itemType: WorkItemType;
  externalId: string;
  itemTitle: string;
  url?: string;
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
  const user = auth.user as AuthUserForReport | null;
  const accessToken = auth.accessToken;
  const navigate = useNavigate();
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [customPeriodDays, setCustomPeriodDays] = useState<number>(30);

  const activePeriodDays = periodDays === 0 ? customPeriodDays : periodDays;
  const reportPeriodStart = useMemo(
    () => getReportPeriodStart(activePeriodDays),
    [activePeriodDays],
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
      );
      const safeItems = Array.isArray(items) ? items : [];
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
        ...buildReportRows(safeItems, userInfo, reportPeriodStart),
      ]);
      markDirty();
      setMessage(
        safeItems.length
          ? `Loaded ${safeItems.length} integration work items.`
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
      const report = await createReport(accessToken, activePeriodDays);
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
              <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-slate-400">
                <span>Days</span>
                <input
                  type="number"
                  min={1}
                  value={customPeriodDays}
                  onChange={(event) =>
                    setCustomPeriodDays(Number(event.target.value))
                  }
                  className="w-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </label>
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
            <table className="min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-ink-muted dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Employee ID
                  </th>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Name Surname
                  </th>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Title + Department
                  </th>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Approving Manager
                  </th>
                  <th className="sticky top-0 border-b border-slate-200 px-3 py-3 text-left dark:border-slate-800">
                    Month
                  </th>
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
                        readOnly
                        value={row.employeeId}
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        readOnly
                        value={row.name}
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        readOnly
                        value={row.title}
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        readOnly
                        value={row.manager}
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        readOnly
                        value={row.month}
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
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
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 dark:text-emerald-300 underline"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            —
                          </span>
                        )}
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
