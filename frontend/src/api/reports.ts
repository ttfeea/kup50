import { WorkItem, WorkItemSource, WorkItemType } from '../types/work-item';
import { apiRequest, downloadApiFile } from './client';

export type ReportStatus = 'DRAFT' | 'SUBMITTED';

export type ReportDto = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  reportItems: StoredReportItemDto[];
  workItems: WorkItem[];
};

export type StoredReportItemDto = {
  id: string;
  reportId: string;
  source: WorkItemSource;
  workType: WorkItemType;
  externalId: string;
  title: string;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AttachWorkItemInput = {
  source: WorkItemSource;
  type: WorkItemType;
  externalId: string;
  title: string;
  url?: string;
  activityCreatedAt?: string;
  activityUpdatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type CreateManualWorkItemInput = {
  title: string;
  type: Extract<WorkItemType, 'NOTE' | 'TASK' | 'CUSTOM'>;
  description?: string;
};

export type EmailDraftDto = {
  receiverEmail: string;
  subject: string;
  body: string;
  tablePreviewHtml: string;
  xlsxFileName: string;
};

export function listReports(authToken: string) {
  return apiRequest<ReportDto[]>('/reports', { token: authToken });
}

export function getReport(authToken: string, reportId: string) {
  return apiRequest<ReportDto>(`/reports/${reportId}`, { token: authToken });
}

export function createReport(
  authToken: string,
  periodDays = 30,
  periodStart?: string,
  periodEnd?: string,
) {
  return apiRequest<ReportDto>('/reports', {
    method: 'POST',
    token: authToken,
    body: JSON.stringify({
      status: 'DRAFT',
      periodDays,
      periodStart,
      periodEnd,
    }),
  });
}

export async function previewIntegrationItems(
  authToken: string,
  limit = 100,
  periodDays = 30,
  periodStart?: string,
  periodEnd?: string,
) {
  const periodQuery =
    periodStart && periodEnd
      ? `&periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`
      : `&periodDays=${periodDays}`;
  const response = await apiRequest<{ items: WorkItem[] }>(
    `/integrations/preview?limit=${limit}${periodQuery}`,
    { token: authToken },
  );

  return response.items;
}

export function attachReportItems(
  authToken: string,
  reportId: string,
  items: AttachWorkItemInput[],
) {
  return apiRequest<ReportDto>(`/reports/${reportId}/items`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify({ items }),
  });
}

export function addManualWorkItem(
  authToken: string,
  reportId: string,
  body: CreateManualWorkItemInput,
) {
  return apiRequest<WorkItem>(`/reports/${reportId}/manual-items`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify(body),
  });
}

export function confirmReport(authToken: string, reportId: string) {
  return apiRequest<ReportDto>(`/reports/${reportId}/confirm`, {
    method: 'POST',
    token: authToken,
  });
}

export function getEmailDraft(authToken: string, reportId: string) {
  return apiRequest<EmailDraftDto>(`/reports/${reportId}/email-draft`, {
    token: authToken,
  });
}

export async function downloadReportXlsx(
  authToken: string,
  reportId: string,
  fileName: string,
) {
  return downloadApiFile(
    `/reports/${reportId}/export-xlsx`,
    fileName,
    authToken,
  );
}

export function deleteDraftReport(authToken: string, reportId: string) {
  return apiRequest<{ deleted: boolean; reportId: string }>(
    `/reports/${reportId}`,
    {
      method: 'DELETE',
      token: authToken,
    },
  );
}

export function formatReportPeriod(
  report: Pick<ReportDto, 'periodStart' | 'periodEnd'>,
) {
  const start = new Date(report.periodStart);
  const end = new Date(report.periodEnd);

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
