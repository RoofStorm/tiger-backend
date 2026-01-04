-- DropIndex
DROP INDEX IF EXISTS "posts_isPinned_idx";

-- AlterTable
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'isPinned'
    ) THEN
        ALTER TABLE "posts" DROP COLUMN "isPinned";
    END IF;
END $$;
