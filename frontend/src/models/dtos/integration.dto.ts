import type { WorkItem } from '../../types/work-item';

export type IntegrationProvider = 'JIRA' | 'GITLAB' | 'GITHUB';
export type IntegrationStatus = 'missing' | 'connected' | 'error';

export type IntegrationStatusDto = {
  provider: IntegrationProvider;
  connected: boolean;
  status: IntegrationStatus;
  message: string;
  baseUrl?: string | null;
  accountEmail?: string | null;
  connectionCheckedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tokenPreview?: string;
};

export type SaveIntegrationTokenDto = {
  token: string;
  baseUrl?: string;
  accountEmail?: string;
};

export type IntegrationItemsResponseDto = {
  items: WorkItem[];
};
