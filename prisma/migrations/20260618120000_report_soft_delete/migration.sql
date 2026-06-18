ALTER TABLE "reports" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "reports_user_id_deleted_at_idx" ON "reports"("user_id", "deleted_at");
