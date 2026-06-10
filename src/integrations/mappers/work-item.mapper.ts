import { ReportItem, WorkItemType } from '@prisma/client';
import { WorkItem } from '../../common/types/work-item.type';
import { AttachReportItemDto } from '../../reports/dto/attach-report-items.dto';

export function mapWorkItemsToAttachDto(
  items: WorkItem[],
): AttachReportItemDto[] {
  return items.map((item) => ({
    source: item.source,
    type: item.type,
    externalId: item.externalId,
    title: item.title,
    url: item.url,
    activityCreatedAt: item.activityCreatedAt,
    activityUpdatedAt: item.activityUpdatedAt,
    metadata: item.metadata,
  }));
}

export function mapReportItemToWorkItem(item: ReportItem): WorkItem {
  const metadata =
    item.metadata &&
    typeof item.metadata === 'object' &&
    !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : undefined;

  // Ensure activity timestamps are always set from metadata or item timestamps
  const activityCreatedAt =
    typeof metadata?.activityCreatedAt === 'string'
      ? metadata.activityCreatedAt
      : item.createdAt?.toISOString();

  const activityUpdatedAt =
    typeof metadata?.activityUpdatedAt === 'string'
      ? metadata.activityUpdatedAt
      : item.updatedAt?.toISOString();

  return {
    id: item.id,
    source: item.source,
    type: item.workType,
    externalId: item.externalId || `${item.source}-${item.id}`,
    title: item.title?.trim() || `(${item.workType || 'Item'})`,
    url: item.url?.trim() || undefined,
    activityCreatedAt,
    activityUpdatedAt,
    metadata,
  };
}

export function buildWorkItemMetadata(
  item: Pick<WorkItem, 'metadata' | 'activityCreatedAt' | 'activityUpdatedAt'>,
): Record<string, unknown> | undefined {
  const metadata = { ...(item.metadata ?? {}) };

  if (item.activityCreatedAt) {
    metadata.activityCreatedAt = item.activityCreatedAt;
  }

  if (item.activityUpdatedAt) {
    metadata.activityUpdatedAt = item.activityUpdatedAt;
  }

  return Object.keys(metadata).length ? metadata : undefined;
}

export function jiraIssueTypeToWorkItemType(
  issueTypeName?: string,
): WorkItemType {
  const normalized = issueTypeName?.trim().toLowerCase() ?? '';

  if (normalized.includes('task') || normalized.includes('story')) {
    return WorkItemType.TASK;
  }

  if (normalized.includes('bug') || normalized.includes('issue')) {
    return WorkItemType.ISSUE;
  }

  return WorkItemType.TASK;
}
