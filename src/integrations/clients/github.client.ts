import { Injectable } from '@nestjs/common';
import { ReportItemSource, WorkItemType } from '@prisma/client';
import { WorkItem } from '../../common/types/work-item.type';
import { BaseClient } from './base-client';

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url?: string;
  repository_url?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  pull_request?: unknown;
};

type GitHubUser = {
  login: string;
};

type GitHubRepo = {
  full_name: string;
};

type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
  repo?: { name?: string };
  payload?: Record<string, unknown>;
};

type GitHubApiCommit = {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author?: { date?: string };
    committer?: { date?: string };
  };
};

type GitHubCompareCommit = {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author?: { date?: string };
  };
};

@Injectable()
export class GitHubClient extends BaseClient {
  async validateToken(options: {
    token: string;
    baseUrl?: string | null;
  }): Promise<void> {
    const baseUrl = this.getBaseUrl(options.baseUrl);
    const token = options.token.trim();

    await this.requestJson<unknown>(
      `${baseUrl}/user`,
      { headers: this.authHeaders(token) },
      'GitHub',
    );
  }

  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    limit: number;
    since?: Date;
  }): Promise<WorkItem[]> {
    const baseUrl = this.getBaseUrl(options.baseUrl);
    const token = options.token.trim();
    const commitBudget = Math.max(15, Math.floor(options.limit * 0.4));
    const otherBudget = options.limit - commitBudget;

    const [issues, events, repoCommits] = await Promise.all([
      this.fetchIssues(baseUrl, token, Math.ceil(otherBudget / 2), options.since),
      this.fetchEventItems(baseUrl, token, Math.ceil(otherBudget / 2), options.since),
      this.fetchRepositoryCommits(baseUrl, token, commitBudget, options.since),
    ]);

    return this.mergeWorkItems(
      this.filterItemsBySince([...issues, ...events, ...repoCommits], options.since),
      options.limit,
    );
  }

  private async fetchIssues(
    baseUrl: string,
    token: string,
    limit: number,
    since?: Date,
  ): Promise<WorkItem[]> {
    const params = new URLSearchParams({
      filter: 'assigned',
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: String(Math.min(limit, 100)),
    });

    if (since) {
      params.set('since', since.toISOString());
    }

    const issues = await this.requestJson<GitHubIssue[]>(
      `${baseUrl}/issues?${params.toString()}`,
      { headers: this.authHeaders(token) },
      'GitHub',
    );

    return issues.map((issue) => ({
      source: ReportItemSource.GITHUB,
      type: issue.pull_request ? WorkItemType.PR : WorkItemType.ISSUE,
      externalId: String(issue.id),
      title: issue.title,
      url: issue.html_url,
      activityCreatedAt: issue.created_at,
      activityUpdatedAt: issue.updated_at,
      metadata: {
        number: issue.number,
        state: issue.state,
        repositoryUrl: issue.repository_url,
      },
    }));
  }

  private async fetchEventItems(
    baseUrl: string,
    token: string,
    limit: number,
    since?: Date,
  ): Promise<WorkItem[]> {
    const user = await this.requestJson<GitHubUser>(
      `${baseUrl}/user`,
      { headers: this.authHeaders(token) },
      'GitHub',
    );

    const params = new URLSearchParams({
      per_page: String(Math.min(limit * 2, 100)),
    });

    const events = await this.requestJson<GitHubEvent[]>(
      `${baseUrl}/users/${encodeURIComponent(user.login)}/events?${params.toString()}`,
      { headers: this.authHeaders(token) },
      'GitHub',
    );

    const items: WorkItem[] = [];

    for (const event of events) {
      if (event.type === 'PullRequestEvent') {
        const pullRequest = event.payload?.pull_request as
          | Record<string, unknown>
          | undefined;
        if (pullRequest) {
          items.push(this.mapPullRequestEvent(event, pullRequest));
        }
        continue;
      }

      if (event.type === 'PushEvent') {
        const pushCommits = await this.mapPushEvent(baseUrl, token, event);
        items.push(...pushCommits);
      }
    }

    return items;
  }

  /** GitHub removed inline commits from PushEvent payloads — resolve via compare API. */
  private async mapPushEvent(
    baseUrl: string,
    token: string,
    event: GitHubEvent,
  ): Promise<WorkItem[]> {
    const inlineCommits = event.payload?.commits;
    if (Array.isArray(inlineCommits) && inlineCommits.length > 0) {
      const repoName = event.repo?.name ?? 'repository';
      return (inlineCommits as Array<{ sha?: string; message?: string; url?: string }>).map(
        (commit) => ({
          source: ReportItemSource.GITHUB,
          type: WorkItemType.COMMIT,
          externalId: `${repoName}:${commit.sha ?? event.id}`,
          title: commit.message?.split('\n')[0] ?? `Commit on ${repoName}`,
          url: typeof commit.url === 'string' ? commit.url : undefined,
          activityCreatedAt: event.created_at,
          activityUpdatedAt: event.created_at,
          metadata: { repo: repoName, sha: commit.sha, eventId: event.id },
        }),
      );
    }

    const before = typeof event.payload?.before === 'string' ? event.payload.before : '';
    const head = typeof event.payload?.head === 'string' ? event.payload.head : '';
    const repoName = event.repo?.name;

    if (
      !repoName ||
      !before ||
      !head ||
      /^0+$/.test(before.replace(/[^a-f0-9]/gi, ''))
    ) {
      return [];
    }

    try {
      const comparison = await this.requestJson<{ commits?: GitHubCompareCommit[] }>(
        `${baseUrl}/repos/${repoName}/compare/${before}...${head}`,
        { headers: this.authHeaders(token) },
        'GitHub',
      );

      return (comparison.commits ?? []).map((commit) => ({
        source: ReportItemSource.GITHUB,
        type: WorkItemType.COMMIT,
        externalId: `${repoName}:${commit.sha}`,
        title: commit.commit.message.split('\n')[0],
        url: commit.html_url,
        activityCreatedAt: commit.commit.author?.date ?? event.created_at,
        activityUpdatedAt: commit.commit.author?.date ?? event.created_at,
        metadata: { repo: repoName, sha: commit.sha, eventId: event.id },
      }));
    } catch {
      return [];
    }
  }

  private mapPullRequestEvent(
    event: GitHubEvent,
    pullRequest: Record<string, unknown>,
  ): WorkItem {
    const title =
      typeof pullRequest.title === 'string'
        ? pullRequest.title
        : 'Pull request activity';
    const htmlUrl =
      typeof pullRequest.html_url === 'string' ? pullRequest.html_url : undefined;

    return {
      source: ReportItemSource.GITHUB,
      type: WorkItemType.PR,
      externalId: `pr-event:${event.id}`,
      title,
      url: htmlUrl,
      activityCreatedAt: event.created_at,
      activityUpdatedAt: event.created_at,
      metadata: {
        number: pullRequest.number,
        action: event.payload?.action,
        repo: event.repo?.name,
        eventId: event.id,
      },
    };
  }

  private async fetchRepositoryCommits(
    baseUrl: string,
    token: string,
    limit: number,
    since?: Date,
  ): Promise<WorkItem[]> {
    const repos = await this.requestJson<GitHubRepo[]>(
      `${baseUrl}/user/repos?sort=pushed&per_page=10&affiliation=owner,collaborator,organization_member`,
      { headers: this.authHeaders(token) },
      'GitHub',
    );

    const perRepo = Math.max(5, Math.ceil(limit / Math.max(repos.length, 1)));
    const items: WorkItem[] = [];

    for (const repo of repos.slice(0, 10)) {
      if (items.length >= limit) {
        break;
      }

      try {
        const sinceParam = since ? `&since=${since.toISOString()}` : '';
        const commits = await this.requestJson<GitHubApiCommit[]>(
          `${baseUrl}/repos/${repo.full_name}/commits?per_page=${perRepo}${sinceParam}`,
          { headers: this.authHeaders(token) },
          'GitHub',
        );

        for (const commit of commits) {
          items.push({
            source: ReportItemSource.GITHUB,
            type: WorkItemType.COMMIT,
            externalId: `${repo.full_name}:${commit.sha}`,
            title: commit.commit.message.split('\n')[0],
            url: commit.html_url,
            activityCreatedAt:
              commit.commit.author?.date ?? commit.commit.committer?.date,
            activityUpdatedAt:
              commit.commit.committer?.date ?? commit.commit.author?.date,
            metadata: {
              repo: repo.full_name,
              sha: commit.sha,
            },
          });
        }
      } catch {
      }
    }

    return items;
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

  private filterItemsBySince(items: WorkItem[], since?: Date) {
    if (!since) {
      return items;
    }

    return items.filter((item) => {
      const timestamp = item.activityUpdatedAt ?? item.activityCreatedAt;
      if (!timestamp) {
        return false;
      }
      const itemDate = new Date(timestamp).getTime();
      return Number.isFinite(itemDate) && itemDate >= since.getTime();
    });
  }

  private getBaseUrl(baseUrl?: string | null) {
    return (baseUrl ?? 'https://api.github.com').trim().replace(/\/$/, '');
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}
