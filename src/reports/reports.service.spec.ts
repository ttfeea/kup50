import { NotFoundException } from '@nestjs/common';
import { ReportItemSource, WorkItemType } from '@prisma/client';
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
    reportCcEmail: null,
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
    expect(draft.ccEmail).toBe('');
    expect(draft.subject).toBe('KUP50 — raport za miesiąc: maj — Jan Kowalski');
    expect(draft.body).toContain(
      'przesyłam raport KUP50 za okres 01.05.2026 – 31.05.2026.',
    );
    expect(draft.body).not.toContain('Tabela raportu');
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

  it('includes the configured CC recipient in email draft data', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      reportCcEmail: 'cc@example.com',
    });

    const draft = await service.getEmailDraft('user-1', 'report-1');

    expect(draft.ccEmail).toBe('cc@example.com');
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

  it('removes the legacy attachment sentence from saved email templates', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      reportEmailBodyTemplate:
        'Dzień dobry,\n\nTabela raportu znajduje się poniżej. Plik XLSX można również pobrać z aplikacji i dodać jako załącznik.\n\nPozdrawiam,\n{{fullname}}',
    });

    const draft = await service.getEmailDraft('user-1', 'report-1');

    expect(draft.body).not.toContain('Tabela raportu');
    expect(draft.body).toContain('Pozdrawiam,\nJan Kowalski');
  });
});

describe('ReportsService multi-user isolation', () => {
  const userA = 'user-a';
  const userB = 'user-b';
  const reportId = 'report-a';
  let service: ReportsService;
  let prisma: {
    report: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    reportItem: {
      createMany: jest.Mock;
      create: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let integrations: { fetchConfiguredItems: jest.Mock };

  beforeEach(() => {
    prisma = {
      report: {
        create: jest.fn().mockResolvedValue({ id: reportId }),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(
            where.id === reportId && where.userId === userA
              ? {
                  id: reportId,
                  userId: userA,
                  periodStart: new Date('2026-05-01T00:00:00.000Z'),
                  periodEnd: new Date('2026-05-31T23:59:59.000Z'),
                  status: 'DRAFT',
                  user: {
                    id: userA,
                    email: 'a@example.com',
                    fullname: 'User A',
                    employeeId: null,
                    position: null,
                    department: null,
                    managerName: null,
                  },
                  reportItems: [],
                }
              : null,
          ),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
      },
      reportItem: {
        createMany: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    integrations = { fetchConfiguredItems: jest.fn() };
    service = new ReportsService(
      prisma as unknown as PrismaService,
      integrations as unknown as IntegrationService,
    );
  });

  it('scopes report lists to the authenticated user', async () => {
    await service.getReportsWithWorkItems(userB);

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: userB, deletedAt: null } }),
    );
  });

  it('assigns newly created reports to the authenticated user', async () => {
    await service.create(userA, {
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-31T23:59:59.000Z',
    });

    expect(prisma.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: userA }),
    });
  });

  it.each([
    ['read', () => service.getReportWithWorkItems(userB, reportId)],
    [
      'attach items',
      () =>
        service.attachReportItems(userB, reportId, [
          {
            source: ReportItemSource.JIRA,
            type: WorkItemType.TASK,
            externalId: 'KUP-1',
            title: 'Task',
          },
        ]),
    ],
    [
      'add manual items',
      () =>
        service.addManualWorkItem(userB, reportId, {
          type: WorkItemType.CUSTOM,
          title: 'Manual',
        }),
    ],
    ['fetch items', () => service.fetchPreviewItems(userB, reportId)],
    ['confirm', () => service.confirmReport(userB, reportId)],
    ['delete', () => service.deleteDraft(userB, reportId)],
    ['generate email', () => service.getEmailDraft(userB, reportId)],
    ['export', () => service.exportXlsx(userB, reportId)],
  ])(
    'prevents user B from attempting to %s user A report',
    async (_, action) => {
      await expect(action()).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('does not perform writes or integration fetches after ownership fails', async () => {
    await expect(service.confirmReport(userB, reportId)).rejects.toThrow(
      'Report not found',
    );
    await expect(service.deleteDraft(userB, reportId)).rejects.toThrow(
      'Report not found',
    );
    await expect(
      service.attachReportItems(userB, reportId, [
        {
          source: ReportItemSource.JIRA,
          type: WorkItemType.TASK,
          externalId: 'KUP-1',
          title: 'Task',
        },
      ]),
    ).rejects.toThrow('Report not found');

    expect(prisma.report.update).not.toHaveBeenCalled();
    expect(prisma.report.delete).not.toHaveBeenCalled();
    expect(prisma.reportItem.createMany).not.toHaveBeenCalled();
    expect(integrations.fetchConfiguredItems).not.toHaveBeenCalled();
  });
});
