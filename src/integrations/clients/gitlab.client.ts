import { Injectable } from '@nestjs/common';
import { ReportItemSource } from '@prisma/client';
import { BaseClient } from './base-client';
import { ExternalWorkItem } from '../types/external-work-item.type';

type GitLabIssue = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  web_url?: string;
  state?: string;
  updated_at?: string;
};

type GitLabMergeRequest = GitLabIssue;

@Injectable()
export class GitLabClient extends BaseClient {
  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    limit: number;
  }): Promise<ExternalWorkItem[]> {
    const baseUrl = (options.baseUrl ?? 'https://gitlab.com').replace(
      /\/$/,
      '',
    );
    const commonParams = new URLSearchParams({
      scope: 'assigned_to_me',
      order_by: 'updated_at',
      sort: 'desc',
      per_page: String(options.limit),
    });

    const [issues, mergeRequests] = await Promise.all([
      this.requestJson<GitLabIssue[]>(
        `${baseUrl}/api/v4/issues?${commonParams.toString()}`,
        { headers: { 'PRIVATE-TOKEN': options.token } },
        'GitLab',
      ),
      this.requestJson<GitLabMergeRequest[]>(
        `${baseUrl}/api/v4/merge_requests?${commonParams.toString()}`,
        { headers: { 'PRIVATE-TOKEN': options.token } },
        'GitLab',
      ),
    ]);

    const issueItems = issues.map((issue) => ({ ...issue, itemType: 'issue' }));
    const mergeRequestItems = mergeRequests.map((mergeRequest) => ({
      ...mergeRequest,
      itemType: 'merge_request',
    }));

    return [...issueItems, ...mergeRequestItems]
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .slice(0, options.limit)
      .map((item) => ({
        source: ReportItemSource.GITLAB,
        externalId: `${item.project_id}:${item.iid}`,
        title: item.title,
        url: item.web_url,
        type: item.itemType,
        updatedAt: item.updated_at,
        metadata: {
          gitlabId: item.id,
          iid: item.iid,
          projectId: item.project_id,
          state: item.state,
        },
      }));
  }
}
