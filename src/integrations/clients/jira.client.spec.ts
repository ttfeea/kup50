import { JiraClient } from './jira.client';

describe('JiraClient', () => {
  let client: JiraClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new JiraClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('requires an account email', async () => {
    await expect(
      client.validateToken({
        token: 'api-token',
        baseUrl: 'https://company.atlassian.net',
      }),
    ).rejects.toThrow('Jira account email is required');
  });

  it('rejects an invalid Jira base URL clearly', async () => {
    await expect(
      client.validateToken({
        token: 'api-token',
        baseUrl: 'company.atlassian.net',
        accountEmail: 'employee@example.com',
      }),
    ).rejects.toThrow('Jira base URL must be a valid HTTPS URL');
  });

  it('validates with Basic auth against the Jira myself endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ accountId: 'account-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await client.validateToken({
      token: ' api-token ',
      baseUrl: ' https://company.atlassian.net/ ',
      accountEmail: ' employee@example.com ',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://company.atlassian.net/rest/api/3/myself',
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            'employee@example.com:api-token',
          ).toString('base64')}`,
          Accept: 'application/json',
        },
      },
    );
  });

  it('returns a clear authentication error for an invalid token', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Unauthorized</html>', { status: 401 }),
    );

    await expect(
      client.validateToken({
        token: 'bad-token',
        baseUrl: 'https://company.atlassian.net',
        accountEmail: 'employee@example.com',
      }),
    ).rejects.toThrow('Jira authentication failed');
  });

  it('uses quoted JQL dates and maps Jira issues to work items', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accountId: 'account-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
        JSON.stringify({
          issues: [
            {
              id: '10001',
              key: 'KUP-42',
              self: 'https://company.atlassian.net/rest/api/3/issue/10001',
              fields: {
                summary: 'Prepare monthly report',
                issuetype: { name: 'Task' },
                status: { name: 'In Progress' },
                created: '2026-06-01T10:00:00.000Z',
                updated: '2026-06-08T10:00:00.000Z',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
        ),
      );

    const items = await client.fetchRecentItems({
      token: 'api-token',
      baseUrl: 'https://company.atlassian.net/',
      accountEmail: 'employee@example.com',
      limit: 10,
      since: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://company.atlassian.net/rest/api/3/search/jql',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(
          'assignee = currentUser() AND updated >= \\"2026-06-01\\" ORDER BY updated DESC',
        ),
      }),
    );
    expect(items).toEqual([
      expect.objectContaining({
        source: 'JIRA',
        type: 'TASK',
        externalId: 'KUP-42',
        title: 'KUP-42 Prepare monthly report',
        url: 'https://company.atlassian.net/browse/KUP-42',
        metadata: {
          id: '10001',
          key: 'KUP-42',
          status: 'In Progress',
          issueType: 'Task',
          updated: '2026-06-08T10:00:00.000Z',
        },
      }),
    ]);
  });
});
