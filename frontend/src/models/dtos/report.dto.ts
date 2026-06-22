import type {
  WorkItem,
  WorkItemSource,
  WorkItemType,
} from '../../types/work-item';

export type ReportStatus = 'DRAFT' | 'SUBMITTED';

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

export type ReportDto = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  reportItems: StoredReportItemDto[];
  workItems: WorkItem[];
};

export type AttachWorkItemDto = {
  source: WorkItemSource;
  type: WorkItemType;
  externalId: string;
  title: string;
  url?: string;
  activityCreatedAt?: string;
  activityUpdatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type CreateManualWorkItemDto = {
  title: string;
  type: Extract<WorkItemType, 'NOTE' | 'TASK' | 'CUSTOM'>;
  description?: string;
};

export type EmailDraftDto = {
  receiverEmail: string;
  ccEmail: string;
  subject: string;
  body: string;
  tablePreviewHtml: string;
  xlsxFileName: string;
};

export type DeleteReportResponseDto = {
  deleted: boolean;
  reportId: string;
};
