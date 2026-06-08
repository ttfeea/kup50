import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ReportItemSource, WorkItemType } from '@prisma/client';
import { WorkItem } from '../../common/types/work-item.type';
import { BaseClient } from './base-client';

type GitLabMergeRequest = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  web_url?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  source_branch?: string;
  target_branch?: string;
};

type GitLabUser = {
  id: number;
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
    until?: Date;
  }): Promise<WorkItem[]> {
    const apiBaseUrl = this.getApiBaseUrl(options.baseUrl);
    const token = options.token.trim();
    const authenticatedUser = await this.fetchAuthenticatedUser(
      apiBaseUrl,
      token,
    );
    return this.fetchMergeRequests(
      apiBaseUrl,
      token,
      options.limit,
      authenticatedUser,
      options.since,
      options.until,
    );
  }

  private async fetchMergeRequests(
    apiBaseUrl: string,
    token: string,
    limit: number,
    user: GitLabUser,
    since?: Date,
    until?: Date,
  ) {
    const sinceParam = since ? `&updated_after=${since.toISOString()}` : '';
    const untilParam = until ? `&updated_before=${until.toISOString()}` : '';
    const authored = await this.requestGitLabJson<GitLabMergeRequest[]>(
      `${apiBaseUrl}/merge_requests?scope=all&state=all&author_id=${user.id}&order_by=updated_at&sort=desc&per_page=${limit}${sinceParam}${untilParam}`,
      token,
    );
    const assigned = await this.requestGitLabJson<GitLabMergeRequest[]>(
      `${apiBaseUrl}/merge_requests?scope=all&state=all&assignee_id=${user.id}&order_by=updated_at&sort=desc&per_page=${limit}${sinceParam}${untilParam}`,
      token,
    );

    const mergeRequests = this.dedupeByKey(
      [...authored, ...assigned],
      (item) => `${item.project_id}:${item.iid}`,
    ).filter((item) => item?.id != null);

    return mergeRequests.map((item) => this.mapMergeRequest(item, apiBaseUrl));
  }

  private mapMergeRequest(
    item: GitLabMergeRequest,
    apiBaseUrl: string,
  ): WorkItem {
    const providerBaseUrl = apiBaseUrl.replace(/\/api\/v4$/, '');

    return {
      source: ReportItemSource.GITLAB,
      type: WorkItemType.MR,
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
        sourceBranch: item.source_branch,
        targetBranch: item.target_branch,
        providerSearchUrl: `${providerBaseUrl}/dashboard/merge_requests?search=`,
      },
    };
  }

  private async fetchAuthenticatedUser(apiBaseUrl: string, token: string) {
    return this.requestGitLabJson<GitLabUser>(`${apiBaseUrl}/user`, token);
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
