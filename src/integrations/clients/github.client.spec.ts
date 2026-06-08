import { GitHubClient } from './github.client';

describe('GitHubClient', () => {
  let client: GitHubClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new GitHubClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('fetches pull requests and branch details without fetching commits', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString();

      if (target === 'https://api.github.com/user') {
        return Promise.resolve(
          new Response(JSON.stringify({ login: 'octocat' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }

      if (target.includes('/search/issues?')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 10,
                  number: 7,
                  title: 'KUP-42 implement report flow',
                  html_url: 'https://github.com/octo/demo/pull/7',
                  repository_url: 'https://api.github.com/repos/octo/demo',
                  state: 'closed',
                  updated_at: '2026-06-05T00:00:00Z',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );
      }

      if (target.endsWith('/repos/octo/demo/pulls/7')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              head: { ref: 'feature/KUP-42' },
              base: { ref: 'main' },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );
      }

      throw new Error(`Unexpected GitHub URL: ${target}`);
    });

    const items = await client.fetchRecentItems({
      token: 'ghp-token',
      limit: 25,
      since: new Date('2026-06-01T00:00:00Z'),
      until: new Date('2026-06-08T23:59:59Z'),
    });

    expect(items).toEqual([
      expect.objectContaining({
        type: 'PR',
        title: 'KUP-42 implement report flow',
        metadata: expect.objectContaining({
          sourceBranch: 'feature/KUP-42',
          targetBranch: 'main',
        }),
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/search/issues?'),
      expect.anything(),
    );
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/commits')),
    ).toBe(false);
  });
});
