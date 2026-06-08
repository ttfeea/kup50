import { Test, TestingModule } from '@nestjs/testing';
import { ReportItemSource } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';
import { JiraClient } from './clients/jira.client';
import { IntegrationService } from './integration.service';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let gitLabClient: { validateToken: jest.Mock };
  let prisma: {
    integrationToken: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      integrationToken: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: JiraClient, useValue: { validateToken: jest.fn() } },
        { provide: GitLabClient, useValue: { validateToken: jest.fn() } },
        { provide: GitHubClient, useValue: { validateToken: jest.fn() } },
      ],
    }).compile();

    service = module.get(IntegrationService);
    gitLabClient = module.get(GitLabClient);
  });

  it('normalizes provider names and trims saved integration values', async () => {
    prisma.integrationToken.upsert.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      provider: ReportItemSource.GITLAB,
      token: 'glpat-token',
      baseUrl: 'https://gitlab.example.com/',
      accountEmail: '  dev@example.com  ',
      connectionStatus: 'missing',
      connectionMessage: 'Token saved. Use Check connection to validate it.',
      connectionCheckedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    });

    const result = await service.storeToken('user-1', ReportItemSource.GITLAB, {
      token: '  glpat-token  ',
      baseUrl: ' https://gitlab.example.com/ ',
      accountEmail: '  dev@example.com  ',
    });

    expect(prisma.integrationToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          token: 'glpat-token',
          baseUrl: 'https://gitlab.example.com',
          accountEmail: 'dev@example.com',
        }),
        update: expect.objectContaining({
          token: 'glpat-token',
          baseUrl: 'https://gitlab.example.com',
          accountEmail: 'dev@example.com',
        }),
      }),
    );

    expect(result.provider).toBe(ReportItemSource.GITLAB);
    expect(result.connected).toBe(false);
    expect(result.status).toBe('missing');
    expect(result.message).toContain('Token saved');
  });

  it('requires Jira account email before saving a token', async () => {
    await expect(
      service.storeToken('user-1', ReportItemSource.JIRA, {
        token: 'api-token',
        baseUrl: 'https://company.atlassian.net',
      }),
    ).rejects.toThrow('Jira account email is required');

    expect(prisma.integrationToken.upsert).not.toHaveBeenCalled();
  });

  it('does not auto-validate stored tokens when listing integrations', async () => {
    prisma.integrationToken.findMany.mockResolvedValue([
      {
        id: 'token-1',
        userId: 'user-1',
        provider: ReportItemSource.GITLAB,
        token: 'glpat-token',
        baseUrl: 'https://gitlab.example.com',
        accountEmail: 'dev@example.com',
        connectionStatus: 'missing',
        connectionMessage: 'Token saved. Use Check connection to validate it.',
        connectionCheckedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    const result = await service.listTokens('user-1');

    expect(gitLabClient.validateToken).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: ReportItemSource.GITLAB,
          connected: false,
          status: 'missing',
          message: expect.stringContaining('Token saved'),
        }),
      ]),
    );
  });

  it('accepts lowercase provider names', () => {
    expect(service.parseProvider('gitlab')).toBe(ReportItemSource.GITLAB);
  });

  it('returns validated integration status when checking a stored token', async () => {
    const storedToken = {
      id: 'token-1',
      userId: 'user-1',
      provider: ReportItemSource.GITLAB,
      token: 'glpat-token',
      baseUrl: 'https://gitlab.example.com',
      accountEmail: 'dev@example.com',
      connectionStatus: 'missing',
      connectionMessage: 'Token saved. Use Check connection to validate it.',
      connectionCheckedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    };

    const connectedToken = {
      ...storedToken,
      connectionStatus: 'connected',
      connectionMessage: 'Connected',
      connectionCheckedAt: new Date('2024-01-03T00:00:00Z'),
    };

    prisma.integrationToken.findUnique.mockResolvedValue(storedToken);
    prisma.integrationToken.update.mockResolvedValue(connectedToken);
    prisma.integrationToken.findUniqueOrThrow.mockResolvedValue(connectedToken);
    gitLabClient.validateToken.mockResolvedValue(undefined);

    const result = await service.checkConnection('user-1', ReportItemSource.GITLAB);

    expect(gitLabClient.validateToken).toHaveBeenCalledWith(storedToken);
    expect(result).toEqual(
      expect.objectContaining({
        provider: ReportItemSource.GITLAB,
        connected: true,
        status: 'connected',
        message: 'Connected',
      }),
    );
  });
});
