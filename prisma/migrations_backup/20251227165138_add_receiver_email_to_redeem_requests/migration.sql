-- Add receiverEmail column with error handling
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'redeem_requests') THEN
        -- Add column if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'redeem_requests' AND column_name = 'receiver_email'
        ) THEN
            ALTER TABLE "redeem_requests" ADD COLUMN "receiver_email" TEXT NOT NULL DEFAULT '';
        END IF;
    END IF;
END $$;

-- Make receiverName optional
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'redeem_requests') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'redeem_requests' AND column_name = 'receiver_name' AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE "redeem_requests" ALTER COLUMN "receiver_name" DROP NOT NULL;
        END IF;
    END IF;
END $$;

-- Make receiverAddress optional
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'redeem_requests') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'redeem_requests' AND column_name = 'receiver_address' AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE "redeem_requests" ALTER COLUMN "receiver_address" DROP NOT NULL;
        END IF;
    END IF;
END $$;

-- Update existing records: Set receiverEmail to empty string if null (for existing data)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'redeem_requests') THEN
        UPDATE "redeem_requests" SET "receiver_email" = '' WHERE "receiver_email" IS NULL;
    END IF;
END $$;

-- Remove default after updating existing records
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'redeem_requests') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'redeem_requests' 
            AND column_name = 'receiver_email' 
            AND column_default IS NOT NULL
        ) THEN
            ALTER TABLE "redeem_requests" ALTER COLUMN "receiver_email" DROP DEFAULT;
        END IF;
    END IF;
END $$;

