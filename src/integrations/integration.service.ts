import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationToken, ReportItemSource } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttachReportItemDto } from '../reports/dto/attach-report-items.dto';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';
import { JiraClient } from './clients/jira.client';
import { StoreIntegrationTokenDto } from './dto/store-integration-token.dto';
import { mapWorkItemsToAttachDto } from './mappers/work-item.mapper';
import { WorkItem } from '../common/types/work-item.type';

const supportedProviders = new Set<ReportItemSource>([
  ReportItemSource.JIRA,
  ReportItemSource.GITLAB,
  ReportItemSource.GITHUB,
]);

type IntegrationStatus = 'missing' | 'connected' | 'error';

type IntegrationStatusDto = {
  provider: ReportItemSource;
  connected: boolean;
  status: IntegrationStatus;
  message: string;
  baseUrl?: string | null;
  accountEmail?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  tokenPreview?: string;
};

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jiraClient: JiraClient,
    private readonly gitLabClient: GitLabClient,
    private readonly gitHubClient: GitHubClient,
  ) {}

  parseProvider(provider: string): ReportItemSource {
    const normalized = provider.trim().toUpperCase() as ReportItemSource;

    if (!supportedProviders.has(normalized)) {
      throw new BadRequestException('Unsupported integration provider');
    }

    return normalized;
  }

  async storeToken(
    userId: string,
    provider: ReportItemSource,
    dto: StoreIntegrationTokenDto,
  ) {
    const normalizedDto = this.normalizeStoredTokenInput(dto);

    const token = await this.prisma.integrationToken.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      create: {
        userId,
        provider,
        token: normalizedDto.token,
        baseUrl: normalizedDto.baseUrl ?? null,
        accountEmail: normalizedDto.accountEmail ?? null,
        connectionStatus: 'missing',
        connectionMessage: 'Token saved. Use Check connection to validate it.',
      },
      update: {
        token: normalizedDto.token,
        baseUrl: normalizedDto.baseUrl ?? null,
        accountEmail: normalizedDto.accountEmail ?? null,
        connectionStatus: 'missing',
        connectionMessage: 'Token saved. Use Check connection to validate it.',
        connectionCheckedAt: null,
      },
    });

    return this.statusFromStoredToken(token);
  }

  async listTokens(userId: string) {
    const tokens = await this.prisma.integrationToken.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });

    const tokensByProvider = new Map(
      tokens.map((token) => [token.provider, token]),
    );

    return Promise.all(
      Array.from(supportedProviders).map(async (provider) => {
        const token = tokensByProvider.get(provider);

        if (!token) {
          return this.toMissingStatus(provider);
        }

        return this.statusFromStoredToken(token);
      }),
    );
  }

  async disconnect(userId: string, provider: ReportItemSource) {
    await this.prisma.integrationToken.deleteMany({
      where: { userId, provider },
    });

    return this.toMissingStatus(provider, 'Integration disconnected');
  }

  async checkConnection(
    userId: string,
    provider: ReportItemSource,
  ): Promise<IntegrationStatusDto> {
    const token = await this.prisma.integrationToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!token) {
      return this.toMissingStatus(provider);
    }

    const status = await this.validateStoredToken(token);
    await this.persistConnectionStatus(token.id, status);
    const updated = await this.prisma.integrationToken.findUniqueOrThrow({
      where: { id: token.id },
    });

    return this.statusFromStoredToken(updated);
  }

  async fetchItems(
    userId: string,
    provider: ReportItemSource,
    options?: { limit?: number; since?: Date },
  ): Promise<{ items: AttachReportItemDto[] }> {
    const limit = options?.limit ?? 25;
    const token = await this.prisma.integrationToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!token) {
      throw new NotFoundException('Integration token not found');
    }

    const workItems = await this.fetchExternalItems(token, limit, options?.since);

    return { items: mapWorkItemsToAttachDto(workItems) };
  }

  async fetchConfiguredItems(
    userId: string,
    options?: { limit?: number; since?: Date },
  ): Promise<{ items: WorkItem[] }> {
    const limit = options?.limit ?? 100;
    const tokens = await this.prisma.integrationToken.findMany({
      where: {
        userId,
        provider: {
          in: Array.from(supportedProviders),
        },
      },
    });

    const results = await Promise.allSettled(
      tokens.map((token) => this.fetchExternalItems(token, limit, options?.since)),
    );

    const workItems = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const token = tokens[index];
      const reason = result.reason;
      this.logger.warn(
        `Integration fetch failed provider=${token.provider} user=${userId} baseUrl=${token.baseUrl ?? 'none'} reason=${
          reason instanceof Error ? reason.message : String(reason)
        }`,
      );
      return [] as WorkItem[];
    });

    return { items: this.mergeWorkItems(workItems, limit) };
  }

  private mergeWorkItems(items: WorkItem[], limit: number) {
    const byKey = new Map<string, WorkItem>();

    for (const item of items) {
      byKey.set(`${item.source}:${item.type}:${item.externalId}`, item);
    }

    return [...byKey.values()]
      .sort((a, b) =>
        (b.activityUpdatedAt ?? '').localeCompare(a.activityUpdatedAt ?? ''),
      )
      .slice(0, limit);
  }

  private fetchExternalItems(token: IntegrationToken, limit: number, since?: Date): Promise<WorkItem[]> {
    return token.provider === ReportItemSource.JIRA
      ? this.jiraClient.fetchRecentItems({ ...token, limit, since })
      : token.provider === ReportItemSource.GITLAB
        ? this.gitLabClient.fetchRecentItems({ ...token, limit, since })
        : this.gitHubClient.fetchRecentItems({ ...token, limit, since });
  }

  private async validateStoredToken(
    token: IntegrationToken,
  ): Promise<IntegrationStatusDto> {
    try {
      await this.validateToken(token);

      return this.toStatusDto(token, {
        connected: true,
        status: 'connected',
        message: 'Connected',
      });
    } catch (error) {
      return this.toStatusDto(token, {
        connected: false,
        status: 'error',
        message: this.getProviderErrorMessage(error),
      });
    }
  }

  private validateToken(token: IntegrationToken) {
    return token.provider === ReportItemSource.JIRA
      ? this.jiraClient.validateToken(token)
      : token.provider === ReportItemSource.GITLAB
        ? this.gitLabClient.validateToken(token)
        : this.gitHubClient.validateToken(token);
  }

  private normalizeStoredTokenInput(dto: StoreIntegrationTokenDto) {
    const token = dto.token?.trim() ?? '';
    const baseUrl = dto.baseUrl?.trim().replace(/\/+$/, '') || undefined;
    const accountEmail = dto.accountEmail?.trim() || undefined;

    if (!token) {
      throw new BadRequestException('Integration token is required');
    }

    return {
      token,
      baseUrl,
      accountEmail,
    };
  }

  private toMissingStatus(
    provider: ReportItemSource,
    message = 'Integration is not connected',
  ): IntegrationStatusDto {
    return {
      provider,
      connected: false,
      status: 'missing',
      message,
    };
  }

  private statusFromStoredToken(token: IntegrationToken): IntegrationStatusDto {
    const status = this.normalizeConnectionStatus(token.connectionStatus);

    return this.toStatusDto(token, {
      connected: status === 'connected',
      status,
      message:
        token.connectionMessage ??
        (status === 'missing'
          ? 'Token saved. Use Check connection to validate it.'
          : 'Integration is not connected'),
    });
  }

  private normalizeConnectionStatus(value: string | null | undefined): IntegrationStatus {
    if (value === 'connected' || value === 'error') {
      return value;
    }

    return 'missing';
  }

  private async persistConnectionStatus(
    tokenId: string,
    status: IntegrationStatusDto,
  ) {
    await this.prisma.integrationToken.update({
      where: { id: tokenId },
      data: {
        connectionStatus: status.status,
        connectionMessage: status.message,
        connectionCheckedAt: new Date(),
      },
    });
  }

  private toStatusDto(
    token: IntegrationToken,
    status: Pick<IntegrationStatusDto, 'connected' | 'status' | 'message'>,
  ): IntegrationStatusDto {
    return {
      provider: token.provider,
      connected: status.connected,
      status: status.status,
      message: status.message,
      baseUrl: token.baseUrl,
      accountEmail: token.accountEmail,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      tokenPreview: this.getTokenPreview(token.token),
    };
  }

  private getProviderErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      return error.message;
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return this.formatValidationMessage(response);
      }

      if (typeof response === 'object' && response !== null) {
        const { message, details } = response as {
          message?: string;
          details?: string;
        };
        const summary =
          message ??
          (details && !this.looksLikeHtml(details) ? details : undefined);

        if (summary) {
          return this.formatValidationMessage(summary);
        }
      }

      return 'Validation failed. Verify the token, base URL, and account email.';
    }

    return 'Validation failed. Verify the token, base URL, and account email.';
  }

  private redactToken<T extends { token: string }>(
    token: T,
  ): Omit<T, 'token'> & {
    tokenPreview: string;
  } {
    const { token: rawToken, ...safeToken } = token;

    return {
      ...safeToken,
      tokenPreview: this.getTokenPreview(rawToken),
    };
  }

  private getTokenPreview(token: string) {
    return token.length > 4 ? `...${token.slice(-4)}` : 'configured';
  }

  private formatValidationMessage(summary: string) {
    const trimmed = summary.trim();

    if (trimmed.toLowerCase().startsWith('validation failed')) {
      return trimmed;
    }

    return `Validation failed: ${trimmed}`;
  }

  private looksLikeHtml(value: string) {
    const trimmed = value.trim().toLowerCase();

    return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
  }
}
