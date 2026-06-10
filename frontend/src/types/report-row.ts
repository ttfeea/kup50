/**
 * ReportRow represents a single row in the Excel-like export grid.
 * This is the source of truth for what gets exported or emailed.
 */
export type ReportRow = {
  // Editable columns (1-4)
  employeeId: string;
  name: string;
  title: string;
  manager: string;

  // Auto-generated column (5)
  month: string;

  // Read-only GitLab columns (6-8)
  workTitles: string;
  workStages: string;
  repoLinks: string;
};

/**
 * Format title and department into a single display value.
 */
export function formatTitleWithDepartment(
  title?: string,
  department?: string,
): string {
  const titleValue =
    typeof title === 'string' && title.trim() ? title.trim() : '';
  const departmentValue =
    typeof department === 'string' && department.trim()
      ? department.trim()
      : '';

  if (titleValue && departmentValue) {
    return `${titleValue} / ${departmentValue}`;
  }

  return titleValue || departmentValue || '—';
}

/**
 * Safely extract a single string value, defaulting to '—' if missing or empty.
 */
export function safeString(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return '—';
}

/**
 * Polish month names for report export.
 */
const MONTH_NAMES_PL = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
];

/**
 * Format a month name from a date string using Polish month names only.
 */
export function formatMonthFromDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return '—';
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return '—';
  }

  return MONTH_NAMES_PL[date.getMonth()] ?? '—';
}
