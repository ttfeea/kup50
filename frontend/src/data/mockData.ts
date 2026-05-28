export const reportItems = [
  {
    source: 'Jira',
    title: 'Refined payroll export edge cases',
    type: 'Story',
    status: 'Ready for review',
  },
  {
    source: 'GitHub',
    title: 'Opened PR for report preview shell',
    type: 'Pull request',
    status: 'Open',
  },
  {
    source: 'GitLab',
    title: 'Resolved permissions smoke-test issue',
    type: 'Issue',
    status: 'Closed',
  },
];

export const recentReports = [
  { id: '1', period: 'May 2026', status: 'Draft', items: 8 },
  { id: '2', period: 'April 2026', status: 'Submitted', items: 12 },
  { id: '3', period: 'March 2026', status: 'Submitted', items: 9 },
];

export const integrations = [
  { name: 'Jira', status: 'Connected', detail: 'kup50.atlassian.net' },
  { name: 'GitHub', status: 'Connected', detail: 'marta-kup50' },
  { name: 'GitLab', status: 'Not configured', detail: 'Manual setup pending' },
];
