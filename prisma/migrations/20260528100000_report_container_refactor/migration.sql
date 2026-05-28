-- Keep reports as reporting containers only. Employee profile data lives on users,
-- and Jira/GitLab data lives in report_items.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fullname" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerName" TEXT;

ALTER TABLE "reports" DROP COLUMN IF EXISTS "title";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "content";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "employee_id";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "employee_name";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "position";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "department";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "manager_name";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "period";
ALTER TABLE "reports" DROP COLUMN IF EXISTS "creative_work_items";
