-- Add missing fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;

-- Add unique constraint for referralCode (ignore error if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referralCode_key') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_referralCode_key" UNIQUE ("referralCode");
    END IF;
END $$;

-- Add foreign key for referredBy (ignore error if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referredBy_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add missing fields to rewards table
ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "lifeRequired" INTEGER;
ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "maxPerUser" INTEGER;

-- Add missing field to redeem_requests table
ALTER TABLE "redeem_requests" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

