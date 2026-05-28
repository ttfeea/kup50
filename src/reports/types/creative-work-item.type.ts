export const CREATIVE_WORK_ITEM_TYPES = [
  'gitlab',
  'jira',
  'confluence',
  'manual',
] as const;

export type CreativeWorkItemType = (typeof CREATIVE_WORK_ITEM_TYPES)[number];

export interface CreativeWorkItem {
  title: string;
  stage?: string;
  type: CreativeWorkItemType;
  url?: string;
}
