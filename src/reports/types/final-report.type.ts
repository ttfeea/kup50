export type FinalReportLink = {
  label: string;
  url: string;
};

export type FinalReportRow = {
  employeeId: string;
  fullname: string;
  title: string;
  managerName: string;
  month: string;
  workTitles: string;
  workTitleUrl?: string;
  workStages: string;
  workStageUrl?: string;
  repositoryLinksText: string;
  repositoryLinks: FinalReportLink[];
};

export type FinalReportDto = {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  rows: FinalReportRow[];
};
