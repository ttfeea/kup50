import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportItemSource, ReportStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IntegrationService } from '../integrations/integration.service';
import { CreateReportDto } from './dto/create-report.dto';
import { AttachReportItemDto } from './dto/attach-report-items.dto';

type ReportItemAttachInput = {
  source: ReportItemSource;
  externalId: string;
  title: string;
  url?: string;
  type?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: IntegrationService,
  ) {}

  private getDefaultPeriodWindow(): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime());
    periodStart.setDate(periodStart.getDate() - 30);

    return { periodStart, periodEnd };
  }

  async create(userId: string, dto: CreateReportDto) {
    const { periodEnd, periodStart } = this.getDefaultPeriodWindow();

    const report = await this.prisma.report.create({
      data: {
        periodStart,
        periodEnd,
        status: dto.status ?? ReportStatus.DRAFT,
        userId,
      },
    });

    return this.getReportWithItems(userId, report.id);
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

    const mapped: ReportItemAttachInput[] = items.map((item) => ({
      source: item.source,
      externalId: item.externalId,
      title: item.title,
      url: item.url,
      type: item.type,
      metadata: item.metadata
        ? (item.metadata as unknown as Prisma.InputJsonValue)
        : undefined,
    }));

    await this.prisma.reportItem.createMany({
      data: mapped.map((m) => ({
        reportId,
        source: m.source,
        externalId: m.externalId,
        title: m.title,
        url: m.url,
        type: m.type,
        metadata: m.metadata,
      })),
    });

    return this.getReportWithItems(userId, reportId);
  }

  async getReportWithItems(userId: string, reportId: string) {
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

    return report;
  }

  async getReportsWithItems(userId: string) {
    return this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reportItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async fetchPreviewItems(userId: string, reportId: string, limit = 25) {
    await this.assertOwnedReport(userId, reportId);

    return this.integrationService.fetchConfiguredItems(userId, limit);
  }

  // Backward-compatible method names (used by earlier controller code).
  findAllForUser(userId: string) {
    return this.getReportsWithItems(userId);
  }

  findOneForUser(userId: string, reportId: string) {
    return this.getReportWithItems(userId, reportId);
  }
}
