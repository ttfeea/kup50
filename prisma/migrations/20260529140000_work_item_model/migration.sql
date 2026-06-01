-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('COMMIT', 'PR', 'MR', 'ISSUE', 'TASK', 'NOTE', 'CUSTOM');

-- AlterEnum
ALTER TYPE "ReportItemSource" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "report_items" ADD COLUMN "work_type" "WorkItemType";

UPDATE "report_items"
SET "work_type" = CASE
  WHEN LOWER(COALESCE("type", '')) IN ('commit', 'pushed') THEN 'COMMIT'::"WorkItemType"
  WHEN LOWER(COALESCE("type", '')) IN ('pull_request', 'pr') THEN 'PR'::"WorkItemType"
  WHEN LOWER(COALESCE("type", '')) IN ('merge_request', 'mr') THEN 'MR'::"WorkItemType"
  WHEN LOWER(COALESCE("type", '')) IN ('task', 'sub-task', 'subtask') THEN 'TASK'::"WorkItemType"
  WHEN LOWER(COALESCE("type", '')) IN ('note') THEN 'NOTE'::"WorkItemType"
  WHEN LOWER(COALESCE("type", '')) IN ('custom') THEN 'CUSTOM'::"WorkItemType"
  WHEN "source" = 'JIRA' THEN 'TASK'::"WorkItemType"
  WHEN "source" = 'GITHUB' THEN 'ISSUE'::"WorkItemType"
  WHEN "source" = 'GITLAB' THEN 'ISSUE'::"WorkItemType"
  ELSE 'ISSUE'::"WorkItemType"
END
WHERE "work_type" IS NULL;

ALTER TABLE "report_items" ALTER COLUMN "work_type" SET NOT NULL;
ALTER TABLE "report_items" DROP COLUMN "type";
