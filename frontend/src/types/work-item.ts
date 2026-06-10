export type WorkItemSource = 'JIRA' | 'GITLAB' | 'GITHUB' | 'MANUAL';

export type WorkItemType =
  | 'COMMIT'
  | 'PR'
  | 'MR'
  | 'ISSUE'
  | 'TASK'
  | 'NOTE'
  | 'CUSTOM';

export type WorkItem = {
  id?: string;
  source: WorkItemSource;
  type: WorkItemType;
  externalId: string;
  title: string;
  url?: string | null;
  activityCreatedAt?: string;
  activityUpdatedAt?: string;
  metadata?: Record<string, unknown> | null;
};

export const workItemTypeLabels: Record<WorkItemType, string> = {
  COMMIT: 'Commit',
  PR: 'Pull request',
  MR: 'Merge request',
  ISSUE: 'Issue',
  TASK: 'Task',
  NOTE: 'Note',
  CUSTOM: 'Custom',
};

export function formatWorkItemActivity(item: WorkItem) {
  const value = item.activityUpdatedAt ?? item.activityCreatedAt;
  if (!value) {
    return '—';
  }

  return value.slice(0, 10);
}
