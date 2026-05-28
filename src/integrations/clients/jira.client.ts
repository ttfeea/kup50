import { Injectable, BadRequestException } from '@nestjs/common';
import { ReportItemSource } from '@prisma/client';
import { BaseClient } from './base-client';
import { ExternalWorkItem } from '../types/external-work-item.type';

type JiraSearchResponse = {
  issues?: Array<{
    id: string;
    key: string;
    self: string;
    fields?: {
      summary?: string;
      issuetype?: { name?: string };
      status?: { name?: string };
      updated?: string;
    };
  }>;
};

@Injectable()
export class JiraClient extends BaseClient {
  async validateToken(options: {
    token: string;
    baseUrl?: string | null;
    accountEmail?: string | null;
  }): Promise<void> {
    if (!options.baseUrl || !options.accountEmail) {
      throw new BadRequestException(
        'Jira integrations require baseUrl and accountEmail',
      );
    }

    const baseUrl = options.baseUrl.replace(/\/$/, '');
    const auth = Buffer.from(
      `${options.accountEmail}:${options.token}`,
    ).toString('base64');

    await this.requestJson<unknown>(
      `${baseUrl}/rest/api/3/myself`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      },
      'Jira',
    );
  }

  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    accountEmail?: string | null;
    limit: number;
  }): Promise<ExternalWorkItem[]> {
    if (!options.baseUrl || !options.accountEmail) {
      throw new BadRequestException(
        'Jira integrations require baseUrl and accountEmail',
      );
    }

    const baseUrl = options.baseUrl.replace(/\/$/, '');
    const auth = Buffer.from(
      `${options.accountEmail}:${options.token}`,
    ).toString('base64');

    const response = await this.requestJson<JiraSearchResponse>(
      `${baseUrl}/rest/api/3/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: 'assignee = currentUser() ORDER BY updated DESC',
          maxResults: options.limit,
          fields: ['summary', 'issuetype', 'status', 'updated'],
        }),
      },
      'Jira',
    );

    return (response.issues ?? []).map((issue) => ({
      source: ReportItemSource.JIRA,
      externalId: issue.key,
      title: issue.fields?.summary ?? issue.key,
      url: `${baseUrl}/browse/${issue.key}`,
      type: issue.fields?.issuetype?.name,
      updatedAt: issue.fields?.updated,
      metadata: {
        jiraId: issue.id,
        status: issue.fields?.status?.name,
        self: issue.self,
      },
    }));
  }
}
