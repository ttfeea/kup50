import { WorkItem, WorkItemSource, WorkItemType } from '../types/work-item';
import { apiRequest } from './client';

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

export function listReports(authToken: string | null) {
  return apiRequest<ReportDto[]>('/reports', { token: authToken });
}

export function getReport(authToken: string | null, reportId: string) {
  return apiRequest<ReportDto>(`/reports/${reportId}`, { token: authToken });
}

export function createReport(
  authToken: string | null,
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

export function fetchReportPreviewItems(
  authToken: string | null,
  reportId: string,
  limit = 100,
  periodDays?: number,
) {
  const periodQuery = periodDays ? `&periodDays=${periodDays}` : '';
  return apiRequest<{ items: WorkItem[] }>(
    `/reports/${reportId}/fetch-items?limit=${limit}${periodQuery}`,
    { token: authToken },
  );
}

export async function previewIntegrationItems(
  authToken: string | null,
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

  if (Array.isArray(response)) {
    return response as WorkItem[];
  }

  return Array.isArray(response?.items) ? response.items : [];
}

export function attachReportItems(
  authToken: string | null,
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
  authToken: string | null,
  reportId: string,
  body: CreateManualWorkItemInput,
) {
  return apiRequest<WorkItem>(`/reports/${reportId}/manual-items`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify(body),
  });
}

export function confirmReport(authToken: string | null, reportId: string) {
  return apiRequest<ReportDto>(`/reports/${reportId}/confirm`, {
    method: 'POST',
    token: authToken,
  });
}

export function deleteDraftReport(authToken: string | null, reportId: string) {
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
