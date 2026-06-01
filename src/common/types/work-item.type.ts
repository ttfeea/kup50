import { ReportItemSource, WorkItemType } from '@prisma/client';

export type WorkItem = {
  id?: string;
  source: ReportItemSource;
  type: WorkItemType;
  externalId: string;
  title: string;
  url?: string;
  activityCreatedAt?: string;
  activityUpdatedAt?: string;
  metadata?: Record<string, unknown>;
};

export const integrationSources: ReportItemSource[] = [
  ReportItemSource.JIRA,
  ReportItemSource.GITLAB,
  ReportItemSource.GITHUB,
];
