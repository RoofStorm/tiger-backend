-- CreateTable
CREATE TABLE IF NOT EXISTS "wish_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wish_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wish_limits_userId_weekStart_key" ON "wish_limits"("userId", "weekStart");

-- AddForeignKey
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wish_limits') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wish_limits_userId_fkey') THEN
            ALTER TABLE "wish_limits" ADD CONSTRAINT "wish_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
