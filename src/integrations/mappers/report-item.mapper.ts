import { AttachReportItemDto } from '../../reports/dto/attach-report-items.dto';
import { ExternalWorkItem } from '../types/external-work-item.type';

export function mapExternalItemsToReportItems(
  items: ExternalWorkItem[],
): AttachReportItemDto[] {
  return items.map((item) => ({
    source: item.source,
    externalId: item.externalId,
    title: item.title,
    url: item.url,
    type: item.type,
    metadata: {
      ...(item.metadata ?? {}),
      updatedAt: item.updatedAt,
    },
  }));
}
