-- Scalable reporting: add period window + ReportItem relation

-- period_start / period_end for default reporting window (today - 30 days)
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMP(3);

UPDATE "reports"
SET
  "period_end" = COALESCE("period_end", CURRENT_TIMESTAMP),
  "period_start" = COALESCE("period_start", CURRENT_TIMESTAMP - INTERVAL '30 days')
WHERE
  "period_end" IS NULL
  OR "period_start" IS NULL;

ALTER TABLE "reports"
  ALTER COLUMN "period_start" SET NOT NULL,
  ALTER COLUMN "period_end" SET NOT NULL;

-- enum for external work item source
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportItemSource') THEN
    CREATE TYPE "ReportItemSource" AS ENUM ('JIRA', 'GITLAB');
  END IF;
END $$;

-- core table for linked Jira/GitLab items
CREATE TABLE IF NOT EXISTS "report_items" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "source" "ReportItemSource" NOT NULL,
  "external_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "type" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "report_items_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_items_report_id_fkey'
  ) THEN
    ALTER TABLE "report_items"
      ADD CONSTRAINT "report_items_report_id_fkey"
      FOREIGN KEY ("report_id") REFERENCES "reports"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "report_items_report_id_idx" ON "report_items"("report_id");
