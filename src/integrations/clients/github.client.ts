import { Injectable } from '@nestjs/common';
import { ReportItemSource } from '@prisma/client';
import { BaseClient } from './base-client';
import { ExternalWorkItem } from '../types/external-work-item.type';

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url?: string;
  repository_url?: string;
  state?: string;
  updated_at?: string;
  pull_request?: unknown;
};

@Injectable()
export class GitHubClient extends BaseClient {
  async fetchRecentItems(options: {
    token: string;
    baseUrl?: string | null;
    limit: number;
  }): Promise<ExternalWorkItem[]> {
    const baseUrl = (options.baseUrl ?? 'https://api.github.com').replace(
      /\/$/,
      '',
    );
    const params = new URLSearchParams({
      filter: 'assigned',
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: String(options.limit),
    });

    const issues = await this.requestJson<GitHubIssue[]>(
      `${baseUrl}/issues?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${options.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      'GitHub',
    );

    return issues.map((issue) => ({
      source: ReportItemSource.GITHUB,
      externalId: String(issue.id),
      title: issue.title,
      url: issue.html_url,
      type: issue.pull_request ? 'pull_request' : 'issue',
      updatedAt: issue.updated_at,
      metadata: {
        number: issue.number,
        state: issue.state,
        repositoryUrl: issue.repository_url,
      },
    }));
  }
}
