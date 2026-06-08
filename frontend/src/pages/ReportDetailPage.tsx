import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  confirmReport,
  deleteDraftReport,
  formatReportPeriod,
  getReport,
  ReportDto,
} from '../api/reports';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../contexts/AuthContext';
import { ReportRow } from '../types/report-row';
import { normalizeWorkItemsToRows } from '../types/report-normalizer';

function updateRowField(
  rows: ReportRow[],
  rowIndex: number,
  field: keyof ReportRow,
  value: string,
): ReportRow[] {
  const updated = [...rows];
  if (updated[rowIndex]) {
    updated[rowIndex] = {
      ...updated[rowIndex],
      [field]: value,
    };
  }
  return updated;
}

function renderRepoLinks(repoLinks: string) {
  return repoLinks.split('\n').map((link, idx) => {
    const isUrl = link.startsWith('http');
    return (
      <div key={idx}>
        {isUrl ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 dark:text-emerald-300 underline"
          >
            {link}
          </a>
        ) : (
          link
        )}
      </div>
    );
  });
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const accessToken = auth.accessToken;
  const user = auth.user;
  const [report, setReport] = useState<ReportDto | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError(null);
      setReport(null);
      setRows([]);

      try {
        const nextReport = await getReport(accessToken, id!);
        if (!cancelled) {
          setReport(nextReport);

          const userInfo: {
            employeeId: string;
            name: string;
            title: string;
            manager: string;
          } = {
            employeeId: user?.employeeId ?? '',
            name: user?.name ?? '',
            title: user?.position ?? '',
            manager: user?.managerName ?? '',
          };

          const normalized = normalizeWorkItemsToRows(
            nextReport.workItems,
            userInfo,
            nextReport.periodStart,
          );

          setRows(normalized);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load report.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [accessToken, id, user]);

  async function handleConfirm() {
    if (!accessToken || !report) {
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const confirmed = await confirmReport(accessToken, report.id);
      setReport(confirmed);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : 'Could not confirm report.',
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleDeleteDraft() {
    if (!accessToken || !report) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteDraftReport(accessToken, report.id);
      navigate('/dashboard');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete draft report.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-ink-muted dark:text-slate-400">
        Loading report…
      </p>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Report not found.'}
        </p>
        <Link
          to="/dashboard"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const deleteButtonLabel = deleting
    ? 'Deleting…'
    : report.status === 'DRAFT'
      ? 'Delete draft'
      : 'Delete report';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report snapshot"
        description={formatReportPeriod(report)}
        actions={
          <div className="flex gap-2">
            {report.status === 'DRAFT' ? (
              <button
                type="button"
                onClick={() => {
                  void handleConfirm();
                }}
                disabled={confirming || (report.workItems?.length ?? 0) === 0}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                {confirming ? 'Confirming…' : 'Confirm report'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void handleDeleteDraft();
              }}
              disabled={deleting}
              className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200"
            >
              {deleteButtonLabel}
            </button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="space-y-6">
        <Panel>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Report metadata
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Employee</dt>
              <dd>{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Period</dt>
              <dd>{formatReportPeriod(report)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Status</dt>
              <dd>{report.status}</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Items</dt>
              <dd>{report.workItems?.length ?? 0}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Report grid (export-ready)
          </h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              No data to display.{' '}
              <Link
                to="/report/new"
                className="text-emerald-700 dark:text-emerald-300"
              >
                Build a new report
              </Link>
              .
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <table className="min-w-[980px] w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Employee ID
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Name
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Title
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Manager
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Month
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Work Titles (GitLab)
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Work Stages (GitLab)
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Repository Links (GitLab)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        {/* Column 1: Employee ID (editable) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          <input
                            type="text"
                            value={row.employeeId}
                            onChange={(e) =>
                              setRows(
                                updateRowField(
                                  rows,
                                  rowIndex,
                                  'employeeId',
                                  e.target.value,
                                ),
                              )
                            }
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-xs"
                          />
                        </td>

                        {/* Column 2: Name (editable) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              setRows(
                                updateRowField(
                                  rows,
                                  rowIndex,
                                  'name',
                                  e.target.value,
                                ),
                              )
                            }
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-xs"
                          />
                        </td>

                        {/* Column 3: Title (editable) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) =>
                              setRows(
                                updateRowField(
                                  rows,
                                  rowIndex,
                                  'title',
                                  e.target.value,
                                ),
                              )
                            }
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-xs"
                          />
                        </td>

                        {/* Column 4: Manager (editable) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          <input
                            type="text"
                            value={row.manager}
                            onChange={(e) =>
                              setRows(
                                updateRowField(
                                  rows,
                                  rowIndex,
                                  'manager',
                                  e.target.value,
                                ),
                              )
                            }
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-xs"
                          />
                        </td>

                        {/* Column 5: Month (read-only, auto-generated) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30">
                          <div className="text-xs text-ink dark:text-slate-200">
                            {row.month}
                          </div>
                        </td>

                        {/* Column 6: Work Titles (read-only, GitLab data) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30 max-w-xs">
                          <div className="text-xs text-ink dark:text-slate-200 whitespace-normal break-words">
                            {row.workTitles}
                          </div>
                        </td>

                        {/* Column 7: Work Stages (read-only, GitLab data) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30 max-w-xs">
                          <div className="text-xs text-ink dark:text-slate-200 whitespace-normal break-words">
                            {row.workStages}
                          </div>
                        </td>

                        {/* Column 8: Repository Links (read-only, GitLab data) */}
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30 max-w-xs">
                          <div className="text-xs text-ink dark:text-slate-200 whitespace-pre-wrap break-words">
                            {renderRepoLinks(row.repoLinks)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
