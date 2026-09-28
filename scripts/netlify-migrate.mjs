#!/usr/bin/env node
/**
 * Applies migrations to the deployed Postgres during a Netlify build.
 *
 * Two mismatches make this necessary rather than a plain `prisma migrate
 * deploy` in the build command:
 *
 *   1. Netlify injects NETLIFY_DATABASE_URL when it provisions its managed
 *      Postgres, but prisma.config.ts reads DATABASE_URL. This maps one to the
 *      other for the migrate call only.
 *   2. The migrations under prisma/migrations were authored against SQLite and
 *      use DATETIME and REAL, which Postgres rejects. The Postgres baseline
 *      lives in prisma/migrations-postgres, so that is what gets applied.
 *
 * A build with no database configured is not an error: the site still builds,
 * and the first request then fails with a connection error, which is much
 * easier to diagnose than a build halting for a reason unrelated to the code.
 */

import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

if (!url) {
  console.log("[migrate] no DATABASE_URL or NETLIFY_DATABASE_URL, skipping");
  process.exit(0);
}

if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.log("[migrate] connection string is not Postgres, skipping");
  process.exit(0);
}

// Never print the URL itself; the host is enough to confirm the right target.
let host = "unknown";
try {
  host = new URL(url).host;
} catch {
  // A malformed URL is Prisma's problem to report, not this script's.
}

console.log(`[migrate] applying prisma/migrations-postgres to ${host}`);

try {
  execSync(
    "npx prisma migrate deploy " +
      "--schema prisma/schema.postgres.prisma " +
      "--migrations-path prisma/migrations-postgres",
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
  );
  console.log("[migrate] done");
} catch {
  console.error("[migrate] migration failed; see the Prisma output above");
  process.exit(1);
}
