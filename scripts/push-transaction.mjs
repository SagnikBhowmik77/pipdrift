#!/usr/bin/env node
/**
 * Simulates a card provider pushing a purchase to the ingestion webhook.
 * Speaks the same protocol a real provider would, so this is how you test the
 * automatic round-up path before any bank integration exists.
 *
 *   npm run tx:push -- --email you@example.com --merchant "Chai Point" --amount 128.40
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* variables may already be exported */
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

loadEnv();

const secret = process.env.INGEST_SECRET;
if (!secret) {
  console.error("INGEST_SECRET is not set — refusing to send.");
  process.exit(1);
}

const baseUrl = process.env.PIPDRIFT_URL ?? "http://localhost:3100";
const amountRupees = Number(arg("amount", "128.40"));

const payload = {
  externalId: arg("id", `sim-${Date.now()}`),
  userEmail: arg("email", ""),
  merchant: arg("merchant", "Simulated Merchant"),
  category: arg("category", "Other"),
  amountPaise: Math.round(amountRupees * 100),
  bucketId: arg("bucket", undefined),
};

const body = JSON.stringify(payload);
const signature = createHmac("sha256", secret).update(body).digest("hex");

const res = await fetch(`${baseUrl}/api/transactions/ingest`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-pipdrift-signature": `sha256=${signature}`,
  },
  body,
});

const result = await res.json();
console.log(res.status, JSON.stringify(result, null, 2));
process.exit(res.ok && result.ok ? 0 : 1);
