#!/usr/bin/env node
/**
 * Regenerates the Postgres migration baseline from the generated schema.
 *
 * The migrations under prisma/migrations/ were authored against SQLite and use
 * DATETIME and REAL, which Postgres rejects — applying them to a deployment
 * fails on the first table. Rather than hand-porting them, the Postgres side
 * keeps its own single baseline generated straight from the schema, so the two
 * databases can never disagree about what the models are.
 *
 * Run after any schema change:  npm run db:build-pg-migration
 */

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const OUT_DIR = "prisma/migrations-postgres/00000000000000_init";

mkdirSync(OUT_DIR, { recursive: true });

// One fixed command string: every argument is a literal, so there is nothing
// interpolated for a shell to mis-parse. execFileSync is not an option here —
// Node 25 refuses to spawn npx.cmd on Windows without a shell.
execSync(
  "npx prisma migrate diff --from-empty " +
    "--to-schema prisma/schema.postgres.prisma --script " +
    `-o ${OUT_DIR}/migration.sql`,
  { stdio: "inherit" },
);

console.log(`Wrote ${OUT_DIR}/migration.sql`);
