-- Replace UNIQUE INDEX with UNIQUE CONSTRAINT (best practice for aggregate/fact tables)
-- This provides better semantics and clearer intent for data integrity

-- Step 1: Normalize NULL zone values to empty string for consistency
-- PostgreSQL unique constraint treats NULL differently, so we normalize to empty string
-- This ensures consistent behavior with the constraint
UPDATE "analytics_aggregate" 
SET "zone" = '' 
WHERE "zone" IS NULL;

-- Step 2: Drop the existing UNIQUE INDEX if it exists
DROP INDEX IF EXISTS "analytics_aggregate_page_zone_action_date_hour_key";

-- Step 3: Add UNIQUE CONSTRAINT with explicit name (best practice)
-- Since we normalized NULL to empty string above, the constraint will work correctly
-- Empty string is treated as a distinct value in unique constraints
ALTER TABLE "analytics_aggregate"
ADD CONSTRAINT "analytics_aggregate_unique"
UNIQUE (page, zone, action, date, hour);

