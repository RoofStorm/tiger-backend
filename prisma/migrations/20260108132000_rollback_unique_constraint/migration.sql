-- Rollback: Revert UNIQUE CONSTRAINT back to UNIQUE INDEX
-- This migration reverts the changes from 20260108131000_replace_unique_index_with_constraint

-- Step 1: Drop the UNIQUE CONSTRAINT if it exists
ALTER TABLE "analytics_aggregate"
DROP CONSTRAINT IF EXISTS "analytics_aggregate_unique";

-- Step 2: Recreate the original UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_aggregate_page_zone_action_date_hour_key" 
ON "analytics_aggregate"("page", "zone", "action", "date", "hour");

-- Note: We keep zone as empty string (not reverting to NULL) to maintain data consistency
-- If you need to revert zone back to NULL, you can run:
-- UPDATE "analytics_aggregate" SET "zone" = NULL WHERE "zone" = '';

