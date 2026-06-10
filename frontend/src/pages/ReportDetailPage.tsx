import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  confirmReport,
  deleteDraftReport,
  downloadReportXlsx,
  formatReportPeriod,
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
import type { EmailDraftDto, ReportDto } from '../models/dtos/report.dto';
import { ReportRow } from '../types/report-row';
import { normalizeWorkItemsToRows } from '../types/report-normalizer';
import { buildEmailDraftMailto } from '../utils/emailDraft';

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
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraftDto | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [emailActionMessage, setEmailActionMessage] = useState<string | null>(
    null,
  );
  const [showEmailFallback, setShowEmailFallback] = useState(false);
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

  async function handleGenerateEmail() {
    if (!accessToken || !report) {
      return;
    }

    setGeneratingEmail(true);
    setError(null);
    setCopyMessage(null);
    setEmailActionMessage(null);
    setShowEmailFallback(false);

    try {
      setEmailDraft(await getEmailDraft(accessToken, report.id));
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? draftError.message
          : 'Could not generate email draft.',
      );
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
      setCopyMessage('Table copied.');
    } catch {
      try {
        await copyPlainText(plainText);
        setCopyMessage('Table copied as plain text.');
      } catch {
        setCopyMessage('Could not copy the table.');
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
      emailDraft.subject,
      emailDraft.body,
    );
    setShowEmailFallback(true);

    if (!receiverEmail) {
      setEmailActionMessage(
        'Receiver email is missing. Add it in Settings before opening the draft.',
      );
      return;
    }

    if (isTooLong) {
      setEmailActionMessage(
        'The full email body is too long for some mail apps. A short draft will open; copy the full body or table manually.',
      );
    } else {
      setEmailActionMessage(
        'Opening your default mail app. If nothing happens, use the copy buttons below.',
      );
    }

    window.location.href = mailtoUrl;
  }

  async function copyEmailField(label: string, value: string) {
    try {
      await copyPlainText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(`Could not copy ${label.toLowerCase()}.`);
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
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Could not download XLSX report.',
      );
    } finally {
      setDownloadingXlsx(false);
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
  const mailtoDraft = emailDraft
    ? buildEmailDraftMailto(
        emailDraft.receiverEmail,
        emailDraft.subject,
        emailDraft.body,
      )
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report snapshot"
        description={formatReportPeriod(report)}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void handleGenerateEmail();
              }}
              disabled={generatingEmail || report.workItems.length === 0}
              className="rounded-md border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              {generatingEmail ? 'Generating...' : 'Generate Email Preview'}
            </button>
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
        {emailDraft ? (
          <Panel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink dark:text-white">
                  Email preview
                </h2>
                <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
                  Review the message, then open a real draft in your default
                  mail app.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmailDraft(null);
                  setEmailActionMessage(null);
                  setCopyMessage(null);
                  setShowEmailFallback(false);
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800"
              >
                Close preview
              </button>
            </div>
            <dl className="mt-4 grid gap-4 text-sm">
              <div>
                <dt className="text-ink-muted dark:text-slate-400">Receiver</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <span>{emailDraft.receiverEmail || '—'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void copyEmailField(
                        'Recipient',
                        emailDraft.receiverEmail,
                      );
                    }}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Copy recipient
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted dark:text-slate-400">Subject</dt>
                <dd className="mt-1 flex flex-wrap items-start gap-2">
                  <span className="min-w-0 flex-1">{emailDraft.subject}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void copyEmailField('Subject', emailDraft.subject);
                    }}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Copy subject
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted dark:text-slate-400">Body</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                  {emailDraft.body}
                </dd>
                <button
                  type="button"
                  onClick={() => {
                    void copyEmailField('Body', emailDraft.body);
                  }}
                  className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  Copy body
                </button>
              </div>
            </dl>
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <div
                className="min-w-[1500px] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:p-3 [&_th]:text-left [&_th]:align-top [&_td]:border [&_td]:border-slate-200 [&_td]:p-3 [&_td]:align-top [&_a]:text-emerald-700 [&_a]:underline dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-900 dark:[&_td]:border-slate-700 dark:[&_a]:text-emerald-300"
                dangerouslySetInnerHTML={{
                  __html: emailDraft.tablePreviewHtml,
                }}
              />
            </div>
            <div className="mt-4 space-y-1 text-sm text-ink-muted dark:text-slate-400">
              <p>{XLSX_ATTACHMENT_NOTE}</p>
              <p>
                Automatyczne dodawanie załącznika wymaga integracji z
                Outlook/Gmail API. Obecnie możesz otworzyć szkic wiadomości i
                ręcznie dodać XLSX.
              </p>
            </div>
            {copyMessage ? (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                {copyMessage}
              </p>
            ) : null}
            {emailActionMessage ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                {emailActionMessage}
              </p>
            ) : null}
            {showEmailFallback ? (
              <div className="mt-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm text-ink-muted dark:text-slate-400">
                  {EMAIL_DRAFT_FALLBACK_NOTE}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void copyEmailField(
                        'Recipient',
                        mailtoDraft?.receiver ?? '',
                      );
                    }}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Copy receiver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyEmailField(
                        'Subject',
                        mailtoDraft?.subject ?? '',
                      );
                    }}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Copy subject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyEmailField('Body', mailtoDraft?.body ?? '');
                    }}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Copy body
                  </button>
                  <button
                    type="button"
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
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Copy all email text
                  </button>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenEmailDraft}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Open Email Draft
              </button>
              {mailtoDraft?.mailtoUrl ? (
                <a
                  href={mailtoDraft.mailtoUrl}
                  className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                >
                  Open draft manually
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void handleCopyTable();
                }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                Copy Table
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDownloadXlsx();
                }}
                disabled={downloadingXlsx}
                className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                {downloadingXlsx ? 'Downloading...' : 'Download XLSX'}
              </button>
            </div>
          </Panel>
        ) : null}

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
    </div>
  );
}
