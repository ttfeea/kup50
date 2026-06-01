-- AlterTable
ALTER TABLE "integration_tokens" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "report_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reports" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_id" TEXT;
