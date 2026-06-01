import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportItemSource, ReportStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
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
    const { periodEnd, periodStart } = this.getDefaultPeriodWindow(periodDays);

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
        metadata: buildWorkItemMetadata(item) as Prisma.InputJsonValue | undefined,
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
      workItems: report.reportItems.map((item) => mapReportItemToWorkItem(item)),
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
      workItems: report.reportItems.map((item) => mapReportItemToWorkItem(item)),
    }));
  }

  async fetchPreviewItems(
    userId: string,
    reportId: string,
    limit = 100,
    periodDays?: number,
  ) {
    await this.assertOwnedReport(userId, reportId);

    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: { periodStart: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const since = periodDays
      ? this.getDefaultPeriodWindow(periodDays).periodStart
      : report.periodStart;

    return this.integrationService.fetchConfiguredItems(userId, { limit, since });
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

  getReportWithItems(userId: string, reportId: string) {
    return this.getReportWithWorkItems(userId, reportId);
  }

  getReportsWithItems(userId: string) {
    return this.getReportsWithWorkItems(userId);
  }
}
