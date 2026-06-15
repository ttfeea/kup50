import { API_BASE_URL } from '../config/api';

type ApiOptions = RequestInit & {
  token?: string | null;
};

function buildHeaders(options: ApiOptions) {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  return headers;
}

async function apiFetch(
  path: string,
  { token, ...requestOptions }: ApiOptions = {},
) {
  const options = { ...requestOptions, token };
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: buildHeaders(options),
    });
  } catch {
    throw new Error(
      'Connection error: Check your network and confirm the API is running.',
    );
  }

  if (!response.ok) {
    throw new Error(
      formatApiError(response.status, await readErrorMessage(response)),
    );
  }

  return response;
}

function formatApiError(status: number, detail: string) {
  if (status === 401) {
    return 'Session expired: Sign in again and retry.';
  }
  if (status === 403) {
    return 'Access denied: Check your account permissions.';
  }
  if (status === 404) {
    return detail.startsWith('Cannot GET')
      ? 'Feature unavailable: Update or restart the API, then retry.'
      : 'Not found: Refresh the page and check that the item still exists.';
  }
  if (status === 409) {
    return 'Conflict: Refresh the page before trying again.';
  }
  if (status === 400 || status === 422) {
    return `Invalid input: ${detail}`;
  }
  if (status >= 500) {
    return 'Server error: Retry shortly or contact support.';
  }

  return `Request failed: ${detail}`;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const rawBody: unknown = await (contentType.includes('application/json')
    ? response.json().catch(() => null)
    : response.text().catch(() => null));

  const stringBody = typeof rawBody === 'string' ? rawBody.trim() : '';
  const isHtml = stringBody
    ? /<\/?(html|body|head|title|script|doctype)/i.test(stringBody)
    : false;
  const responseMessage =
    typeof rawBody === 'object' && rawBody !== null && 'message' in rawBody
      ? rawBody.message
      : undefined;

  if (typeof responseMessage === 'string') {
    return responseMessage;
  }

  if (
    Array.isArray(responseMessage) &&
    responseMessage.every((item) => typeof item === 'string')
  ) {
    return responseMessage.join(', ');
  }

  return stringBody && !isHtml ? stringBody.slice(0, 500) : 'Request failed';
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const response = await apiFetch(path, options);

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function downloadApiFile(
  path: string,
  fileName: string,
  token: string,
) {
  const response = await apiFetch(path, { token });
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
