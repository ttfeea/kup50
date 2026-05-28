import { apiRequest } from './client';

export type IntegrationProvider = 'JIRA' | 'GITLAB' | 'GITHUB';
export type IntegrationStatus = 'missing' | 'connected' | 'error';

export type IntegrationStatusDto = {
  provider: IntegrationProvider;
  connected: boolean;
  status: IntegrationStatus;
  message: string;
  baseUrl?: string | null;
  accountEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tokenPreview?: string;
};

export type SaveIntegrationTokenInput = {
  token: string;
  baseUrl?: string;
  accountEmail?: string;
};

export function listIntegrations(authToken: string | null) {
  return apiRequest<IntegrationStatusDto[]>('/integrations', {
    token: authToken,
  });
}

export function saveIntegrationToken(
  authToken: string | null,
  provider: IntegrationProvider,
  body: SaveIntegrationTokenInput,
) {
  return apiRequest<IntegrationStatusDto>(`/integrations/${provider}/token`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify(body),
  });
}

export function checkIntegration(
  authToken: string | null,
  provider: IntegrationProvider,
) {
  return apiRequest<{ connected: boolean; message: string }>(
    `/integrations/${provider}/check`,
    {
      method: 'POST',
      token: authToken,
    },
  );
}

export function disconnectIntegration(
  authToken: string | null,
  provider: IntegrationProvider,
) {
  return apiRequest<IntegrationStatusDto>(`/integrations/${provider}`, {
    method: 'DELETE',
    token: authToken,
  });
}
