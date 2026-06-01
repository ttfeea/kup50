-- AlterTable
ALTER TABLE "integration_tokens"
ADD COLUMN "connection_status" TEXT NOT NULL DEFAULT 'missing',
ADD COLUMN "connection_message" TEXT,
ADD COLUMN "connection_checked_at" TIMESTAMP(3);
