#!/usr/bin/env node
/**
 * Local agent worker.
 *
 * Calls the scheduled-tick endpoint on an interval so the fleet actually runs
 * unattended during development. In production you would point a hosted cron
 * (Vercel Cron, GitHub Actions, systemd timer) at the same endpoint instead —
 * this exists so "24/7" is demonstrable on a laptop.
 *
 *   npm run agent:watch                 # every 5 minutes
 *   npm run agent:watch -- --every 30s  # custom interval
 *   npm run agent:once                  # single pass, then exit
 */

import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // No .env is fine if the variables are already exported.
  }
}

function parseInterval(value) {
  const match = String(value).match(/^(\d+)(s|m|h)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2] ?? "m";
  return n * (unit === "s" ? 1000 : unit === "h" ? 3_600_000 : 60_000);
}

loadEnv();

const args = process.argv.slice(2);
const once = args.includes("--once");
const everyArg = args[args.indexOf("--every") + 1];
const intervalMs =
  (args.includes("--every") ? parseInterval(everyArg) : null) ?? 5 * 60_000;

const baseUrl = process.env.PIPDRIFT_URL ?? "http://localhost:3100";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is not set — refusing to start.");
  process.exit(1);
}

let ticks = 0;

async function tick() {
  const startedAt = new Date();
  try {
    const res = await fetch(`${baseUrl}/api/cron/rebalance`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json();

    if (!res.ok || !body.ok) {
      console.error(`[${startedAt.toISOString()}] tick failed:`, body.error ?? res.status);
      return;
    }

    ticks += 1;
    console.log(
      `[${startedAt.toISOString()}] tick #${ticks} — ` +
        `${body.usersConsidered} user(s), ${body.usersRebalanced} rebalanced, ` +
        `${body.eventsWritten} event(s), ${body.failures} failure(s), ${body.durationMs}ms`,
    );
  } catch (error) {
    console.error(`[${startedAt.toISOString()}] could not reach ${baseUrl}:`, error.message);
  }
}

await tick();

if (!once) {
  console.log(`Agent worker running every ${Math.round(intervalMs / 1000)}s. Ctrl-C to stop.`);
  setInterval(tick, intervalMs);
}
