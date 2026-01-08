-- AlterTable: Add uniqueUsers and uniqueAnonymousUsers to analytics_aggregate
ALTER TABLE "analytics_aggregate" 
ADD COLUMN IF NOT EXISTS "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "uniqueAnonymousUsers" INTEGER NOT NULL DEFAULT 0;
