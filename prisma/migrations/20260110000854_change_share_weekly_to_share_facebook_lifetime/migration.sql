-- Change SHARE_WEEKLY to SHARE_FACEBOOK and convert to lifetime limit
DO $$ 
BEGIN
    -- Check if LimitType enum exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitType') THEN
        -- Step 1: Update all user_limits records with SHARE_WEEKLY to SHARE_FACEBOOK
        -- and set period to fixed date (1970-01-01) for lifetime limit
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_limits') THEN
            -- Update period to fixed date for all SHARE_WEEKLY records to make them lifetime
            UPDATE "user_limits" 
            SET "period" = '1970-01-01T00:00:00.000Z'::timestamp
            WHERE "limitType"::text = 'SHARE_WEEKLY';
        END IF;
        
        -- Step 2: Recreate enum with SHARE_FACEBOOK instead of SHARE_WEEKLY
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitType_new') THEN
            CREATE TYPE "LimitType_new" AS ENUM('POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_FACEBOOK', 'PRODUCT_CARD_CLICK');
        END IF;
        
        -- Step 3: Update column to use new enum if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_limits') THEN
            ALTER TABLE "user_limits" 
                ALTER COLUMN "limitType" TYPE "LimitType_new" 
                USING CASE 
                    WHEN "limitType"::text = 'POST_WEEKLY' THEN 'POST_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'WISH_WEEKLY' THEN 'WISH_WEEKLY'::"LimitType_new"
                    WHEN "limitType"::text = 'SHARE_WEEKLY' THEN 'SHARE_FACEBOOK'::"LimitType_new"
                    WHEN "limitType"::text = 'PRODUCT_CARD_CLICK' THEN 'PRODUCT_CARD_CLICK'::"LimitType_new"
                    ELSE 'POST_WEEKLY'::"LimitType_new" -- Fallback (shouldn't happen)
                END;
        END IF;
        
        -- Step 4: Drop old enum and rename new one
        DROP TYPE IF EXISTS "LimitType";
        ALTER TYPE "LimitType_new" RENAME TO "LimitType";
    ELSE
        -- If LimitType doesn't exist, create it with the correct values
        CREATE TYPE "LimitType" AS ENUM('POST_WEEKLY', 'WISH_WEEKLY', 'SHARE_FACEBOOK', 'PRODUCT_CARD_CLICK');
    END IF;
END $$;

