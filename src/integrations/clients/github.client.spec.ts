import { GitHubClient } from './github.client';

describe('GitHubClient', () => {
  let client: GitHubClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new GitHubClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('fetches repository commits without narrowing to the current user author filter', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString();

      if (target.includes('/issues?')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                number: 1,
                title: 'Issue',
                html_url: 'https://example.test/issues/1',
                repository_url: 'https://example.test/octo/demo',
                state: 'open',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
                pull_request: null,
              },
            ]),
            {
              status: 200,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            },
          ),
        );
      }

      if (target === 'https://api.github.com/user') {
        return Promise.resolve(
          new Response(JSON.stringify({ login: 'octocat' }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      if (target.includes('/users/octocat/events')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      if (target.includes('/user/repos')) {
        return Promise.resolve(
          new Response(JSON.stringify([{ full_name: 'octo/demo' }]), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      if (target.includes('/repos/octo/demo/commits')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                sha: 'abc123',
                html_url: 'https://example.test/commit/abc123',
                commit: {
                  message: 'Fix bug',
                  author: { date: '2024-01-03T00:00:00Z' },
                  committer: { date: '2024-01-03T00:00:00Z' },
                },
              },
            ]),
            {
              status: 200,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            },
          ),
        );
      }

      throw new Error(`Unexpected GitHub URL: ${target}`);
    });

    const items = await client.fetchRecentItems({
      token: 'ghp-token',
      limit: 25,
    });

    expect(items.some((item) => item.type === 'COMMIT')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/repos/octo/demo/commits?per_page='),
      expect.anything(),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/repos/octo/demo/commits?author='),
      expect.anything(),
    );
  });
});
