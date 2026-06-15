import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function validateProductionApiUrl(value: string | undefined) {
  if (!value?.trim()) {
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

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Invalid VITE_API_BASE_URL. Expected an absolute http:// or https:// URL without query parameters or fragments.',
    );
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '');
    validateProductionApiUrl(env.VITE_API_BASE_URL);
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
  };
});
