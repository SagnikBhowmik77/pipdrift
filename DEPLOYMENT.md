# Deploying Pipdrift

Local development runs on SQLite. Anything deployed must run on Postgres: a
serverless filesystem is ephemeral, so a SQLite file there silently loses every
write on redeploy. `src/lib/db.ts` picks the driver from the `DATABASE_URL`
scheme, so the application code needs no change - but Prisma will not read the
datasource provider from an environment variable, which is why there are two
schema files.

## 1. Create a Postgres database

Any provider works. Vercel Postgres, Neon, and Supabase all hand you a
`postgres://` connection string.

## 2. Generate and migrate against the Postgres schema

`prisma/schema.postgres.prisma` is **generated** from `prisma/schema.prisma` -
do not edit it. After any schema change:

```bash
npm run db:sync-schema
```

CI fails if you forget (`npm run db:check-schema`).

The migrations under `prisma/migrations/` were authored against SQLite and use
`DATETIME` and `REAL`, which Postgres rejects - they will fail on the first
table. Postgres therefore has its own generated baseline under
`prisma/migrations-postgres/`. Regenerate it whenever the schema changes:

```bash
npm run db:build-pg-migration
```

Then apply it and generate the client:

```bash
DATABASE_URL="postgres://..." npm run db:generate:postgres
DATABASE_URL="postgres://..." npx prisma migrate deploy --schema prisma/schema.postgres.prisma
```

## 3. Point the build at the Postgres schema

Vercel runs `postinstall`, which today generates the SQLite client. Override the
build command in your project settings:

```
prisma generate --schema prisma/schema.postgres.prisma && next build
```

## 4. Environment variables

Set these in the hosting dashboard. Everything is listed in `.env.example`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | the `postgres://` string |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` - a new one invalidates all sessions |
| `APP_URL` | yes | public origin; reset links point at localhost without it |
| `CRON_SECRET` | yes | bearer token the scheduler sends |
| `INGEST_SECRET` | yes | HMAC key for `/api/transactions/ingest` |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | no | sentiment engine; falls back to the built-in lexicon |
| `RESEND_API_KEY` or `MAIL_WEBHOOK_URL` | no | without one, reset links only reach the server log |
| `ERROR_WEBHOOK_URL` | no | without it, failures print as JSON and go nowhere |

Generate the secrets separately - never reuse the development values.

## 5. Schedule the agent

The tick is an authenticated POST. On Vercel, add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/rebalance", "schedule": "0 * * * *" }] }
```

Vercel's cron cannot send an `Authorization` header, so either accept Vercel's
own `x-vercel-cron` header in the route or call the endpoint from an external
scheduler that can set the bearer token. Do not remove the check - an
unauthenticated tick endpoint lets anyone force rebalances.

Self-hosting instead? `npm run agent:watch` runs the same tick in a loop.

## Before you point real users at this

Pipdrift places no orders - `getBroker()` returns a simulated broker and every
receipt reads `simulated`. The dashboard says so on every page. Do not remove
that disclosure while it remains true.

Taking deposits and allocating them in India is SEBI-registered activity
(investment adviser or distributor). Deploying a simulation is fine; accepting
other people's money is not a code change.
