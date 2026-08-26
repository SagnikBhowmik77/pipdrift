-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BucketAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "targetPct" REAL NOT NULL,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "minPct" REAL NOT NULL DEFAULT 0,
    "maxPct" REAL NOT NULL DEFAULT 100,
    CONSTRAINT "BucketAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BucketAllocation" ("balancePaise", "bucketId", "id", "targetPct", "userId") SELECT "balancePaise", "bucketId", "id", "targetPct", "userId" FROM "BucketAllocation";
DROP TABLE "BucketAllocation";
ALTER TABLE "new_BucketAllocation" RENAME TO "BucketAllocation";
CREATE INDEX "BucketAllocation_userId_idx" ON "BucketAllocation"("userId");
CREATE UNIQUE INDEX "BucketAllocation_userId_bucketId_key" ON "BucketAllocation"("userId", "bucketId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
