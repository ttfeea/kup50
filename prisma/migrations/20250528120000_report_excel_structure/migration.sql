-- Excel-style report structure
ALTER TABLE "reports" DROP COLUMN IF EXISTS "title";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "content";

ALTER TABLE "reports" ADD COLUMN "employee_id" TEXT;
ALTER TABLE "reports" ADD COLUMN "employee_name" TEXT;
ALTER TABLE "reports" ADD COLUMN "position" TEXT;
ALTER TABLE "reports" ADD COLUMN "department" TEXT;
ALTER TABLE "reports" ADD COLUMN "manager_name" TEXT;
ALTER TABLE "reports" ADD COLUMN "period" TEXT;
ALTER TABLE "reports" ADD COLUMN "creative_work_items" JSONB NOT NULL DEFAULT '[]';

UPDATE "reports"
SET
  "employee_id" = "user_id",
  "employee_name" = 'Unknown',
  "position" = 'Unknown',
  "manager_name" = 'Unknown',
  "period" = 'Unknown'
WHERE "employee_id" IS NULL;

ALTER TABLE "reports" ALTER COLUMN "employee_id" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "employee_name" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "manager_name" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "period" SET NOT NULL;
