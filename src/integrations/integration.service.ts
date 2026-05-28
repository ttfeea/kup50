import {
  BadRequestException,
  HttpException,
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

    return this.toStatusDto(token, {
      connected: true,
      status: 'connected',
      message: 'Token saved',
    });
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

        return this.validateStoredToken(token);
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
  ): Promise<{ connected: boolean; message: string }> {
    const token = await this.prisma.integrationToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!token) {
      return {
        connected: false,
        message: 'Integration is not connected',
      };
    }

    const status = await this.validateStoredToken(token);

    return {
      connected: status.connected,
      message: status.message,
    };
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

    const results = await Promise.allSettled(
      tokens.map((token) => this.fetchExternalItems(token, limit)),
    );
    const externalItems = results
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value);

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

      if (
        typeof response === 'object' &&
        response !== null &&
        'status' in response
      ) {
        return 'Token check failed. Reconnect this integration.';
      }

      return error.message;
    }

    return 'Token check failed. Reconnect this integration.';
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
}
