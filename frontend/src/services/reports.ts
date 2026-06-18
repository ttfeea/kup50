import type { IntegrationItemsResponseDto } from '../models/dtos/integration.dto';
import type {
  AttachWorkItemDto,
  CreateManualWorkItemDto,
  DeleteReportResponseDto,
  EmailDraftDto,
  ReportDto,
} from '../models/dtos/report.dto';
import type { WorkItem } from '../types/work-item';
import { apiRequest, downloadApiFile } from './client';

export function listReports(authToken: string) {
  return apiRequest<ReportDto[]>('/reports', { token: authToken });
}

export function listDeletedReports(authToken: string) {
  return apiRequest<ReportDto[]>('/reports/deleted/recent', {
    token: authToken,
  });
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
  const response = await apiRequest<IntegrationItemsResponseDto>(
    `/integrations/preview?limit=${limit}${periodQuery}`,
    { token: authToken },
  );

  return response.items;
}

export function attachReportItems(
  authToken: string,
  reportId: string,
  items: AttachWorkItemDto[],
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
  body: CreateManualWorkItemDto,
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
  return apiRequest<DeleteReportResponseDto>(`/reports/${reportId}`, {
    method: 'DELETE',
    token: authToken,
  });
}

export function restoreReport(authToken: string, reportId: string) {
  return apiRequest<ReportDto>(`/reports/${reportId}/restore`, {
    method: 'POST',
    token: authToken,
  });
}

export function getReportStatusLabel(status: ReportDto['status']) {
  return status === 'SUBMITTED' ? 'Sent' : 'Saved';
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

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
