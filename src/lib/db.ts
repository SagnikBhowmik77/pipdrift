import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single client across dev hot-reloads - without the global, every reload leaks
 * another connection pool until the database starts refusing them.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const DEFAULT_URL = "file:./dev.db";

/**
 * Picks the driver from the connection string rather than the build.
 *
 * Local development runs on a SQLite file; anything deployed runs on Postgres,
 * because a serverless filesystem is ephemeral and a SQLite file there quietly
 * loses every write on redeploy. Reading the scheme means the same image works
 * in both places and nobody has to remember to flip a flag before shipping.
 *
 * Note the schema's `datasource` block still names one provider, so switching
 * to Postgres also means generating against `prisma/schema.postgres.prisma` -
 * see DEPLOYMENT.md. This function is what makes the runtime side automatic.
 */
function isPostgres(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

/**
 * Connection string, in order of preference.
 *
 * Netlify provisions its managed Postgres and injects NETLIFY_DATABASE_URL
 * rather than DATABASE_URL, so a deployment that only read DATABASE_URL would
 * fall through to the SQLite default and fail on the first query. DATABASE_URL
 * still wins when set, so a self-hosted deployment or a local override behaves
 * exactly as it did before.
 */
export function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL ?? DEFAULT_URL
  );
}

function createClient(): PrismaClient {
  const url = resolveDatabaseUrl();

  if (isPostgres(url)) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }

  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

/**
 * Constructed on first use, not on import.
 *
 * Building this at module scope meant that merely importing the module opened a
 * client, so `next build` failed while collecting page data for routes that
 * only touch the database at request time. A build should not need a reachable
 * database, and a misconfigured connection string should surface on the first
 * query rather than as an import-time crash with no route attached to it.
 */
function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const created = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = created;
  return created;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const value = Reflect.get(getClient(), property, receiver) as unknown;
    // Methods such as $transaction must stay bound to the real client.
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
