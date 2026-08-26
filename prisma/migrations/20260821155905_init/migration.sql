-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driftThresholdPct" REAL NOT NULL DEFAULT 5,
    "riskProfile" TEXT NOT NULL DEFAULT 'balanced'
);

-- CreateTable
CREATE TABLE "BucketAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "targetPct" REAL NOT NULL,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BucketAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "roundUpPaise" INTEGER NOT NULL,
    "bucketId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RebalanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "beforePct" REAL NOT NULL,
    "afterPct" REAL NOT NULL,
    "signal" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RebalanceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BucketAllocation_userId_idx" ON "BucketAllocation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BucketAllocation_userId_bucketId_key" ON "BucketAllocation"("userId", "bucketId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RebalanceEvent_userId_createdAt_idx" ON "RebalanceEvent"("userId", "createdAt");
