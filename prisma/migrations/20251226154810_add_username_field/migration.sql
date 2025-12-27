-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username") WHERE "username" IS NOT NULL;

