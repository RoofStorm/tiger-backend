-- Replace UNIQUE INDEX with UNIQUE CONSTRAINT (best practice for aggregate/fact tables)
-- This provides better semantics and clearer intent for data integrity

-- Step 1: Normalize NULL zone values to empty string for consistency
-- PostgreSQL unique constraint treats NULL differently, so we normalize to empty string
-- This ensures consistent behavior with the constraint
UPDATE "analytics_aggregate" 
SET "zone" = '' 
WHERE "zone" IS NULL;

-- Step 2: Handle duplicate data after normalization
-- Merge duplicates by aggregating values and keeping only one record per unique key
DO $$
BEGIN
    -- Merge duplicates: Update the first record with aggregated values, then delete others
    WITH duplicates AS (
        SELECT 
            page, 
            COALESCE(zone, '') as zone_normalized,
            action, 
            date, 
            hour,
            MIN(id) as keep_id,
            SUM("totalEvents") as total_events,
            SUM("totalValue") as total_value,
            CASE 
                WHEN SUM("totalEvents") > 0 THEN SUM("totalValue")::FLOAT / SUM("totalEvents")
                ELSE NULL
            END as avg_value,
            SUM("uniqueSessions") as unique_sessions,
            SUM("uniqueUsers") as unique_users,
            SUM("uniqueAnonymousUsers") as unique_anonymous_users,
            MIN("createdAt") as created_at,
            MAX("updatedAt") as updated_at
        FROM "analytics_aggregate"
        GROUP BY page, COALESCE(zone, ''), action, date, hour
        HAVING COUNT(*) > 1
    )
    UPDATE "analytics_aggregate" aa
    SET 
        "totalEvents" = d.total_events,
        "totalValue" = d.total_value,
        "avgValue" = d.avg_value,
        "uniqueSessions" = d.unique_sessions,
        "uniqueUsers" = d.unique_users,
        "uniqueAnonymousUsers" = d.unique_anonymous_users,
        "createdAt" = d.created_at,
        "updatedAt" = d.updated_at
    FROM duplicates d
    WHERE aa.id = d.keep_id
        AND aa.page = d.page
        AND COALESCE(aa.zone, '') = d.zone_normalized
        AND aa.action = d.action
        AND aa.date = d.date
        AND aa.hour = d.hour;
    
    -- Delete duplicate records (keep only the first one per unique key)
    DELETE FROM "analytics_aggregate"
    WHERE id NOT IN (
        SELECT MIN(id)
        FROM "analytics_aggregate"
        GROUP BY page, COALESCE(zone, ''), action, date, hour
    );
END $$;

-- Step 3: Drop the existing UNIQUE INDEX if it exists
DROP INDEX IF EXISTS "analytics_aggregate_page_zone_action_date_hour_key";

-- Step 4: Drop the constraint if it already exists (in case of retry)
ALTER TABLE "analytics_aggregate"
DROP CONSTRAINT IF EXISTS "analytics_aggregate_unique";

-- Step 5: Add UNIQUE CONSTRAINT with explicit name (best practice)
-- Since we normalized NULL to empty string above, the constraint will work correctly
-- Empty string is treated as a distinct value in unique constraints
ALTER TABLE "analytics_aggregate"
ADD CONSTRAINT "analytics_aggregate_unique"
UNIQUE (page, zone, action, date, hour);

