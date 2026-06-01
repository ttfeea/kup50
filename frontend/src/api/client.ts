const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const rawBody = await (contentType.includes('application/json')
      ? response.json().catch(() => null)
      : response.text().catch(() => null));

    const stringBody = typeof rawBody === 'string' ? rawBody.trim() : '';
    const isHtml = stringBody
      ? /<\/?(html|body|head|title|script|doctype)/i.test(stringBody)
      : false;

    const message =
      typeof rawBody?.message === 'string'
        ? rawBody.message
        : Array.isArray(rawBody?.message)
          ? rawBody.message.join(', ')
          : stringBody && !isHtml
            ? stringBody.slice(0, 500)
            : 'Request failed';

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
