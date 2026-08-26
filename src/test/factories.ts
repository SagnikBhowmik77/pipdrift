import { BUCKETS } from "@/lib/buckets";
import { prisma } from "@/lib/db";

/**
 * Seeding helpers for the integration tests. Every test creates its own user
 * so the suite has no shared mutable state and cases cannot leak into each
 * other through the database.
 */

let counter = 0;

export type SeedOptions = {
  targets?: Record<string, number>;
  balancesPaise?: Record<string, number>;
  driftThresholdPct?: number;
  sentimentTiltPct?: number;
  caps?: Record<string, { minPct: number; maxPct: number }>;
};

export async function seedUser(options: SeedOptions = {}) {
  counter += 1;

  const user = await prisma.user.create({
    data: {
      email: `test-${counter}-${Date.now()}@example.test`,
      passwordHash: "not-a-real-hash",
      driftThresholdPct: options.driftThresholdPct ?? 5,
      sentimentTiltPct: options.sentimentTiltPct ?? 0,
    },
  });

  const targets = options.targets ?? { equities: 50, bonds: 30, emerging: 20 };

  await prisma.bucketAllocation.createMany({
    data: BUCKETS.map((bucket) => ({
      userId: user.id,
      bucketId: bucket.id,
      targetPct: targets[bucket.id] ?? 0,
      balancePaise: options.balancesPaise?.[bucket.id] ?? 0,
      minPct: options.caps?.[bucket.id]?.minPct ?? 0,
      maxPct: options.caps?.[bucket.id]?.maxPct ?? 100,
    })),
  });

  return user;
}

export async function balancesOf(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.bucketAllocation.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [r.bucketId, r.balancePaise]));
}
