-- CreateEnum for LimitType
DO $$ BEGIN
 CREATE TYPE "LimitType" AS ENUM('REFERRAL_WEEKLY', 'POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_DAILY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "limitType" "LimitType" NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_limits_userId_limitType_period_key" ON "user_limits"("userId", "limitType", "period");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_limits_userId_fkey') THEN
        ALTER TABLE "user_limits" ADD CONSTRAINT "user_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

