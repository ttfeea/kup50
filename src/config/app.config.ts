import { registerAs } from '@nestjs/config';

const defaultFrontendUrls = [
  'http://localhost:5173',
  'https://kup50.vercel.app',
];

export default registerAs('app', () => {
  const configuredFrontendUrls = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    ''
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    frontendUrls: [
      ...new Set([...defaultFrontendUrls, ...configuredFrontendUrls]),
    ],
  };
});
