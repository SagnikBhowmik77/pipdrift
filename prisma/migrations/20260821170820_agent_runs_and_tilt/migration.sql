-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "trigger" TEXT NOT NULL,
    "rebalanced" BOOLEAN NOT NULL DEFAULT false,
    "eventsWritten" INTEGER NOT NULL DEFAULT 0,
    "sentimentScore" REAL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driftThresholdPct" REAL NOT NULL DEFAULT 5,
    "riskProfile" TEXT NOT NULL DEFAULT 'balanced',
    "sentimentTiltPct" REAL NOT NULL DEFAULT 0,
    "autoRebalance" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_User" ("createdAt", "driftThresholdPct", "email", "id", "name", "passwordHash", "riskProfile") SELECT "createdAt", "driftThresholdPct", "email", "id", "name", "passwordHash", "riskProfile" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_userId_createdAt_idx" ON "AgentRun"("userId", "createdAt");
