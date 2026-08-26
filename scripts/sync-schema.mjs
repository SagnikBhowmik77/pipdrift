#!/usr/bin/env node
/**
 * Derives prisma/schema.postgres.prisma from prisma/schema.prisma.
 *
 * Prisma will not read the datasource provider from an environment variable, so
 * shipping to Postgres while developing on SQLite needs two schema files. Two
 * hand-maintained copies drift — someone adds a model, forgets the other file,
 * and the mismatch only surfaces at deploy time. So the Postgres file is
 * generated, never edited, and `--check` fails CI when it is stale.
 *
 *   node scripts/sync-schema.mjs           write the Postgres schema
 *   node scripts/sync-schema.mjs --check   exit 1 if it is out of date
 */

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "prisma/schema.prisma";
const TARGET = "prisma/schema.postgres.prisma";

const BANNER = `// GENERATED FILE — DO NOT EDIT.
// Produced from prisma/schema.prisma by scripts/sync-schema.mjs.
// Edit the source schema, then run: npm run db:sync-schema
`;

function derive(source) {
  if (!/provider\s*=\s*"sqlite"/.test(source)) {
    throw new Error(`${SOURCE} no longer declares the sqlite provider`);
  }

  return BANNER + source.replace(/provider(\s*)=(\s*)"sqlite"/, 'provider$1=$2"postgresql"');
}

const expected = derive(readFileSync(SOURCE, "utf8"));

if (process.argv.includes("--check")) {
  let actual = "";
  try {
    actual = readFileSync(TARGET, "utf8");
  } catch {
    // Missing counts as stale.
  }

  if (actual !== expected) {
    console.error(
      `${TARGET} is out of date with ${SOURCE}.\nRun: npm run db:sync-schema`,
    );
    process.exit(1);
  }

  console.log(`${TARGET} is in sync.`);
  process.exit(0);
}

writeFileSync(TARGET, expected);
console.log(`Wrote ${TARGET} from ${SOURCE}.`);
