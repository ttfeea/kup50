import type {
  IntegrationProvider,
  IntegrationStatusDto,
  SaveIntegrationTokenDto,
} from '../models/dtos/integration.dto';
import { apiRequest } from './client';

export function listIntegrations(authToken: string) {
  return apiRequest<IntegrationStatusDto[]>('/integrations', {
    token: authToken,
  });
}

export function saveIntegrationToken(
  authToken: string,
  provider: IntegrationProvider,
  body: SaveIntegrationTokenDto,
) {
  return apiRequest<IntegrationStatusDto>(`/integrations/${provider}/token`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify(body),
  });
}

export function checkIntegration(
  authToken: string,
  provider: IntegrationProvider,
) {
  return apiRequest<IntegrationStatusDto>(`/integrations/${provider}/check`, {
    method: 'POST',
    token: authToken,
  });
}

export function disconnectIntegration(
  authToken: string,
  provider: IntegrationProvider,
) {
  return apiRequest<IntegrationStatusDto>(`/integrations/${provider}`, {
    method: 'DELETE',
    token: authToken,
  });
}
