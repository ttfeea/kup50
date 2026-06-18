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
  connectionCheckedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  tokenPreview?: string;
};

function isRepositoryLink(value: unknown): value is {
  label: string;
  url: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    typeof value.label === 'string' &&
    'url' in value &&
    typeof value.url === 'string'
  );
}

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

    if (provider === ReportItemSource.JIRA) {
      if (!normalizedDto.accountEmail) {
        throw new BadRequestException('Jira account email is required');
      }
      if (!normalizedDto.baseUrl) {
        throw new BadRequestException('Jira base URL is required');
      }
    }

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

    return Array.from(supportedProviders).map((provider) => {
      const token = tokensByProvider.get(provider);

      if (!token) {
        return this.toMissingStatus(provider);
      }

      return this.statusFromStoredToken(token);
    });
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
    options?: { limit?: number; since?: Date; until?: Date },
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

    const workItems = await this.fetchExternalItems(
      token,
      limit,
      options?.since,
      options?.until,
    );

    return { items: mapWorkItemsToAttachDto(workItems) };
  }

  async fetchConfiguredItems(
    userId: string,
    options?: { limit?: number; since?: Date; until?: Date },
  ): Promise<{ items: WorkItem[] }> {
    if (options?.since && options.until && options.since > options.until) {
      throw new BadRequestException(
        'Report period start must be before period end',
      );
    }

    const limit = options?.limit ?? 100;
    const tokens = await this.prisma.integrationToken.findMany({
      where: {
        userId,
        provider: {
          in: Array.from(supportedProviders),
        },
      },
    });

    const jiraToken = tokens.find(
      (token) => token.provider === ReportItemSource.JIRA,
    );

    if (!jiraToken) {
      return { items: [] };
    }

    const jiraItems = await this.fetchExternalItems(
      jiraToken,
      limit,
      options?.since,
      options?.until,
    );
    const needsFallback = jiraItems.some((item) => {
      const metadata = item.metadata ?? {};
      const remoteLinks = Array.isArray(metadata.jiraRemoteLinks)
        ? metadata.jiraRemoteLinks.filter(isRepositoryLink)
        : [];
      return (
        this.cleanEvidenceLinks(remoteLinks, [
          item.url,
          typeof metadata.stageUrl === 'string' ? metadata.stageUrl : undefined,
        ]).length === 0
      );
    });
    const gitTokens = tokens.filter(
      (token) =>
        needsFallback &&
        (token.provider === ReportItemSource.GITLAB ||
          token.provider === ReportItemSource.GITHUB),
    );
    const gitResults = await Promise.allSettled(
      gitTokens.map((token) =>
        this.fetchExternalItems(token, 100, options?.since, options?.until),
      ),
    );
    const mergeRequests = gitResults.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const token = gitTokens[index];
      this.logger.warn(
        `Integration fetch failed provider=${token.provider} user=${userId} baseUrl=${token.baseUrl ?? 'none'} reason=${
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        }`,
      );
      return [] as WorkItem[];
    });

    return {
      items: jiraItems.map((jiraItem) =>
        this.attachMatchingMergeRequests(jiraItem, mergeRequests),
      ),
    };
  }

  private fetchExternalItems(
    token: IntegrationToken,
    limit: number,
    since?: Date,
    until?: Date,
  ): Promise<WorkItem[]> {
    return token.provider === ReportItemSource.JIRA
      ? this.jiraClient.fetchRecentItems({ ...token, limit, since, until })
      : token.provider === ReportItemSource.GITLAB
        ? this.gitLabClient.fetchRecentItems({ ...token, limit, since, until })
        : this.gitHubClient.fetchRecentItems({ ...token, limit, since, until });
  }

  private attachMatchingMergeRequests(
    jiraItem: WorkItem,
    mergeRequests: WorkItem[],
  ): WorkItem {
    const jiraKey = jiraItem.externalId.trim();
    const jiraName = jiraItem.title.replace(jiraKey, '').trim();
    const metadata = jiraItem.metadata ?? {};
    const excludedUrls = [
      jiraItem.url,
      typeof metadata.stageUrl === 'string' ? metadata.stageUrl : undefined,
    ];
    const jiraRemoteLinks = this.cleanEvidenceLinks(
      Array.isArray(metadata.jiraRemoteLinks)
        ? metadata.jiraRemoteLinks.filter(isRepositoryLink)
        : [],
      excludedUrls,
    );
    const matches =
      jiraRemoteLinks.length > 0
        ? []
        : mergeRequests.filter((item) =>
            this.matchesJiraItem(item, jiraKey, jiraName),
          );
    const fallbackLinks = this.cleanEvidenceLinks(
      matches.flatMap((item) =>
        item.url ? [{ label: item.title || item.url, url: item.url }] : [],
      ),
      excludedUrls,
    );
    const repositoryLinks =
      jiraRemoteLinks.length > 0 ? jiraRemoteLinks : fallbackLinks;
    const repositorySummaryLinks =
      jiraRemoteLinks.length === 0 && repositoryLinks.length > 4
        ? this.buildProviderSearchLinks(matches, jiraKey)
        : [];
    const stageName =
      typeof metadata.stageName === 'string' ? metadata.stageName : '';

    return {
      ...jiraItem,
      metadata: {
        ...metadata,
        workTitles: jiraItem.title,
        workStages: stageName,
        repositoryLinks,
        repositorySummaryLinks,
        repositoryLinksCollapsed: repositoryLinks.length > 4,
        repoLinks: repositoryLinks.map((link) => link.url).join('\n'),
      },
    };
  }

  private cleanEvidenceLinks(
    links: Array<{ label: string; url: string }>,
    excludedUrls: Array<string | undefined> = [],
  ) {
    const excluded = new Set(
      excludedUrls
        .map((value) => this.evidenceResourceKey(value))
        .filter(Boolean),
    );
    const unique = new Map<string, { label: string; url: string }>();

    for (const link of links) {
      const url = this.normalizeEvidenceUrl(link.url);
      if (
        !url ||
        excluded.has(this.evidenceResourceKey(url)) ||
        unique.has(url)
      ) {
        continue;
      }

      unique.set(url, {
        label: link.label.trim() || url,
        url,
      });
    }

    return [...unique.values()];
  }

  private normalizeEvidenceUrl(value?: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return '';
      }

      url.hash = '';
      for (const key of [...url.searchParams.keys()]) {
        if (key.toLowerCase().startsWith('utm_')) {
          url.searchParams.delete(key);
        }
      }
      if (url.pathname !== '/') {
        url.pathname = url.pathname.replace(/\/+$/, '');
      }

      return url.toString();
    } catch {
      return '';
    }
  }

  private evidenceResourceKey(value?: string) {
    const normalized = this.normalizeEvidenceUrl(value);
    if (!normalized) {
      return '';
    }

    const url = new URL(normalized);
    return `${url.origin.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`;
  }

  private matchesJiraItem(
    mergeRequest: WorkItem,
    jiraKey: string,
    jiraName: string,
  ) {
    const metadata = mergeRequest.metadata ?? {};
    const haystack = [
      mergeRequest.title,
      metadata.sourceBranch,
      metadata.targetBranch,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    const normalizedKey = jiraKey.toLowerCase();
    const normalizedName = jiraName.toLowerCase();

    return (
      haystack.includes(normalizedKey) ||
      (normalizedName.length >= 5 && haystack.includes(normalizedName))
    );
  }

  private buildProviderSearchLinks(matches: WorkItem[], jiraKey: string) {
    const links = new Map<string, { label: string; url: string }>();

    for (const match of matches) {
      const searchBase = match.metadata?.providerSearchUrl;
      if (typeof searchBase !== 'string' || links.has(match.source)) {
        continue;
      }

      links.set(match.source, {
        label: `View all MRs for ${jiraKey}`,
        url: `${searchBase}${encodeURIComponent(jiraKey)}`,
      });
    }

    return [...links.values()];
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

  private normalizeConnectionStatus(
    value: string | null | undefined,
  ): IntegrationStatus {
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
      connectionCheckedAt: token.connectionCheckedAt,
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
