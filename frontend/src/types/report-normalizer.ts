import { WorkItem } from './work-item';
import { ReportRow, safeString, formatMonthFromDate, formatTitleWithDepartment } from './report-row';

/**
 * Normalize a set of work items and user info into ReportRow entries.
 * Work items preserve Jira or manual edits when metadata overrides are present.
 */
export function normalizeWorkItemsToRows(
  workItems: WorkItem[] | undefined,
  userInfo: {
    employeeId?: string;
    name?: string;
    title?: string;
    department?: string;
    manager?: string;
  },
  reportPeriodStart: string | undefined,
): ReportRow[] {
  const safeWorkItems = Array.isArray(workItems) ? workItems : [];

  return safeWorkItems.map((item) => {
    const metadata = item.metadata ?? {};
    const defaultTitle = item.title?.trim() || '(untitled)';

    const workTitles =
      typeof metadata.workTitles === 'string' && metadata.workTitles.trim()
        ? metadata.workTitles.trim()
        : item.title?.trim() || '';

    const workStages =
      typeof metadata.workStages === 'string' && metadata.workStages.trim()
        ? metadata.workStages.trim()
        : item.type === 'MR'
        ? `[MR] ${defaultTitle}`
        : item.type === 'COMMIT'
        ? `[Commit] ${defaultTitle}`
        : `[${item.type}] ${defaultTitle}`;

    return {
      employeeId: safeString(userInfo.employeeId),
      name: safeString(userInfo.name),
      title: formatTitleWithDepartment(userInfo.title, userInfo.department),
      manager: safeString(userInfo.manager),
      month: formatMonthFromDate(reportPeriodStart),
      workTitles,
      workStages,
      repoLinks: item.url?.trim() || '—',
    };
  });
}

/**
 * Safely get a field value from a ReportRow, defaulting to '—' if missing.
 */
export function getRowField(row: ReportRow | undefined, field: keyof ReportRow): string {
  if (!row) {
    return '—';
  }

  const value = row[field];
  return safeString(value);
}
