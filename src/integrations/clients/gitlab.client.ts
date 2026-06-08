import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ReportItemSource, WorkItemType } from '@prisma/client';
import { WorkItem } from '../../common/types/work-item.type';
import { BaseClient } from './base-client';

type GitLabIssue = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  web_url?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
};

type GitLabMergeRequest = GitLabIssue;

type GitLabEvent = {
  id: number;
  action_name?: string;
  created_at?: string;
  project_id?: number;
  target_title?: string;
  target_type?: string;
  push_data?: {
    commit_to?: string;
    commit_title?: string;
    commit_count?: number;
  };
};

type GitLabProject = {
  id: number;
  name?: string;
  path_with_namespace?: string;
  web_url?: string;
  visibility?: string;
};

type GitLabUser = {
  id: number;
  username?: string;
  name?: string;
  email?: string;
};

type GitLabCommit = {
  id: string;
  title?: string;
  message?: string;
  author_name?: string;
  author_email?: string;
  committer_name?: string;
  committer_email?: string;
  web_url?: string;
  created_at?: string;
  committed_date?: string;
};

@Injectable()
export class GitLabClient extends BaseClient {
  async validateToken(options: {
    token: string;
    baseUrl?: string | null;
  }): Promise<void> {
    const apiBaseUrl = this.getApiBaseUrl(options.baseUrl);
    const token = options.token.trim();

    if (!token) {
      throw new BadRequestException('GitLab token is required');
    }

    await this.requestGitLabJson<unknown>(`${apiBaseUrl}/user`, token);
  }

  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    limit: number;
    since?: Date;
  }): Promise<WorkItem[]> {
    const apiBaseUrl = this.getApiBaseUrl(options.baseUrl);
    const token = options.token.trim();
    const commitBudget = Math.max(15, Math.floor(options.limit * 0.4));
    const otherBudget = options.limit - commitBudget;
    const perOther = Math.max(5, Math.ceil(otherBudget / 3));

    const authenticatedUser = await this.fetchAuthenticatedUser(apiBaseUrl, token);
    const memberProjects = await this.fetchMemberProjects(apiBaseUrl, token);

    const [issues, mergeRequests, events, commits] = await Promise.all([
      this.fetchIssues(apiBaseUrl, token, perOther, authenticatedUser, memberProjects, options.since),
      this.fetchMergeRequests(apiBaseUrl, token, perOther, authenticatedUser, options.since),
      this.fetchEventItems(apiBaseUrl, token, perOther, memberProjects, options.since),
      this.fetchRecentCommits(apiBaseUrl, token, commitBudget, authenticatedUser, memberProjects, options.since),
    ]);

    return this.mergeWorkItems(
      [...issues, ...mergeRequests, ...events, ...commits],
      options.limit,
    );
  }

  private async fetchIssues(
    apiBaseUrl: string,
    token: string,
    limit: number,
    user: GitLabUser,
    memberProjects: GitLabProject[],
    since?: Date,
  ) {
    const sinceParam = since ? `&updated_after=${since.toISOString()}` : '';
    const authored = await this.requestGitLabJson<GitLabIssue[]>(
      `${apiBaseUrl}/issues?author_id=${user.id}&state=all&order_by=updated_at&sort=desc&per_page=${limit}${sinceParam}`,
      token,
    );
    const assigned = await this.requestGitLabJson<GitLabIssue[]>(
      `${apiBaseUrl}/issues?assignee_id=${user.id}&state=all&order_by=updated_at&sort=desc&per_page=${limit}${sinceParam}`,
      token,
    );

    const issues = this.dedupeByKey([...authored, ...assigned], (item) => `${item.project_id}:${item.iid}`)
      .filter((item) => this.isRelevantGitLabItem(item.project_id, memberProjects));

    return issues.map((issue) => this.mapIssue(issue, WorkItemType.ISSUE));
  }

  private async fetchMergeRequests(
    apiBaseUrl: string,
    token: string,
    limit: number,
    user: GitLabUser,
    since?: Date,
  ) {
    const sinceParam = since ? `&updated_after=${since.toISOString()}` : '';
    const authored = await this.requestGitLabJson<GitLabMergeRequest[]>(
      `${apiBaseUrl}/merge_requests?state=opened&author_id=${user.id}&order_by=updated_at&sort=desc&per_page=${limit}${sinceParam}`,
      token,
    );
    const assigned = await this.requestGitLabJson<GitLabMergeRequest[]>(
      `${apiBaseUrl}/merge_requests?state=opened&assignee_id=${user.id}&order_by=updated_at&sort=desc&per_page=${limit}${sinceParam}`,
      token,
    );

    const mergeRequests = this.dedupeByKey([...authored, ...assigned], (item) => `${item.project_id}:${item.iid}`)
      .filter((item) => item?.id != null);

    return mergeRequests.map((item) => this.mapIssue(item, WorkItemType.MR));
  }

  private mapIssue(item: GitLabIssue, type: WorkItemType): WorkItem {
    return {
      source: ReportItemSource.GITLAB,
      type,
      externalId: `${item.project_id}:${item.iid}`,
      title: item.title,
      url: item.web_url,
      activityCreatedAt: item.created_at,
      activityUpdatedAt: item.updated_at,
      metadata: {
        gitlabId: item.id,
        iid: item.iid,
        projectId: item.project_id,
        state: item.state,
      },
    };
  }

  private async fetchEventItems(
    apiBaseUrl: string,
    token: string,
    limit: number,
    memberProjects: GitLabProject[],
    since?: Date,
  ) {
    const sinceParam = since ? `&after=${since.toISOString()}` : '';
    const events = await this.requestGitLabJson<GitLabEvent[]>(
      `${apiBaseUrl}/events?per_page=${Math.min(limit * 2, 100)}${sinceParam}`,
      token,
    );

    const items: WorkItem[] = [];

    for (const event of events) {
      if (!this.isRelevantGitLabItem(event.project_id ?? 0, memberProjects)) {
        continue;
      }

      if (event.action_name === 'pushed' && event.push_data?.commit_to) {
        items.push({
          source: ReportItemSource.GITLAB,
          type: WorkItemType.COMMIT,
          externalId: `event:${event.id}:${event.push_data.commit_to}`,
          title:
            event.push_data.commit_title ??
            event.target_title ??
            'GitLab push activity',
          activityCreatedAt: event.created_at,
          activityUpdatedAt: event.created_at,
          metadata: {
            projectId: event.project_id,
            action: event.action_name,
            commitTo: event.push_data.commit_to,
            commitCount: event.push_data.commit_count,
          },
        });
        continue;
      }

      if (event.target_type === 'MergeRequest') {
        items.push({
          source: ReportItemSource.GITLAB,
          type: WorkItemType.MR,
          externalId: `event-mr:${event.id}`,
          title: event.target_title ?? 'Merge request activity',
          activityCreatedAt: event.created_at,
          activityUpdatedAt: event.created_at,
          metadata: {
            projectId: event.project_id,
            action: event.action_name,
          },
        });
      }
    }

    return items;
  }

  private async fetchRecentCommits(
    apiBaseUrl: string,
    token: string,
    limit: number,
    user: GitLabUser,
    memberProjects: GitLabProject[],
    since?: Date,
  ) {
    const projects = memberProjects.slice(0, 8);

    const perProject = Math.max(5, Math.ceil(limit / Math.max(projects.length, 1)));
    const sinceParam = since ? `&since=${since.toISOString()}` : '';

    const commitLists = await Promise.all(
      projects.map((project) =>
        this.requestGitLabJson<GitLabCommit[]>(
          `${apiBaseUrl}/projects/${project.id}/repository/commits?per_page=${perProject}${sinceParam}`,
          token,
        ).catch(() => [] as GitLabCommit[]),
      ),
    );

    const allCommits = commitLists.flat();
    const filteredCommits = allCommits.filter((commit) =>
      this.matchesAuthenticatedGitLabUser(commit, user),
    );

    return filteredCommits.map((commit, index) => ({
      source: ReportItemSource.GITLAB,
      type: WorkItemType.COMMIT,
      externalId: commit.id || `commit-${index}`,
      title: commit.title ?? commit.message?.split('\n')[0] ?? 'GitLab commit',
      url: commit.web_url,
      activityCreatedAt: commit.created_at ?? commit.committed_date,
      activityUpdatedAt: commit.committed_date ?? commit.created_at,
      metadata: {
        sha: commit.id,
      },
    }));
  }

  private async fetchAuthenticatedUser(apiBaseUrl: string, token: string) {
    return this.requestGitLabJson<GitLabUser>(`${apiBaseUrl}/user`, token);
  }

  private async fetchMemberProjects(apiBaseUrl: string, token: string) {
    return this.requestGitLabJson<GitLabProject[]>(
      `${apiBaseUrl}/projects?membership=true&min_access_level=10&simple=true&order_by=last_activity_at&sort=desc&per_page=100`,
      token,
    );
  }

  private isRelevantGitLabItem(projectId: number | undefined, memberProjects: GitLabProject[]) {
    return Boolean(projectId && memberProjects.some((project) => project.id === projectId));
  }

  private matchesAuthenticatedGitLabUser(commit: GitLabCommit, user: GitLabUser) {
    const candidateValues = [
      user.username,
      user.name,
      user.email,
      commit.author_name,
      commit.author_email,
      commit.committer_name,
      commit.committer_email,
      commit.title,
      commit.message,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    const userTokens = [user.username, user.name, user.email]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    return candidateValues.some((value) =>
      userTokens.some((token) => value.includes(token)),
    );
  }

  private dedupeByKey<T>(items: T[], keyFn: (item: T) => string) {
    const seen = new Set<string>();

    return items.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
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

  private getApiBaseUrl(baseUrl?: string | null) {
    const raw = (baseUrl?.trim() || 'https://gitlab.com').replace(/\/+$/, '');

    try {
      const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
      return `${parsed.origin}/api/v4`;
    } catch {
      const fallback = raw.replace(/\/api\/v4\/?$/, '');
      return `${fallback}/api/v4`;
    }
  }

  private async requestGitLabJson<T>(url: string, token: string): Promise<T> {
    const privateTokenResponse = await fetch(url, {
      headers: this.buildGitLabHeaders(token, 'PRIVATE-TOKEN'),
      redirect: 'manual',
    });

    if (privateTokenResponse.ok) {
      return this.parseJsonResponse(privateTokenResponse, url, 'PRIVATE-TOKEN');
    }

    if (this.shouldRetryWithBearer(privateTokenResponse.status)) {
      const bearerTokenResponse = await fetch(url, {
        headers: this.buildGitLabHeaders(token, 'Bearer'),
        redirect: 'manual',
      });

      if (bearerTokenResponse.ok) {
        return this.parseJsonResponse(bearerTokenResponse, url, 'Bearer');
      }

      throw await this.toGitLabException(bearerTokenResponse, 'Bearer');
    }

    throw await this.toGitLabException(privateTokenResponse, 'PRIVATE-TOKEN');
  }

  private buildGitLabHeaders(
    token: string,
    mode: 'PRIVATE-TOKEN' | 'Bearer',
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'KUP50-Integration/1.0',
    };

    if (mode === 'PRIVATE-TOKEN') {
      headers['PRIVATE-TOKEN'] = token.trim();
    } else {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    return headers;
  }

  private shouldRetryWithBearer(status: number) {
    return [301, 302, 303, 307, 308, 401, 403].includes(status);
  }

  private async parseJsonResponse<T>(
    response: Response,
    url: string,
    authMode: string,
  ): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();

    if (!contentType.includes('application/json')) {
      throw new BadGatewayException({
        message:
          'GitLab API blocked or invalid base URL. Expected JSON from the GitLab API.',
        status: response.status,
        details: body.slice(0, 300),
      });
    }

    if (!body) {
      throw new BadGatewayException({
        message: `GitLab request failed with ${authMode} auth: empty response body.`,
        status: response.status,
      });
    }

    return JSON.parse(body) as T;
  }

  private async toGitLabException(response: Response, authMode: string) {
    const body = await response.text();
    const location = response.headers.get('location') ?? '';

    if (this.isSignInRedirect(response.status, body, location)) {
      return new BadGatewayException({
        message:
          'GitLab returned a sign-in page. Use the instance root URL and a token with api scope.',
        status: response.status,
      });
    }

    return new BadGatewayException({
      message: `GitLab request failed with ${authMode} auth (status ${response.status}).`,
      status: response.status,
      details: body.slice(0, 500),
    });
  }

  private isSignInRedirect(status: number, body: string, location: string) {
    if ([301, 302, 303, 307, 308].includes(status)) {
      return true;
    }

    const haystack = `${body} ${location}`.toLowerCase();
    return haystack.includes('sign_in');
  }
}
