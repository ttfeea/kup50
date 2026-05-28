import { ReportItemSource } from '@prisma/client';

export type ExternalWorkItem = {
  source: ReportItemSource;
  externalId: string;
  title: string;
  url?: string;
  type?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};
