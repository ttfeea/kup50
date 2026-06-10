const configuredApiUrl: unknown = import.meta.env.VITE_API_URL;

export const API_BASE_URL =
  typeof configuredApiUrl === 'string' && configuredApiUrl.trim()
    ? configuredApiUrl.replace(/\/+$/, '')
    : '/api';

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: buildHeaders(options),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response;
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
