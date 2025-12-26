-- Update enum LimitType: Remove SHARE_DAILY and add SHARE_WEEKLY
-- PostgreSQL doesn't support removing enum values directly, so we need to recreate the enum

DO $$ 
BEGIN
    -- Check if LimitType enum exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitType') THEN
        -- Step 1: Add SHARE_WEEKLY to enum if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'SHARE_WEEKLY' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'LimitType')
        ) THEN
            ALTER TYPE "LimitType" ADD VALUE 'SHARE_WEEKLY';
        END IF;
        
        -- Step 2: Create new enum without SHARE_DAILY
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitType_new') THEN
            CREATE TYPE "LimitType_new" AS ENUM('REFERRAL_WEEKLY', 'POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_WEEKLY');
        END IF;
        
        -- Step 3: Update column to use new enum (convert SHARE_DAILY to SHARE_WEEKLY) if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_limits') THEN
            ALTER TABLE "user_limits" 
                ALTER COLUMN "limitType" TYPE "LimitType_new" 
                USING CASE 
                    WHEN "limitType"::text = 'REFERRAL_WEEKLY' THEN 'REFERRAL_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'POST_WEEKLY' THEN 'POST_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'WISH_WEEKLY' THEN 'WISH_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'SHARE_DAILY' THEN 'SHARE_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'SHARE_WEEKLY' THEN 'SHARE_WEEKLY'::"LimitType_new"
                    ELSE 'REFERRAL_WEEKLY'::"LimitType_new"
                END;
        END IF;
        
        -- Step 4: Drop old enum and rename new one
        DROP TYPE IF EXISTS "LimitType";
        ALTER TYPE "LimitType_new" RENAME TO "LimitType";
    ELSE
        -- If LimitType doesn't exist, create it with the correct values
        CREATE TYPE "LimitType" AS ENUM('REFERRAL_WEEKLY', 'POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_WEEKLY');
    END IF;
END $$;

