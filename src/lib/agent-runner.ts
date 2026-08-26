import "server-only";
import { reportError } from "./observability";

import { prisma } from "./db";
import { runRebalanceTick } from "./rebalance";

/**
 * The unattended half of the fleet.
 *
 * `runRebalanceTick` handles one user on demand. This runs the whole book on a
 * schedule and records every pass - including passes that changed nothing - so
 * "the agents are working around the clock" is something you can point at in
 * the database rather than something the marketing page asserts.
 */

export type AgentRunSummary = {
  usersConsidered: number;
  usersRebalanced: number;
  eventsWritten: number;
  failures: number;
  startedAt: string;
  durationMs: number;
};

export async function runScheduledTicks(
  trigger: "scheduled" | "manual" = "scheduled",
): Promise<AgentRunSummary> {
  const startedAt = new Date();

  const users = await prisma.user.findMany({
    where: { autoRebalance: true },
    select: { id: true },
  });

  let usersRebalanced = 0;
  let eventsWritten = 0;
  let failures = 0;

  // Sequential on purpose: SQLite serialises writes anyway, and one user's
  // failure must not abort the rest of the book.
  for (const user of users) {
    try {
      const result = await runRebalanceTick(user.id);

      if (result.rebalanced) {
        usersRebalanced += 1;
        eventsWritten += result.events.length;
      }

      await prisma.agentRun.create({
        data: {
          userId: user.id,
          trigger,
          rebalanced: result.rebalanced,
          eventsWritten: result.events.length,
          sentimentScore: result.sentiment.score,
          summary: result.reason,
        },
      });
    } catch (error) {
      failures += 1;
      console.error(`[agent-runner] tick failed for ${user.id}`, error);
      void reportError("agent-runner.tick", error, { userId: user.id });

      await prisma.agentRun
        .create({
          data: {
            userId: user.id,
            trigger,
            rebalanced: false,
            eventsWritten: 0,
            summary: "Tick failed - see server logs.",
          },
        })
        .catch(() => {
          /* the run log must never be the thing that breaks the run */
        });
    }
  }

  return {
    usersConsidered: users.length,
    usersRebalanced,
    eventsWritten,
    failures,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
  };
}

export async function getLastAgentRun(userId: string) {
  return prisma.agentRun.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecentAgentRuns(userId: string, take = 10) {
  return prisma.agentRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
