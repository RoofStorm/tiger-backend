-- CreateTable: analytics_events
CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "page" TEXT NOT NULL,
    "zone" TEXT,
    "component" TEXT,
    "action" TEXT NOT NULL,
    "value" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: analytics_aggregate
CREATE TABLE IF NOT EXISTS "analytics_aggregate" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "zone" TEXT,
    "action" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL DEFAULT -1,
    "totalEvents" INTEGER NOT NULL DEFAULT 0,
    "totalValue" INTEGER,
    "avgValue" DOUBLE PRECISION,
    "uniqueSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_aggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: analytics_events
CREATE INDEX IF NOT EXISTS "analytics_events_page_zone_action_idx" ON "analytics_events"("page", "zone", "action");
CREATE INDEX IF NOT EXISTS "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");
CREATE INDEX IF NOT EXISTS "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex: analytics_aggregate
CREATE INDEX IF NOT EXISTS "analytics_aggregate_page_zone_date_idx" ON "analytics_aggregate"("page", "zone", "date");
CREATE INDEX IF NOT EXISTS "analytics_aggregate_date_idx" ON "analytics_aggregate"("date");

-- CreateUniqueConstraint: analytics_aggregate
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_aggregate') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'analytics_aggregate_page_zone_action_date_hour_key'
        ) THEN
            ALTER TABLE "analytics_aggregate" ADD CONSTRAINT "analytics_aggregate_page_zone_action_date_hour_key" 
            UNIQUE ("page", "zone", "action", "date", "hour");
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- AddForeignKey: analytics_events -> users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_userId_fkey') THEN
            ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Drop old corner_analytics table if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'corner_analytics') THEN
        -- Drop foreign key first
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corner_analytics_userId_fkey') THEN
            ALTER TABLE "corner_analytics" DROP CONSTRAINT IF EXISTS "corner_analytics_userId_fkey";
        END IF;
        -- Drop table
        DROP TABLE IF EXISTS "corner_analytics";
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

