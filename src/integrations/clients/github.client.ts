import { Injectable } from '@nestjs/common';
import { ReportItemSource, WorkItemType } from '@prisma/client';
import { WorkItem } from '../../common/types/work-item.type';
import { BaseClient } from './base-client';

type GitHubUser = {
  login: string;
};

type GitHubSearchResponse = {
  items?: Array<{
    id: number;
    number: number;
    title: string;
    html_url?: string;
    repository_url?: string;
    state?: string;
    created_at?: string;
    updated_at?: string;
  }>;
};

type GitHubPullRequest = {
  head?: { ref?: string };
  base?: { ref?: string };
};

@Injectable()
export class GitHubClient extends BaseClient {
  async validateToken(options: {
    token: string;
    baseUrl?: string | null;
  }): Promise<void> {
    const baseUrl = this.getBaseUrl(options.baseUrl);

    await this.requestJson<unknown>(
      `${baseUrl}/user`,
      { headers: this.authHeaders(options.token) },
      'GitHub',
    );
  }

  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    limit: number;
    since?: Date;
    until?: Date;
  }): Promise<WorkItem[]> {
    const baseUrl = this.getBaseUrl(options.baseUrl);
    const headers = this.authHeaders(options.token);
    const user = await this.requestJson<GitHubUser>(
      `${baseUrl}/user`,
      { headers },
      'GitHub',
    );
    const dateFilter = this.buildDateFilter(options.since, options.until);
    const query = `is:pr involves:${user.login}${dateFilter}`;
    const params = new URLSearchParams({
      q: query,
      sort: 'updated',
      order: 'desc',
      per_page: String(Math.min(options.limit, 100)),
    });
    const response = await this.requestJson<GitHubSearchResponse>(
      `${baseUrl}/search/issues?${params.toString()}`,
      { headers },
      'GitHub',
    );

    return Promise.all(
      (response.items ?? []).map(async (item) => {
        const repoPath = item.repository_url?.split('/repos/')[1];
        const details = repoPath
          ? await this.requestJson<GitHubPullRequest>(
              `${baseUrl}/repos/${repoPath}/pulls/${item.number}`,
              { headers },
              'GitHub',
            ).catch((): GitHubPullRequest => ({}))
          : {};

        return {
          source: ReportItemSource.GITHUB,
          type: WorkItemType.PR,
          externalId: String(item.id),
          title: item.title,
          url: item.html_url,
          activityCreatedAt: item.created_at,
          activityUpdatedAt: item.updated_at,
          metadata: {
            number: item.number,
            state: item.state,
            repositoryUrl: item.repository_url,
            sourceBranch: details.head?.ref,
            targetBranch: details.base?.ref,
            providerSearchUrl: `${this.getWebBaseUrl(baseUrl)}/pulls?q=is%3Apr+`,
          },
        };
      }),
    );
  }

  private buildDateFilter(since?: Date, until?: Date) {
    if (!since) {
      return '';
    }

    const start = since.toISOString().split('T')[0];
    const end = until?.toISOString().split('T')[0];
    return end ? ` updated:${start}..${end}` : ` updated:>=${start}`;
  }

  private getBaseUrl(baseUrl?: string | null) {
    return (baseUrl ?? 'https://api.github.com').trim().replace(/\/$/, '');
  }

  private getWebBaseUrl(apiBaseUrl: string) {
    if (apiBaseUrl === 'https://api.github.com') {
      return 'https://github.com';
    }

    return apiBaseUrl.replace(/\/api\/v3$/, '');
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}
