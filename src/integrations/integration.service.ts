import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationToken, ReportItemSource } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttachReportItemDto } from '../reports/dto/attach-report-items.dto';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';
import { JiraClient } from './clients/jira.client';
import { StoreIntegrationTokenDto } from './dto/store-integration-token.dto';
import { mapExternalItemsToReportItems } from './mappers/report-item.mapper';

const supportedProviders = new Set<ReportItemSource>([
  ReportItemSource.JIRA,
  ReportItemSource.GITLAB,
  ReportItemSource.GITHUB,
]);

@Injectable()
export class IntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jiraClient: JiraClient,
    private readonly gitLabClient: GitLabClient,
    private readonly gitHubClient: GitHubClient,
  ) {}

  parseProvider(provider: string): ReportItemSource {
    const normalized = provider.toUpperCase() as ReportItemSource;

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
        token: dto.token,
        baseUrl: dto.baseUrl,
        accountEmail: dto.accountEmail,
      },
      update: {
        token: dto.token,
        baseUrl: dto.baseUrl,
        accountEmail: dto.accountEmail,
      },
    });

    return this.redactToken(token);
  }

  async listTokens(userId: string) {
    const tokens = await this.prisma.integrationToken.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });

    return tokens.map((token) => this.redactToken(token));
  }

  async fetchItems(
    userId: string,
    provider: ReportItemSource,
    limit = 25,
  ): Promise<{ items: AttachReportItemDto[] }> {
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

    const externalItems = await this.fetchExternalItems(token, limit);

    return { items: mapExternalItemsToReportItems(externalItems) };
  }

  async fetchConfiguredItems(
    userId: string,
    limit = 25,
  ): Promise<{ items: AttachReportItemDto[] }> {
    const tokens = await this.prisma.integrationToken.findMany({
      where: {
        userId,
        provider: {
          in: Array.from(supportedProviders),
        },
      },
    });

    const externalItems = (
      await Promise.all(
        tokens.map((token) => this.fetchExternalItems(token, limit)),
      )
    ).flat();

    const items = mapExternalItemsToReportItems(externalItems).sort((a, b) => {
      const aUpdatedAt =
        typeof a.metadata?.updatedAt === 'string' ? a.metadata.updatedAt : '';
      const bUpdatedAt =
        typeof b.metadata?.updatedAt === 'string' ? b.metadata.updatedAt : '';

      return bUpdatedAt.localeCompare(aUpdatedAt);
    });

    return { items };
  }

  private fetchExternalItems(token: IntegrationToken, limit: number) {
    return token.provider === ReportItemSource.JIRA
      ? this.jiraClient.fetchRecentItems({ ...token, limit })
      : token.provider === ReportItemSource.GITLAB
        ? this.gitLabClient.fetchRecentItems({ ...token, limit })
        : this.gitHubClient.fetchRecentItems({ ...token, limit });
  }

  private redactToken<T extends { token: string }>(
    token: T,
  ): Omit<T, 'token'> & {
    tokenPreview: string;
  } {
    const { token: rawToken, ...safeToken } = token;

    return {
      ...safeToken,
      tokenPreview:
        rawToken.length > 4 ? `...${rawToken.slice(-4)}` : 'configured',
    };
  }
}
