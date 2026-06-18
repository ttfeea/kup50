import { RotateCcw, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import type { ReportDto } from '../models/dtos/report.dto';
import {
  formatReportPeriod,
  getReportStatusLabel,
  listDeletedReports,
  listReports,
  restoreReport,
} from '../services/reports';

type HistoryTab = 'active' | 'deleted';

function ReportRow({
  report,
  deleted,
  onRestore,
  restoring,
}: {
  report: ReportDto;
  deleted?: boolean;
  onRestore?: (reportId: string) => void;
  restoring?: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-[rgba(240,230,255,0.85)] transition-[border-color,box-shadow,background-color] duration-300 ease-out hover:border-primary/45 hover:bg-primary/10 sm:grid-cols-[1.5fr_0.8fr_0.6fr_auto] sm:items-center">
      <Link
        to={deleted ? '#' : `/report/${report.id}`}
        className={`font-medium ${deleted ? 'pointer-events-none' : 'hover:text-white'}`}
      >
        {formatReportPeriod(report)}
      </Link>
      <span
        className={
          report.status === 'SUBMITTED'
            ? 'font-medium text-success'
            : 'font-medium text-[#EAE9FC]'
        }
      >
        {getReportStatusLabel(report.status)}
      </span>
      <span>{report.workItems.length} items</span>
      {deleted ? (
        <button
          type="button"
          onClick={() => onRestore?.(report.id)}
          disabled={restoring}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-[#EAE9FC] transition hover:border-primary/60 hover:bg-primary/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Restore report"
          title="Restore report"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <Link to={`/report/${report.id}`} className="btn-outline px-5">
          View
        </Link>
      )}
    </div>
  );
}

export function ReportHistoryPage() {
  const { accessToken } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [activeReports, setActiveReports] = useState<ReportDto[]>([]);
  const [deletedReports, setDeletedReports] = useState<ReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HistoryTab>('active');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  async function loadHistory(authToken: string) {
    setLoading(true);
    try {
      const [active, deleted] = await Promise.all([
        listReports(authToken),
        listDeletedReports(authToken),
      ]);
      setActiveReports(active);
      setDeletedReports(deleted);
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : 'Could not load reports.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setActiveReports([]);
      setDeletedReports([]);
      setLoading(false);
      return;
    }

    void loadHistory(accessToken);
  }, [accessToken]);

  async function handleRestore(reportId: string) {
    if (!accessToken) {
      return;
    }

    setRestoringId(reportId);
    try {
      await restoreReport(accessToken, reportId);
      showSnackbar('Report restored.', 'success');
      await loadHistory(accessToken);
      setTab('active');
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : 'Could not restore report.',
        'error',
      );
    } finally {
      setRestoringId(null);
    }
  }

  const visibleReports = tab === 'active' ? activeReports : deletedReports;

  useLayoutEffect(() => {
    if (!contentRef.current) {
      return;
    }

    setContentHeight(contentRef.current.scrollHeight);
  }, [tab, loading, visibleReports.length, restoringId]);

  return (
    <div className="page-shell page-view space-y-6">
      <PageHeader
        title="History"
        actions={
          <Link to="/report/new" className="btn-primary">
            New report
          </Link>
        }
      />

      <Panel>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={
              tab === 'active' ? 'btn-primary px-5' : 'btn-outline px-5'
            }
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab('deleted')}
            className={
              tab === 'deleted' ? 'btn-primary px-5' : 'btn-outline px-5'
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Recently Deleted
          </button>
        </div>

        <div
          className="mt-5 overflow-hidden transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={contentHeight === null ? undefined : { height: contentHeight }}
        >
          <div ref={contentRef}>
            {loading ? (
              <p className="text-sm text-ink-muted dark:text-slate-400">
                Loading reports...
              </p>
            ) : visibleReports.length === 0 ? (
              <p
                key={`${tab}-empty`}
                className="animate-[history-tab-fade_120ms_ease-out] text-sm text-ink-muted dark:text-slate-400"
              >
                No reports.
              </p>
            ) : (
              <div
                key={tab}
                className="animate-[history-tab-fade_120ms_ease-out] space-y-3"
              >
                {visibleReports.map((report) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    deleted={tab === 'deleted'}
                    restoring={restoringId === report.id}
                    onRestore={handleRestore}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>
      <style>{`
        @keyframes history-tab-fade {
          from { opacity: 0.85; }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
