-- Add missing fields to users table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Add columns if not exist
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Add unique constraint for referralCode (with error handling)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'users_referralCode_key'
        ) AND NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_referralCode_key'
        ) THEN
            ALTER TABLE "users" ADD CONSTRAINT "users_referralCode_key" UNIQUE ("referralCode");
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Constraint might already exist, ignore error
    NULL;
END $$;

-- Add foreign key for referredBy (with error handling)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referredBy_fkey') THEN
            ALTER TABLE "users" ADD CONSTRAINT "users_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Constraint might already exist, ignore error
    NULL;
END $$;

-- Add missing fields to rewards table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rewards') THEN
        ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "lifeRequired" INTEGER;
        ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "maxPerUser" INTEGER;
    END IF;
END $$;

-- Add missing field to redeem_requests table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'redeem_requests') THEN
        ALTER TABLE "redeem_requests" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
    END IF;
END $$;

