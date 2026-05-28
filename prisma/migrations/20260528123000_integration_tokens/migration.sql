ALTER TYPE "ReportItemSource" ADD VALUE IF NOT EXISTS 'GITHUB';

CREATE TABLE IF NOT EXISTS "integration_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "ReportItemSource" NOT NULL,
  "token" TEXT NOT NULL,
  "base_url" TEXT,
  "account_email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "integration_tokens_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'integration_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "integration_tokens"
      ADD CONSTRAINT "integration_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "integration_tokens_user_id_idx" ON "integration_tokens"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_tokens_user_id_provider_key"
  ON "integration_tokens"("user_id", "provider");
