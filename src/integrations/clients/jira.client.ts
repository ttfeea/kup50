import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
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
      parent?: {
        key?: string;
        fields?: { summary?: string; issuetype?: { name?: string } };
      };
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
    const { baseUrl, auth } = this.normalizeOptions(options);
    this.logger.debug(`Jira validation baseUrl=${baseUrl}`);

    await this.requestJiraJson<unknown>(
      `${baseUrl}/rest/api/3/myself`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      },
      'validation',
    );
  }

  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    accountEmail?: string | null;
    limit: number;
    since?: Date;
    until?: Date;
  }): Promise<WorkItem[]> {
    const { baseUrl, auth } = this.normalizeOptions(options);
    this.logger.debug(`Jira fetch baseUrl=${baseUrl}`);

    await this.requestJiraJson<unknown>(
      `${baseUrl}/rest/api/3/myself`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      },
      'validation',
    );

    let jql =
      'assignee = currentUser() AND statusCategory = Done ORDER BY updated DESC';
    if (options.since) {
      const sinceStr = options.since.toISOString().split('T')[0];
      const untilClause = options.until
        ? ` AND updated <= "${options.until.toISOString().split('T')[0]} 23:59"`
        : '';
      jql = `assignee = currentUser() AND statusCategory = Done AND updated >= "${sinceStr}"${untilClause} ORDER BY updated DESC`;
    }

    const response = await this.requestJiraJson<JiraSearchResponse>(
      `${baseUrl}/rest/api/3/search/jql`,
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
          fields: [
            'summary',
            'issuetype',
            'status',
            'created',
            'updated',
            'parent',
          ],
        }),
      },
      'fetch',
    );

    const issues = response.issues ?? [];
    this.logger.debug(`Jira fetched issueCount=${issues.length}`);

    return issues.map((issue) => {
      const issueTypeName = issue.fields?.issuetype?.name;
      const parent = issue.fields?.parent;
      const stageKey = parent?.key;
      const stageName = parent?.fields?.summary ?? stageKey;

      return {
        source: ReportItemSource.JIRA,
        type: jiraIssueTypeToWorkItemType(issueTypeName),
        externalId: issue.key,
        title: issue.fields?.summary
          ? `${issue.key} ${issue.fields.summary}`
          : issue.key,
        url: `${baseUrl}/browse/${issue.key}`,
        activityCreatedAt: issue.fields?.created,
        activityUpdatedAt: issue.fields?.updated,
        metadata: {
          id: issue.id,
          key: issue.key,
          issueType: issueTypeName,
          status: issue.fields?.status?.name,
          updated: issue.fields?.updated,
          stageKey,
          stageName,
          stageUrl: stageKey ? `${baseUrl}/browse/${stageKey}` : undefined,
        },
      };
    });
  }

  private normalizeOptions(options: {
    token: string;
    baseUrl?: string | null;
    accountEmail?: string | null;
  }) {
    const token = options.token.trim();
    const accountEmail = options.accountEmail?.trim();
    const rawBaseUrl = options.baseUrl?.trim();

    if (!accountEmail) {
      throw new BadRequestException('Jira account email is required');
    }
    if (!rawBaseUrl) {
      throw new BadRequestException('Jira base URL is required');
    }
    if (!token) {
      throw new BadRequestException('Jira API token is required');
    }

    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(rawBaseUrl);
    } catch {
      throw new BadRequestException('Jira base URL must be a valid HTTPS URL');
    }

    if (parsedBaseUrl.protocol !== 'https:') {
      throw new BadRequestException('Jira base URL must use HTTPS');
    }

    return {
      baseUrl: parsedBaseUrl.origin,
      auth: Buffer.from(`${accountEmail}:${token}`).toString('base64'),
    };
  }

  private async requestJiraJson<T>(
    url: string,
    init: RequestInit,
    operation: 'validation' | 'fetch',
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch {
      throw new BadGatewayException(
        'Could not reach Jira. Verify the base URL and network connection.',
      );
    }

    const body = await response.text();
    this.logger.debug(`Jira ${operation} responseStatus=${response.status}`);
    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? 'Jira authentication failed. Verify the account email and API token.'
          : response.status === 404
            ? 'Jira API endpoint was not found. Verify the base URL.'
            : `Jira request failed with status ${response.status}.`;
      throw new BadGatewayException(message);
    }

    try {
      return body ? (JSON.parse(body) as T) : ({} as T);
    } catch {
      throw new BadGatewayException(
        'Jira returned an invalid response. Verify the base URL.',
      );
    }
  }
}
