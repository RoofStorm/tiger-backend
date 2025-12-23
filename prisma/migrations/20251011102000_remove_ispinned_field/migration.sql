-- DropIndex
DROP INDEX IF EXISTS "posts_isPinned_idx";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "isPinned";
