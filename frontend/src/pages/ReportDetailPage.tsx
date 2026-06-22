import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  confirmReport,
  deleteDraftReport,
  downloadReportXlsx,
  formatReportPeriod,
  getReportStatusLabel,
  getEmailDraft,
  getReport,
} from '../services/reports';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import {
  EMAIL_DRAFT_FALLBACK_NOTE,
  XLSX_ATTACHMENT_NOTE,
} from '../constants/emailTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import type { EmailDraftDto, ReportDto } from '../models/dtos/report.dto';
import { ReportRow } from '../types/report-row';
import { normalizeWorkItemsToRows } from '../types/report-normalizer';
import { buildEmailDraftMailto } from '../utils/emailDraft';

function renderRepoLinks(repoLinks: string) {
  const links = repoLinks.split('\n').filter((link) => link.trim());
  const rendered = links.map((link, idx) => {
    const isUrl = link.startsWith('http');
    return (
      <div key={idx}>
        {isUrl ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {link}
          </a>
        ) : (
          link
        )}
      </div>
    );
  });

  return links.length > 4 ? (
    <details>
      <summary className="cursor-pointer text-primary underline">
        View all links ({links.length})
      </summary>
      <div className="mt-2 space-y-1">{rendered}</div>
    </details>
  ) : (
    rendered
  );
}

async function copyPlainText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Copy failed');
  }
}

function CopyButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-[#EAE9FC] hover:border-primary/50 hover:bg-primary/10"
      aria-label={label}
      title={label}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const { showSnackbar } = useSnackbar();
  const accessToken = auth.accessToken;
  const user = auth.user;
  const [report, setReport] = useState<ReportDto | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraftDto | null>(null);
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [showSentModal, setShowSentModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !id) {
      setLoading(false);
      return;
    }

    const authToken = accessToken;
    const reportId = id;
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError(null);
      setReport(null);
      setRows([]);

      try {
        const nextReport = await getReport(authToken, reportId);
        if (!cancelled) {
          setReport(nextReport);

          const userInfo: {
            employeeId: string;
            name: string;
            title: string;
            department: string;
            manager: string;
          } = {
            employeeId: user?.employeeId ?? '',
            name: user?.name ?? '',
            title: user?.position ?? '',
            department: user?.department ?? '',
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

  useEffect(() => {
    if (error) {
      showSnackbar(error, 'error');
    }
  }, [error, showSnackbar]);

  async function handleConfirm() {
    if (!accessToken || !report) {
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const confirmed = await confirmReport(accessToken, report.id);
      setReport(confirmed);
      setShowSentModal(false);
      showSnackbar('Report marked as sent.', 'success');
    } catch (confirmError) {
      const message =
        confirmError instanceof Error
          ? confirmError.message
          : 'Could not confirm report.';
      setError(message);
      showSnackbar(message, 'error');
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
      showSnackbar('Report deleted.', 'success');
      navigate('/dashboard');
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete report.';
      setError(message);
      showSnackbar(message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleGenerateEmail() {
    if (!accessToken || !report) {
      return;
    }

    setGeneratingEmail(true);
    setError(null);
    setShowEmailFallback(false);

    try {
      setEmailDraft(await getEmailDraft(accessToken, report.id));
      showSnackbar('Email preview generated.', 'success');
    } catch (draftError) {
      const message =
        draftError instanceof Error
          ? draftError.message
          : 'Could not generate email draft.';
      setError(message);
      showSnackbar(message, 'error');
    } finally {
      setGeneratingEmail(false);
    }
  }

  async function handleCopyTable() {
    if (!emailDraft) {
      return;
    }

    const container = document.createElement('div');
    container.innerHTML = emailDraft.tablePreviewHtml;
    const plainText = Array.from(container.querySelectorAll('tr'))
      .map((row) =>
        Array.from(row.querySelectorAll('th, td'))
          .map((cell) => cell.textContent?.trim() ?? '')
          .join('\t'),
      )
      .join('\n');

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([emailDraft.tablePreviewHtml], {
              type: 'text/html',
            }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await copyPlainText(plainText);
      }
      showSnackbar('Table copied.', 'success');
    } catch {
      try {
        await copyPlainText(plainText);
        showSnackbar('Table copied as plain text.', 'success');
      } catch {
        showSnackbar('Could not copy the table.', 'error');
      }
    }
  }

  function handleOpenEmailDraft() {
    if (!emailDraft) {
      return;
    }

    const {
      receiver: receiverEmail,
      mailtoUrl,
      isTooLong,
    } = buildEmailDraftMailto(
      emailDraft.receiverEmail,
      emailDraft.ccEmail,
      emailDraft.subject,
      emailDraft.body,
    );
    setShowEmailFallback(true);

    if (!receiverEmail) {
      showSnackbar(
        'Receiver email is missing. Add it in Settings before opening the draft.',
        'warning',
      );
      return;
    }

    if (isTooLong) {
      showSnackbar(
        'The full email body is too long for some mail apps. A short draft will open; copy the full body or table manually.',
        'warning',
      );
    } else {
      showSnackbar(
        'Opening your default mail app. If nothing happens, use the copy buttons below.',
        'warning',
      );
    }

    window.location.href = mailtoUrl;
  }

  async function copyEmailField(label: string, value: string) {
    try {
      await copyPlainText(value);
      showSnackbar(`${label} copied.`, 'success');
    } catch {
      showSnackbar(`Could not copy ${label.toLowerCase()}.`, 'error');
    }
  }

  async function handleDownloadXlsx() {
    if (!accessToken || !report || !emailDraft) {
      return;
    }

    setDownloadingXlsx(true);
    setError(null);

    try {
      await downloadReportXlsx(accessToken, report.id, emailDraft.xlsxFileName);
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : 'Could not download XLSX report.';
      setError(message);
      showSnackbar(message, 'error');
    } finally {
      setDownloadingXlsx(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-ink-muted dark:text-slate-400">
        Loading report...
      </p>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Report not found.'}
        </p>
        <Link to="/dashboard" className="text-sm text-primary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const deleteButtonLabel = deleting
    ? 'Deleting...'
    : report.status === 'DRAFT'
      ? 'Delete report'
      : 'Delete report';
  const mailtoDraft = emailDraft
    ? buildEmailDraftMailto(
        emailDraft.receiverEmail,
        emailDraft.ccEmail,
        emailDraft.subject,
        emailDraft.body,
      )
    : null;

  return (
    <div className="page-shell page-view space-y-6">
      <PageHeader
        title="Report snapshot"
        description={formatReportPeriod(report)}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => {
                void handleGenerateEmail();
              }}
              disabled={generatingEmail || report.workItems.length === 0}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {generatingEmail ? 'Generating...' : 'Generate Email Preview'}
            </button>
            {report.status === 'DRAFT' ? (
              <button
                type="button"
                onClick={() => setShowSentModal(true)}
                disabled={confirming || (report.workItems?.length ?? 0) === 0}
                className="btn-outline w-full disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {confirming ? 'Saving...' : 'Mark as sent'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void handleDeleteDraft();
              }}
              disabled={deleting}
              className="btn-outline w-full border-rose-400/30 text-rose-300 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {deleteButtonLabel}
            </button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="space-y-6">
        {emailDraft ? (
          <Panel className="card-hover mx-auto w-[95%]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink dark:text-white">
                  Email preview
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmailDraft(null);
                  setShowEmailFallback(false);
                }}
                className="btn-outline"
              >
                Close preview
              </button>
            </div>
            <dl className="mt-4 grid gap-4 text-sm">
              <div>
                <dt className="text-ink-muted dark:text-slate-400">Receiver</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <span>{emailDraft.receiverEmail || '-'}</span>
                  <CopyButton
                    label="Copy recipient"
                    onClick={() => {
                      void copyEmailField(
                        'Recipient',
                        emailDraft.receiverEmail,
                      );
                    }}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted dark:text-slate-400">CC</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <span>{emailDraft.ccEmail || '-'}</span>
                  {emailDraft.ccEmail ? (
                    <CopyButton
                      label="Copy CC recipient"
                      onClick={() => {
                        void copyEmailField('CC recipient', emailDraft.ccEmail);
                      }}
                    />
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted dark:text-slate-400">Subject</dt>
                <dd className="mt-1 flex flex-wrap items-start gap-2">
                  <span className="min-w-0 flex-1">{emailDraft.subject}</span>
                  <CopyButton
                    label="Copy subject"
                    onClick={() => {
                      void copyEmailField('Subject', emailDraft.subject);
                    }}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted dark:text-slate-400">Body</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md border border-white/10 bg-[#14112B] p-3 text-[#EAE9FC]">
                  {emailDraft.body}
                </dd>
                <div className="mt-2 flex justify-end">
                  <CopyButton
                    label="Copy body"
                    onClick={() => {
                      void copyEmailField('Body', emailDraft.body);
                    }}
                  />
                </div>
              </div>
            </dl>
            <div className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-[#14112B]">
              <div
                className="min-w-[1425px] bg-[#14112B] text-xs text-[#EAE9FC] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-white/10 [&_th]:bg-[#2B294A] [&_th]:p-2.5 [&_th]:text-left [&_th]:align-top [&_th]:text-[#EAE9FC] [&_td]:border [&_td]:border-white/10 [&_td]:bg-[#14112B] [&_td]:p-2.5 [&_td]:align-top [&_td]:text-[#EAE9FC] [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{
                  __html: emailDraft.tablePreviewHtml,
                }}
              />
            </div>
            <div className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              <p>{XLSX_ATTACHMENT_NOTE}</p>
            </div>
            {showEmailFallback ? (
              <div className="mt-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm text-ink-muted dark:text-slate-400">
                  {EMAIL_DRAFT_FALLBACK_NOTE}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton
                    label="Copy receiver"
                    onClick={() => {
                      void copyEmailField(
                        'Recipient',
                        mailtoDraft?.receiver ?? '',
                      );
                    }}
                  />
                  <CopyButton
                    label="Copy subject"
                    onClick={() => {
                      void copyEmailField(
                        'Subject',
                        mailtoDraft?.subject ?? '',
                      );
                    }}
                  />
                  <CopyButton
                    label="Copy body"
                    onClick={() => {
                      void copyEmailField('Body', mailtoDraft?.body ?? '');
                    }}
                  />
                  <CopyButton
                    label="Copy all email text"
                    onClick={() => {
                      const { receiver, subject, body } = mailtoDraft ?? {
                        receiver: '',
                        subject: '',
                        body: '',
                      };
                      void copyEmailField(
                        'Email text',
                        `To: ${receiver}\nSubject: ${subject}\n\n${body}`,
                      );
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleOpenEmailDraft}
                className="btn-primary w-full sm:w-auto"
              >
                Open Email Draft
              </button>
              <CopyButton
                label="Copy table"
                onClick={() => {
                  void handleCopyTable();
                }}
              />
              <button
                type="button"
                onClick={() => {
                  void handleDownloadXlsx();
                }}
                disabled={downloadingXlsx}
                className="btn-outline w-full disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {downloadingXlsx ? 'Downloading...' : 'Download XLSX'}
              </button>
              {mailtoDraft?.mailtoUrl ? (
                <a
                  href={mailtoDraft.mailtoUrl}
                  className="self-center text-sm font-medium text-[#eae9fc] underline underline-offset-4"
                >
                  Open manually
                </a>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <Panel className="card-hover">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Report metadata
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Employee</dt>
              <dd>{user?.name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Period</dt>
              <dd>{formatReportPeriod(report)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Status</dt>
              <dd>
                <span
                  className={
                    report.status === 'SUBMITTED'
                      ? 'inline-flex rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success'
                      : 'inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-[#EAE9FC]'
                  }
                >
                  {getReportStatusLabel(report.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted dark:text-slate-400">Items</dt>
              <dd>{report.workItems?.length ?? 0}</dd>
            </div>
          </dl>
        </Panel>
        <Panel className="card-hover">
          <h2 className="text-base font-semibold text-ink dark:text-white">
            Report table
          </h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted dark:text-slate-400">
              No data to display.{' '}
              <Link to="/report/new" className="text-primary">
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
                        Work Titles
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Work Stages
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 font-semibold text-ink dark:text-white">
                        Repository Links
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          {row.employeeId}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          {row.name}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          {row.title}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                          {row.manager}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30">
                          <div className="text-xs text-ink dark:text-slate-200">
                            {row.month}
                          </div>
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30 max-w-xs">
                          <div className="text-xs text-ink dark:text-slate-200 whitespace-normal break-words">
                            {row.workTitles}
                          </div>
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 bg-slate-50 dark:bg-slate-900/30 max-w-xs">
                          <div className="text-xs text-ink dark:text-slate-200 whitespace-normal break-words">
                            {row.workStages}
                          </div>
                        </td>
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

      {showSentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[rgba(19,5,43,0.92)] p-6 shadow-[0_40px_120px_rgba(73,0,164,0.30)] backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white">
              Mark this report as sent?
            </h3>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSentModal(false)}
                className="btn-outline w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirm();
                }}
                disabled={confirming}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                Mark as sent
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
