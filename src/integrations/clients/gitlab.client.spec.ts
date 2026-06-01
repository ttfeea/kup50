import { GitLabClient } from './gitlab.client';

describe('GitLabClient', () => {
  let client: GitLabClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new GitLabClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('accepts a base URL that already includes /api/v4', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ username: 'dev' }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );

    await client.validateToken({
      token: 'glpat-token',
      baseUrl: 'https://gitlab.example.com/api/v4',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gitlab.example.com/api/v4/user',
      {
        headers: {
          'PRIVATE-TOKEN': 'glpat-token',
          Accept: 'application/json',
          'User-Agent': 'KUP50-Integration/1.0',
        },
        redirect: 'manual',
      },
    );
  });

  it('rejects HTML responses instead of trying to parse them as JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Just a moment...</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    await expect(
      client.validateToken({
        token: 'glpat-token',
        baseUrl: 'https://gitlab.example.com',
      }),
    ).rejects.toThrow('GitLab API blocked or invalid base URL');
  });

  it('uses only the host from base URLs that include web paths', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ username: 'dev' }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );

    await client.validateToken({
      token: 'glpat-token',
      baseUrl: 'https://gitlab.com/users/sign_in',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'glpat-token',
        }),
      }),
    );
  });

  it('falls back to bearer auth when GitLab redirects to sign-in', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          '<html><body>You are being <a href="https://gitlab.com/users/sign_in">redirected</a>.</body></html>',
          {
            status: 302,
            headers: {
              location: 'https://gitlab.com/users/sign_in',
              'content-type': 'text/html',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'dev' }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      );

    await client.validateToken({
      token: 'oauth-token',
      baseUrl: 'https://gitlab.com',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns a clear message when sign-in redirect persists', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '<html><body>You are being <a href="https://gitlab.com/users/sign_in">redirected</a>.</body></html>',
        {
          status: 302,
          headers: {
            location: 'https://gitlab.com/users/sign_in',
            'content-type': 'text/html',
          },
        },
      ),
    );

    await expect(
      client.validateToken({
        token: 'bad-token',
        baseUrl: 'https://gitlab.com',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.stringContaining('sign-in page'),
      }),
    });
  });

  it('uses broad GitLab filters for issues and project discovery without timing out MR lookups', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString();

      if (target.includes('/user')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: 42, username: 'dev', name: 'Dev User', email: 'dev@example.com' }),
            {
              status: 200,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            },
          ),
        );
      }

      if (target.includes('/issues?')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      if (target.includes('/merge_requests?')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      if (target.includes('/events?')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      if (target.includes('/projects?')) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      );
    });

    await client.fetchRecentItems({
      token: 'glpat-token',
      baseUrl: 'https://gitlab.example.com',
      limit: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/issues?author_id=42'),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/merge_requests?state=opened'),
      expect.anything(),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/merge_requests?scope=all'),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/projects?membership=true'),
      expect.anything(),
    );
  });

  it('falls back to bearer auth when private token auth is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('Unauthorized', {
          status: 401,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'dev' }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      );

    await client.validateToken({
      token: 'oauth-token',
      baseUrl: 'https://gitlab.example.com',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://gitlab.example.com/api/v4/user',
      {
        headers: {
          'PRIVATE-TOKEN': 'oauth-token',
          Accept: 'application/json',
          'User-Agent': 'KUP50-Integration/1.0',
        },
        redirect: 'manual',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://gitlab.example.com/api/v4/user',
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KUP50-Integration/1.0',
          Authorization: 'Bearer oauth-token',
        },
        redirect: 'manual',
      },
    );
  });
});
