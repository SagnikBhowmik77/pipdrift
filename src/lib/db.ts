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

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL;

  if (isPostgres(url)) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }

  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
