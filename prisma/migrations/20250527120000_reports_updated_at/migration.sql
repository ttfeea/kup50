-- Add updated_at and align ReportStatus enum with DRAFT / SUBMITTED
ALTER TABLE "reports" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TYPE "ReportStatus" RENAME VALUE 'draft' TO 'DRAFT';
ALTER TYPE "ReportStatus" RENAME VALUE 'submitted' TO 'SUBMITTED';

ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
