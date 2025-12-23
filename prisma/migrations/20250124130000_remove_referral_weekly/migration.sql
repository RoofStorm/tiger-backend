-- Remove REFERRAL_WEEKLY from LimitType enum
-- Step 1: Delete all user_limits records with REFERRAL_WEEKLY (no longer needed)
DELETE FROM "user_limits" WHERE "limitType"::text = 'REFERRAL_WEEKLY';

-- Step 2: Recreate enum without REFERRAL_WEEKLY
DO $$ 
BEGIN
    -- Create new enum without REFERRAL_WEEKLY
    CREATE TYPE "LimitType_new" AS ENUM('POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_WEEKLY');
    
    -- Update column to use new enum
    ALTER TABLE "user_limits" 
        ALTER COLUMN "limitType" TYPE "LimitType_new" 
        USING CASE 
            WHEN "limitType"::text = 'POST_WEEKLY' THEN 'POST_WEEKLY'::"LimitType_new"
            WHEN "limitType"::text = 'WISH_WEEKLY' THEN 'WISH_WEEKLY'::"LimitType_new"
            WHEN "limitType"::text = 'SHARE_WEEKLY' THEN 'SHARE_WEEKLY'::"LimitType_new"
            ELSE 'POST_WEEKLY'::"LimitType_new" -- Fallback (shouldn't happen)
        END;
    
    -- Drop old enum and rename new one
    DROP TYPE "LimitType";
    ALTER TYPE "LimitType_new" RENAME TO "LimitType";
END $$;

