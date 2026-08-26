import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Creates a throwaway SQLite database for the integration tests.
 *
 * The unit tests cover pure functions; these cover the code that actually
 * writes - the rebalance tick, the ledger, the reset-token lifecycle, the rate
 * limiter. That code is the riskiest in the project and was the least tested,
 * because testing it needs a real database.
 *
 * The schema is built by replaying prisma/migrations in order rather than by
 * running `prisma db push`. Two reasons: db push is a destructive command that
 * takes a database URL and is a genuinely bad thing to have wired into a test
 * harness, and replaying the real migrations additionally proves they produce a
 * working schema - which nothing else here checks.
 *
 * A fresh temp file per run means a test can truncate freely and can never
 * reach dev.db.
 */

const MIGRATIONS_DIR = "prisma/migrations";

let dir: string | undefined;

function applyMigrations(dbPath: string): number {
  const database = new DatabaseSync(dbPath);
  let applied = 0;

  try {
    const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const folder of folders) {
      const sql = readFileSync(
        path.join(MIGRATIONS_DIR, folder, "migration.sql"),
        "utf8",
      );
      database.exec(sql);
      applied += 1;
    }
  } finally {
    database.close();
  }

  if (applied === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  return applied;
}

export async function setup() {
  dir = mkdtempSync(path.join(tmpdir(), "pipdrift-test-"));
  const dbPath = path.join(dir, "test.db");

  applyMigrations(dbPath);

  // Forward slashes: a file: URL never uses Windows separators.
  const url = `file:${dbPath.split(path.sep).join("/")}`;
  process.env.DATABASE_URL = url;
}

export async function teardown() {
  if (!dir) return;

  // Windows refuses to unlink a file another handle still holds, and the Prisma
  // client in the worker may not have released the database yet. A leftover
  // temp directory is harmless - the OS reclaims it - so a failure here must
  // not fail an otherwise green run.
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Intentionally ignored.
  }
}
