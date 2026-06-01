import { Injectable, BadRequestException } from '@nestjs/common';
import { ReportItemSource, WorkItemType } from '@prisma/client';
import { WorkItem } from '../../common/types/work-item.type';
import { jiraIssueTypeToWorkItemType } from '../mappers/work-item.mapper';
import { BaseClient } from './base-client';

type JiraSearchResponse = {
  issues?: Array<{
    id: string;
    key: string;
    self: string;
    fields?: {
      summary?: string;
      issuetype?: { name?: string };
      status?: { name?: string };
      created?: string;
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

    const baseUrl = options.baseUrl.trim().replace(/\/$/, '');
    const token = options.token.trim();
    const auth = this.buildAuth(options.accountEmail, token);

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
    since?: Date;
  }): Promise<WorkItem[]> {
    if (!options.baseUrl || !options.accountEmail) {
      throw new BadRequestException(
        'Jira integrations require baseUrl and accountEmail',
      );
    }

    const baseUrl = options.baseUrl.trim().replace(/\/$/, '');
    const token = options.token.trim();
    const auth = this.buildAuth(options.accountEmail, token);

    // Build JQL with optional date filter
    let jql = 'assignee = currentUser() ORDER BY updated DESC';
    if (options.since) {
      const sinceStr = options.since.toISOString().split('T')[0];
      jql = `assignee = currentUser() AND updated >= ${sinceStr} ORDER BY updated DESC`;
    }

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
          jql,
          maxResults: options.limit,
          fields: ['summary', 'issuetype', 'status', 'created', 'updated'],
        }),
      },
      'Jira',
    );

    return (response.issues ?? []).map((issue) => {
      const issueTypeName = issue.fields?.issuetype?.name;

      return {
        source: ReportItemSource.JIRA,
        type: jiraIssueTypeToWorkItemType(issueTypeName),
        externalId: issue.key,
        title: issue.fields?.summary ?? issue.key,
        url: `${baseUrl}/browse/${issue.key}`,
        activityCreatedAt: issue.fields?.created,
        activityUpdatedAt: issue.fields?.updated,
        metadata: {
          jiraId: issue.id,
          issueType: issueTypeName,
          status: issue.fields?.status?.name,
          self: issue.self,
        },
      };
    });
  }

  private buildAuth(accountEmail: string, token: string) {
    return Buffer.from(`${accountEmail.trim()}:${token.trim()}`).toString(
      'base64',
    );
  }
}
