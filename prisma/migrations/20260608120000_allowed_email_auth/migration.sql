-- CreateTable
CREATE TABLE "allowed_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_emails_email_key" ON "allowed_emails"("email");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password";
