function readApiBaseUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      'Missing VITE_API_BASE_URL. Set it to the public backend URL before building the frontend.',
    );
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(
      'Invalid VITE_API_BASE_URL. Expected an absolute http:// or https:// URL.',
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      'Invalid VITE_API_BASE_URL. Expected an absolute http:// or https:// URL.',
    );
  }

  if (url.search || url.hash) {
    throw new Error(
      'Invalid VITE_API_BASE_URL. Query parameters and fragments are not supported.',
    );
  }

  return url.toString().replace(/\/+$/, '');
}

export const API_BASE_URL = readApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
