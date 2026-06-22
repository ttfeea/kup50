import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ReportItemSource } from '@prisma/client';
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

type JiraRemoteLink = {
  object?: {
    title?: string;
    url?: string;
  };
};

type RepositoryLink = {
  label: string;
  url: string;
};

type JiraApiVersion = 2 | 3;

type JiraErrorCategory =
  | 'authentication'
  | 'dns'
  | 'endpoint_not_found'
  | 'http_error'
  | 'network'
  | 'non_json'
  | 'sso_redirect'
  | 'timeout'
  | 'tls';

class JiraRequestError extends Error {
  constructor(
    message: string,
    readonly category: JiraErrorCategory,
    readonly status?: number,
    readonly redirectDetected = false,
  ) {
    super(message);
  }
}

@Injectable()
export class JiraClient extends BaseClient {
  async validateToken(options: {
    token: string;
    baseUrl?: string | null;
    accountEmail?: string | null;
  }): Promise<void> {
    const { baseUrl, auth } = this.normalizeOptions(options);
    await this.detectApiVersion(baseUrl, auth);
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
    const apiVersion = await this.detectApiVersion(baseUrl, auth);

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
      apiVersion === 3
        ? `${baseUrl}/rest/api/3/search/jql`
        : `${baseUrl}/rest/api/2/search`,
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
      apiVersion,
    );

    const issues = response.issues ?? [];

    return Promise.all(
      issues.map(async (issue) => {
        const issueTypeName = issue.fields?.issuetype?.name;
        const parent = issue.fields?.parent;
        const stageKey = parent?.key;
        const stageName = parent?.fields?.summary ?? stageKey;
        const jiraRemoteLinks = await this.fetchRepositoryRemoteLinks(
          baseUrl,
          auth,
          apiVersion,
          issue.key,
          stageKey,
        );

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
            jiraRemoteLinks,
          },
        };
      }),
    );
  }

  private async fetchRepositoryRemoteLinks(
    baseUrl: string,
    auth: string,
    apiVersion: JiraApiVersion,
    issueKey: string,
    stageKey?: string,
  ): Promise<RepositoryLink[]> {
    try {
      const links = await this.requestJiraJson<JiraRemoteLink[]>(
        `${baseUrl}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/remotelink`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        },
        apiVersion,
      );
      const byUrl = new Map<string, RepositoryLink>();
      const excludedResources = new Set(
        [issueKey, stageKey]
          .filter((key): key is string => Boolean(key))
          .map((key) => this.evidenceResourceKey(`${baseUrl}/browse/${key}`)),
      );

      for (const link of links) {
        const url = this.normalizeEvidenceUrl(link.object?.url);
        if (!url || excludedResources.has(this.evidenceResourceKey(url))) {
          continue;
        }

        if (!byUrl.has(url)) {
          byUrl.set(url, {
            label: link.object?.title?.trim() || url,
            url,
          });
        }
      }

      return [...byUrl.values()];
    } catch (error) {
      this.logger.warn(
        `Jira remote links fetch failed issue=${issueKey} reason=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private normalizeEvidenceUrl(value?: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return '';
      }

      url.hash = '';
      for (const key of [...url.searchParams.keys()]) {
        if (key.toLowerCase().startsWith('utm_')) {
          url.searchParams.delete(key);
        }
      }
      if (url.pathname !== '/') {
        url.pathname = url.pathname.replace(/\/+$/, '');
      }

      return url.toString();
    } catch {
      return '';
    }
  }

  private evidenceResourceKey(value: string) {
    try {
      const url = new URL(value);
      return `${url.origin.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      return value;
    }
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

    parsedBaseUrl.search = '';
    parsedBaseUrl.hash = '';
    parsedBaseUrl.pathname = parsedBaseUrl.pathname.replace(/\/+$/, '');

    return {
      baseUrl: parsedBaseUrl.toString().replace(/\/$/, ''),
      auth: Buffer.from(`${accountEmail}:${token}`).toString('base64'),
    };
  }

  private async detectApiVersion(
    baseUrl: string,
    auth: string,
  ): Promise<JiraApiVersion> {
    const errors: JiraRequestError[] = [];

    for (const apiVersion of [3, 2] as const) {
      try {
        await this.requestJiraJson<unknown>(
          `${baseUrl}/rest/api/${apiVersion}/myself`,
          {
            headers: {
              Authorization: `Basic ${auth}`,
              Accept: 'application/json',
            },
          },
          apiVersion,
        );
        return apiVersion;
      } catch (error) {
        if (error instanceof JiraRequestError) {
          errors.push(error);
          continue;
        }
        throw error;
      }
    }

    throw new BadGatewayException(this.selectDiagnosticMessage(errors));
  }

  private async requestJiraJson<T>(
    url: string,
    init: RequestInit,
    apiVersion: JiraApiVersion,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        redirect: 'manual',
        signal: init.signal ?? AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const diagnostic = this.transportDiagnostic(error);
      this.logDiagnostic(url, apiVersion, diagnostic);
      throw diagnostic;
    }

    const body = await response.text();
    const redirectDetected =
      response.redirected || (response.status >= 300 && response.status < 400);

    if (response.status === 401 || response.status === 403) {
      const error = new JiraRequestError(
        'Jira is reachable, but authentication failed.',
        'authentication',
        response.status,
        redirectDetected,
      );
      this.logDiagnostic(url, apiVersion, error);
      throw error;
    }

    if (redirectDetected) {
      const error = new JiraRequestError(
        'Jira URL was reached, but returned a login/SSO redirect instead of API data.',
        'sso_redirect',
        response.status,
        true,
      );
      this.logDiagnostic(url, apiVersion, error);
      throw error;
    }

    if (response.status === 404) {
      const error = new JiraRequestError(
        'Jira endpoint was not found. Check whether this is Jira Cloud or Jira Server/Data Center.',
        'endpoint_not_found',
        response.status,
      );
      this.logDiagnostic(url, apiVersion, error);
      throw error;
    }

    if (!response.ok) {
      const error = new JiraRequestError(
        `Jira is reachable, but the API request failed with HTTP status ${response.status}.`,
        'http_error',
        response.status,
      );
      this.logDiagnostic(url, apiVersion, error);
      throw error;
    }

    try {
      return body ? (JSON.parse(body) as T) : ({} as T);
    } catch {
      const loginPage = this.looksLikeLoginPage(body);
      const error = new JiraRequestError(
        loginPage
          ? 'Jira URL was reached, but returned a login/SSO page instead of API data.'
          : 'Jira was reached, but the API returned a non-JSON response.',
        loginPage ? 'sso_redirect' : 'non_json',
        response.status,
      );
      this.logDiagnostic(url, apiVersion, error);
      throw error;
    }
  }

  private transportDiagnostic(error: unknown): JiraRequestError {
    const name = error instanceof Error ? error.name.toLowerCase() : '';
    const code = this.errorCode(error).toUpperCase();
    const detail = `${name} ${code} ${
      error instanceof Error ? error.message : ''
    }`.toLowerCase();

    if (name.includes('abort') || name.includes('timeout')) {
      return new JiraRequestError(
        'The Jira request timed out. The deployed server may require VPN or network allowlisting.',
        'timeout',
      );
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return new JiraRequestError(
        'The deployed server could not resolve this Jira host. Check the base URL and DNS/VPN access.',
        'dns',
      );
    }
    if (/certificate|cert_|ssl|tls|hostname/.test(detail)) {
      return new JiraRequestError(
        'Jira could not be reached because TLS/SSL validation failed. Check the Jira certificate.',
        'tls',
      );
    }

    return new JiraRequestError(
      'The deployed server cannot reach this Jira URL. It may require VPN or network allowlisting.',
      'network',
    );
  }

  private errorCode(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
      return '';
    }

    const directCode = (error as { code?: unknown }).code;
    if (typeof directCode === 'string') {
      return directCode;
    }

    return this.errorCode((error as { cause?: unknown }).cause);
  }

  private selectDiagnosticMessage(errors: JiraRequestError[]): string {
    const priority: JiraErrorCategory[] = [
      'authentication',
      'sso_redirect',
      'non_json',
      'tls',
      'dns',
      'timeout',
      'network',
      'http_error',
      'endpoint_not_found',
    ];

    for (const category of priority) {
      const match = errors.find((error) => error.category === category);
      if (match) {
        return match.message;
      }
    }

    return 'Jira connection validation failed.';
  }

  private looksLikeLoginPage(body: string) {
    const normalized = body.trim().toLowerCase();
    return (
      (normalized.startsWith('<!doctype html') ||
        normalized.startsWith('<html')) &&
      /login|log in|sign in|signin|sso|saml|oauth/.test(normalized)
    );
  }

  private logDiagnostic(
    url: string,
    apiVersion: JiraApiVersion,
    error: JiraRequestError,
  ) {
    const host = new URL(url).hostname;
    this.logger.warn(
      `Jira validation failed host=${host} status=${error.status ?? 'none'} redirect=${error.redirectDetected ? 'yes' : 'no'} apiVersion=${apiVersion} category=${error.category}`,
    );
  }
}
