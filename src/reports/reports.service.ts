import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportItemSource, ReportStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { WorkItem } from '../common/types/work-item.type';
import { PrismaService } from '../database/prisma.service';
import {
  buildWorkItemMetadata,
  mapReportItemToWorkItem,
} from '../integrations/mappers/work-item.mapper';
import { IntegrationService } from '../integrations/integration.service';
import { AttachReportItemDto } from './dto/attach-report-items.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateManualWorkItemDto } from './dto/create-manual-work-item.dto';
import {
  FinalReportDto,
  FinalReportLink,
  FinalReportRow,
} from './types/final-report.type';

const DEFAULT_EMAIL_SUBJECT =
  'KUP50 — raport za miesiąc: {{month}} — {{fullname}}';
const DEFAULT_EMAIL_BODY =
  'Dzień dobry,\n\nprzesyłam raport KUP50 za okres {{periodStart}} – {{periodEnd}}.\n\nPozdrawiam,\n{{fullname}}';

const FINAL_REPORT_HEADERS = [
  'Employee ID',
  'Imię i nazwisko Pracownika / Name Surname',
  'Stanowisko służbowe i departament Pracownika / Title',
  'Imię i nazwisko Menadżera / Approving manager',
  'Okres ewidencji / Month',
  'Tytuły / nazwy Wyników Pracy Twórczej / Creative work titles',
  'Tytuły / nazwy oraz etap (o ile występuje) Projektu B+R / Creative work stages',
  'Wskazanie miejsca przechowywania lub miejsca dostarczenia Pracodawcy Wyników Pracy Twórczej (...) / Repository links',
] as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: IntegrationService,
  ) {}

  private getDefaultPeriodWindow(periodDays = 30): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime());
    periodStart.setDate(periodStart.getDate() - periodDays);

    return { periodStart, periodEnd };
  }

  async create(userId: string, dto: CreateReportDto) {
    const periodDays = dto.periodDays ?? 30;
    const defaultWindow = this.getDefaultPeriodWindow(periodDays);
    const periodStart = dto.periodStart
      ? new Date(dto.periodStart)
      : defaultWindow.periodStart;
    const periodEnd = dto.periodEnd
      ? new Date(dto.periodEnd)
      : defaultWindow.periodEnd;

    if (periodStart > periodEnd) {
      throw new BadRequestException(
        'Report period start must be before period end',
      );
    }

    const report = await this.prisma.report.create({
      data: {
        periodStart,
        periodEnd,
        status: dto.status ?? ReportStatus.DRAFT,
        userId,
      },
    });

    return this.getReportWithWorkItems(userId, report.id);
  }

  private async assertOwnedReport(userId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: { id: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }
  }

  async attachReportItems(
    userId: string,
    reportId: string,
    items: AttachReportItemDto[],
  ) {
    await this.assertOwnedReport(userId, reportId);

    if (!items.length) {
      return this.getReportWithWorkItems(userId, reportId);
    }

    await this.prisma.reportItem.createMany({
      data: items.map((item) => ({
        reportId,
        source: item.source,
        workType: item.type,
        externalId: item.externalId,
        title: item.title,
        url: item.url,
        metadata: buildWorkItemMetadata(item) as
          | Prisma.InputJsonValue
          | undefined,
      })),
    });

    return this.getReportWithWorkItems(userId, reportId);
  }

  async addManualWorkItem(
    userId: string,
    reportId: string,
    dto: CreateManualWorkItemDto,
  ): Promise<WorkItem> {
    await this.assertOwnedReport(userId, reportId);

    const now = new Date().toISOString();
    const item = await this.prisma.reportItem.create({
      data: {
        reportId,
        source: ReportItemSource.MANUAL,
        workType: dto.type,
        externalId: `manual:${randomUUID()}`,
        title: dto.title.trim(),
        metadata: {
          description: dto.description?.trim() || undefined,
          activityCreatedAt: now,
          activityUpdatedAt: now,
        },
      },
    });

    return mapReportItemToWorkItem(item);
  }

  async getReportWithWorkItems(userId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      include: {
        reportItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return {
      ...report,
      workItems: report.reportItems.map((item) =>
        mapReportItemToWorkItem(item),
      ),
    };
  }

  async getReportsWithWorkItems(userId: string) {
    const reports = await this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reportItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return reports.map((report) => ({
      ...report,
      workItems: report.reportItems.map((item) =>
        mapReportItemToWorkItem(item),
      ),
    }));
  }

  async fetchPreviewItems(
    userId: string,
    reportId: string,
    limit = 100,
    periodDays?: number,
    requestedPeriodStart?: string,
    requestedPeriodEnd?: string,
  ) {
    await this.assertOwnedReport(userId, reportId);

    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: { periodStart: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const since = requestedPeriodStart
      ? new Date(requestedPeriodStart)
      : periodDays
        ? this.getDefaultPeriodWindow(periodDays).periodStart
        : report.periodStart;
    const until = requestedPeriodEnd ? new Date(requestedPeriodEnd) : undefined;

    return this.integrationService.fetchConfiguredItems(userId, {
      limit,
      since,
      until,
    });
  }

  async deleteDraft(userId: string, reportId: string) {
    await this.assertOwnedReport(userId, reportId);

    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: { id: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.report.delete({ where: { id: reportId } });

    return { deleted: true, reportId };
  }

  async confirmReport(userId: string, reportId: string) {
    await this.assertOwnedReport(userId, reportId);

    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.SUBMITTED },
    });

    return this.getReportWithWorkItems(userId, reportId);
  }

  async getEmailDraft(userId: string, reportId: string) {
    const output = await this.getFinalReport(userId, reportId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const firstRow = output.rows[0];
    const values = {
      month: firstRow?.month ?? this.formatPolishMonth(output.periodStart),
      fullname: user.fullname?.trim() || user.email,
      employeeId: user.employeeId?.trim() || '',
      managerName: user.managerName?.trim() || '',
      periodStart: this.formatDate(output.periodStart),
      periodEnd: this.formatDate(output.periodEnd),
    };

    return {
      receiverEmail:
        user.reportReceiverEmail?.trim() || user.managerEmail?.trim() || '',
      subject: this.renderTemplate(
        user.reportEmailSubjectTemplate?.trim() || DEFAULT_EMAIL_SUBJECT,
        values,
      ),
      body: this.renderTemplate(
        user.reportEmailBodyTemplate?.trim() || DEFAULT_EMAIL_BODY,
        values,
      ),
      tablePreviewHtml: this.buildTablePreviewHtml(output.rows),
      xlsxFileName: this.getXlsxFileName(values.month, values.fullname),
    };
  }

  async exportXlsx(userId: string, reportId: string) {
    const output = await this.getFinalReport(userId, reportId);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KUP50');
    const header = worksheet.addRow([...FINAL_REPORT_HEADERS]);

    header.font = { bold: true };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 55;

    for (const row of output.rows) {
      const excelRow = worksheet.addRow([
        row.employeeId,
        row.fullname,
        row.title,
        row.managerName,
        row.month,
        row.workTitles,
        row.workStages,
        row.repositoryLinksText,
      ]);

      this.setHyperlinkCell(
        excelRow.getCell(6),
        row.workTitles,
        row.workTitleUrl,
      );
      this.setHyperlinkCell(
        excelRow.getCell(7),
        row.workStages,
        row.workStageUrl,
      );
      this.setRepositoryLinksCell(
        excelRow.getCell(8),
        row.repositoryLinksText,
        row.repositoryLinks,
      );
      excelRow.alignment = { vertical: 'top', wrapText: true };
    }

    worksheet.columns = [
      { width: 16 },
      { width: 28 },
      { width: 34 },
      { width: 28 },
      { width: 18 },
      { width: 42 },
      { width: 42 },
      { width: 55 },
    ];
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const firstRow = output.rows[0];

    return {
      buffer,
      fileName: this.getXlsxFileName(
        firstRow?.month ?? this.formatPolishMonth(output.periodStart),
        firstRow?.fullname ?? 'report',
      ),
    };
  }

  async getFinalReport(
    userId: string,
    reportId: string,
  ): Promise<FinalReportDto> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      include: {
        user: true,
        reportItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const fullname = report.user.fullname?.trim() || report.user.email;
    const title = [report.user.position, report.user.department]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' / ');
    const month = this.formatPolishMonth(report.periodStart);

    return {
      reportId: report.id,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      rows: report.reportItems.map((item) =>
        this.buildFinalReportRow(item, {
          employeeId: report.user.employeeId?.trim() || '',
          fullname,
          title,
          managerName: report.user.managerName?.trim() || '',
          month,
        }),
      ),
    };
  }

  private buildFinalReportRow(
    item: {
      title: string;
      url: string | null;
      metadata: Prisma.JsonValue | null;
    },
    profile: Pick<
      FinalReportRow,
      'employeeId' | 'fullname' | 'title' | 'managerName' | 'month'
    >,
  ): FinalReportRow {
    const metadata =
      item.metadata &&
      typeof item.metadata === 'object' &&
      !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : {};
    const workTitles = this.metadataString(metadata.workTitles) || item.title;
    const workStages = this.metadataString(metadata.workStages);
    const repositoryLinksText = this.metadataString(metadata.repoLinks);
    const repositoryLinks = this.extractRepositoryLinks(
      repositoryLinksText,
      metadata.repositoryLinks,
    );

    return {
      ...profile,
      workTitles,
      workTitleUrl: item.url?.trim() || undefined,
      workStages,
      workStageUrl: this.metadataString(metadata.stageUrl) || undefined,
      repositoryLinksText,
      repositoryLinks,
    };
  }

  private extractRepositoryLinks(
    text: string,
    rawLinks: unknown,
  ): FinalReportLink[] {
    const labelsByUrl = new Map<string, string>();

    if (Array.isArray(rawLinks)) {
      for (const link of rawLinks) {
        if (
          typeof link === 'object' &&
          link !== null &&
          typeof (link as { url?: unknown }).url === 'string'
        ) {
          const url = (link as { url: string }).url.trim();
          const label =
            typeof (link as { label?: unknown }).label === 'string'
              ? (link as { label: string }).label.trim()
              : url;
          labelsByUrl.set(url, label || url);
        }
      }
    }

    const links = new Map<string, FinalReportLink>();
    for (const line of text.split(/\r?\n/)) {
      const url = line.trim();
      if (!/^https?:\/\//i.test(url)) {
        continue;
      }

      links.set(url, {
        label: labelsByUrl.get(url) || url,
        url,
      });
    }

    return [...links.values()];
  }

  private buildTablePreviewHtml(rows: FinalReportRow[]) {
    const headers = FINAL_REPORT_HEADERS.map(
      (header) => `<th>${this.escapeHtml(header)}</th>`,
    ).join('');
    const body = rows
      .map(
        (row) => `<tr>
<td>${this.escapeHtml(row.employeeId)}</td>
<td>${this.escapeHtml(row.fullname)}</td>
<td>${this.escapeHtml(row.title)}</td>
<td>${this.escapeHtml(row.managerName)}</td>
<td>${this.escapeHtml(row.month)}</td>
<td>${this.htmlLink(row.workTitles, row.workTitleUrl)}</td>
<td>${this.htmlLink(row.workStages, row.workStageUrl)}</td>
<td>${this.repositoryLinksHtml(row.repositoryLinksText, row.repositoryLinks)}</td>
</tr>`,
      )
      .join('');

    return `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
  }

  private repositoryLinksHtml(text: string, links: FinalReportLink[]) {
    const linksByUrl = new Map(links.map((link) => [link.url, link]));

    return text
      .split(/\r?\n/)
      .map((line) => {
        const value = line.trim();
        const link = linksByUrl.get(value);
        return link
          ? this.htmlLink(link.label, link.url)
          : this.escapeHtml(line);
      })
      .join('<br>');
  }

  private htmlLink(text: string, url?: string) {
    if (!url) {
      return this.escapeHtml(text);
    }

    return `<a href="${this.escapeHtml(url)}">${this.escapeHtml(text)}</a>`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private metadataString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private formatPolishMonth(value: Date | string) {
    const months = [
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
    return months[new Date(value).getUTCMonth()] ?? '';
  }

  private formatDate(value: Date | string) {
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(value));
  }

  private renderTemplate(template: string, values: Record<string, string>) {
    return template.replace(
      /{{(month|fullname|employeeId|managerName|periodStart|periodEnd)}}/g,
      (_, key: string) => values[key] ?? '',
    );
  }

  private getXlsxFileName(month: string, fullname: string) {
    const safeName = `${month}-${fullname}`
      .normalize('NFKD')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return `KUP50-${safeName || 'report'}.xlsx`;
  }

  private setHyperlinkCell(
    cell: ExcelJS.Cell,
    text: string,
    hyperlink?: string,
  ) {
    if (!hyperlink) {
      cell.value = text;
      return;
    }

    cell.value = { text, hyperlink };
    cell.font = { color: { argb: 'FF0563C1' }, underline: true };
  }

  private setRepositoryLinksCell(
    cell: ExcelJS.Cell,
    text: string,
    links: FinalReportLink[],
  ) {
    if (links.length === 1 && text.trim() === links[0].url) {
      this.setHyperlinkCell(cell, links[0].label, links[0].url);
      return;
    }

    if (links.length > 0) {
      const formula = links
        .map(
          (link) =>
            `HYPERLINK("${link.url.replace(/"/g, '""')}","${link.label.replace(/"/g, '""')}")`,
        )
        .join('&CHAR(10)&');
      cell.value = {
        formula,
        result: links.map((link) => link.label).join('\n'),
      };
      cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      return;
    }

    cell.value = text;
  }
}
