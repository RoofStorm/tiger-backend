-- Remove REFERRAL_WEEKLY from LimitType enum
DO $$ 
BEGIN
    -- Check if LimitType enum exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitType') THEN
        -- Step 1: Delete all user_limits records with REFERRAL_WEEKLY (no longer needed) if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_limits') THEN
            DELETE FROM "user_limits" WHERE "limitType"::text = 'REFERRAL_WEEKLY';
        END IF;
        
        -- Step 2: Recreate enum without REFERRAL_WEEKLY
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitType_new') THEN
            CREATE TYPE "LimitType_new" AS ENUM('POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_WEEKLY');
        END IF;
        
        -- Update column to use new enum if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_limits') THEN
            ALTER TABLE "user_limits" 
                ALTER COLUMN "limitType" TYPE "LimitType_new" 
                USING CASE 
                    WHEN "limitType"::text = 'POST_WEEKLY' THEN 'POST_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'WISH_WEEKLY' THEN 'WISH_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'SHARE_WEEKLY' THEN 'SHARE_WEEKLY'::"LimitType_new"
                    ELSE 'POST_WEEKLY'::"LimitType_new" -- Fallback (shouldn't happen)
                END;
        END IF;
        
        -- Drop old enum and rename new one
        DROP TYPE IF EXISTS "LimitType";
        ALTER TYPE "LimitType_new" RENAME TO "LimitType";
    ELSE
        -- If LimitType doesn't exist, create it with the correct values
        CREATE TYPE "LimitType" AS ENUM('POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_WEEKLY');
    END IF;
END $$;

