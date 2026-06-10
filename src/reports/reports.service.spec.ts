import * as ExcelJS from 'exceljs';
import { PrismaService } from '../database/prisma.service';
import { IntegrationService } from '../integrations/integration.service';
import { ReportsService } from './reports.service';

describe('ReportsService email and XLSX output', () => {
  let service: ReportsService;
  let prisma: {
    report: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  const user = {
    id: 'user-1',
    email: 'employee@example.com',
    fullname: 'Jan Kowalski',
    employeeId: 'EMP-7',
    position: 'Developer',
    department: 'Engineering',
    managerName: 'Anna Manager',
    managerEmail: 'manager@example.com',
    reportReceiverEmail: null,
    reportEmailSubjectTemplate: null,
    reportEmailBodyTemplate: null,
  };

  const report = {
    id: 'report-1',
    userId: 'user-1',
    periodStart: new Date('2026-05-01T00:00:00.000Z'),
    periodEnd: new Date('2026-05-31T23:59:59.000Z'),
    user,
    reportItems: [
      {
        id: 'item-1',
        title: 'KAN-8 Report task',
        url: 'https://example.atlassian.net/browse/KAN-8',
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        metadata: {
          workTitles: 'KAN-8 Report task',
          workStages: 'Reporting epic',
          stageUrl: 'https://example.atlassian.net/browse/KAN-1',
          repoLinks:
            'https://github.com/example/app/pull/1\nhttps://gitlab.example.com/team/app/-/merge_requests/2',
          repositoryLinks: [
            {
              label: 'GitHub PR',
              url: 'https://github.com/example/app/pull/1',
            },
            {
              label: 'GitLab MR',
              url: 'https://gitlab.example.com/team/app/-/merge_requests/2',
            },
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      report: { findFirst: jest.fn().mockResolvedValue(report) },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
    };
    service = new ReportsService(
      prisma as unknown as PrismaService,
      {} as IntegrationService,
    );
  });

  it('renders Polish defaults, placeholders, and linked eight-column HTML', async () => {
    const draft = await service.getEmailDraft('user-1', 'report-1');

    expect(draft.receiverEmail).toBe('manager@example.com');
    expect(draft.subject).toBe('KUP50 — raport za miesiąc: maj — Jan Kowalski');
    expect(draft.body).toContain(
      'przesyłam raport KUP50 za okres 01.05.2026 – 31.05.2026.',
    );
    expect(draft.tablePreviewHtml.match(/<th>/g) ?? []).toHaveLength(8);
    expect(draft.tablePreviewHtml).toContain(
      'href="https://example.atlassian.net/browse/KAN-8"',
    );
    expect(draft.tablePreviewHtml).toContain(
      'href="https://example.atlassian.net/browse/KAN-1"',
    );
    expect(draft.tablePreviewHtml).toContain(
      'href="https://github.com/example/app/pull/1"',
    );
  });

  it('exports all eight columns with title, stage, and repository hyperlinks', async () => {
    const result = await service.exportXlsx('user-1', 'report-1');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);
    const worksheet = workbook.getWorksheet('KUP50');

    expect(worksheet).toBeDefined();
    expect(worksheet?.getRow(1).cellCount).toBe(8);
    expect(worksheet?.getRow(2).getCell(5).value).toBe('maj');
    expect(worksheet?.getRow(2).getCell(6).value).toEqual(
      expect.objectContaining({
        hyperlink: 'https://example.atlassian.net/browse/KAN-8',
      }),
    );
    expect(worksheet?.getRow(2).getCell(7).value).toEqual(
      expect.objectContaining({
        hyperlink: 'https://example.atlassian.net/browse/KAN-1',
      }),
    );
    expect(worksheet?.getRow(2).getCell(8).value).toEqual(
      expect.objectContaining({
        formula: expect.stringContaining('HYPERLINK'),
      }),
    );
  });
});
