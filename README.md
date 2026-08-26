# Pipdrift

**An open rebalancing engine for spare-change investing. Read it, fork it, run
it yourself.**

Pipdrift rounds purchases up to the next rupee, routes the difference into ETF
buckets, and rebalances them when they drift - reading market headlines through
a model to tilt targets within limits you set. Every part of that is a small
TypeScript module you can open, change, and register in one line.

Robo-advisors rebalance on thresholds they will not publish, and ask you to hand
over the money first. This is the same machinery, shipped as source.

### What this is, plainly

- **It is** a complete, tested rebalancing engine you run on your own machine.
- **It is not** a broker. `getBroker()` returns a simulated broker, `isLive` is
  `false`, and every order receipt reads `simulated`. Nothing is bought or sold.
- **It is not** licensed to manage your money. Allocating other people's funds in
  India is SEBI-registered activity; running a simulation is not.
- **It is not** investment advice, and no returns are implied or guaranteed.

Connecting a real broker means implementing one interface - and holding the
registration that legally permits it.

**New here? Follow [SETUP.md](SETUP.md)** - it walks through turning on a
free sentiment model, keeping the agents running, and testing round-ups.
Deploying? See [DEPLOYMENT.md](DEPLOYMENT.md).

## Run it

```bash
npm install
cp .env.example .env   # then set AUTH_SECRET
npx prisma migrate dev
npm run dev
```

Serves on port 3100. Create an account at `/signup` - three ETF buckets are
provisioned with a Balanced mix you can change any time.

## Routes

| Route | What it does |
|---|---|
| `/` | Landing page: round-ups, agent rebalancing, forkable engine |
| `/signup`, `/login` | Email + password auth (argon2id, JWT sessions) |
| `/sandbox` | Portfolio: per-bucket balances, total spare change, allocation pie |
| `/sandbox/new` | Log a purchase; rounds up to the next rupee and credits a bucket |
| `/sandbox/buckets` | Target mix and drift threshold, set by hand |
| `/sandbox/profile` | Conservative / Balanced / Growth presets |
| `/sandbox/buckets/exposure` | Per-ETF min/max exposure caps |
| `/sandbox/signals` | Latest 5 market headlines, sentiment-tagged |
| `/sandbox/history` | Rebalance audit trail, plus a manual tick button |
| `/pricing` | Personal (free) and Managed (0.20% above threshold) tiers |
| `/faq` | Security, lock-up, fees, taxes, and the Acorns comparison |
| `/blog/open-agent-pipeline` | Why open pipelines beat black-box robo-advisors |
| `/docs/agents` | How to plug in a custom signal source, sentiment source, or bucket |
| `POST /api/rebalance` | One agent tick for the signed-in user |
| `GET|POST /api/cron/rebalance` | Scheduled tick for **all** users (Bearer `CRON_SECRET`) |
| `POST /api/transactions/ingest` | Card-provider webhook, HMAC-signed (`INGEST_SECRET`) |
| `GET /api/rebalance` | Dry run: reports drift without moving anything |

Everything under `/sandbox` requires a session; the API returns 401 rather than
redirecting.

## Conventions

- **Money is integer paise** (`src/lib/currency.ts`). Never introduce float
  rupees. Rebalancing splits totals with largest-remainder allocation, so bucket
  balances always sum back to the exact total.
- **Server actions live in `actions.ts` files** and may only export async
  functions. Shared types and constants go in a sibling plain module.
- **Client forms that seed state from server props take a `key`** derived from
  those props, so a server action's new values actually reach the inputs.
- Marketing pages (`/pricing`, `/faq`) read fees and thresholds from
  `src/lib/pricing.ts` so the two can never contradict each other.
- Chart colors come from `src/lib/chart-palette.ts` and were validated for
  contrast and colorblind separation against the dark surface. Re-run the
  validator before changing a hex.
- SVG geometry is rounded before render - raw `Math.cos`/`Math.sin` output
  differs between Node and the browser and trips React hydration.

## Running the agents unattended

The fleet only works around the clock if something calls it on a clock.

```bash
npm run agent:watch              # every 5 minutes against the local server
npm run agent:watch -- --every 30s
npm run agent:once               # single pass
```

In production point a hosted cron at the same endpoint:

```bash
curl -X POST https://your-host/api/cron/rebalance -H "Authorization: Bearer $CRON_SECRET"
```

Every pass writes an `AgentRun` row - including passes that changed nothing -
so unattended operation is observable rather than assumed. Users can opt out
with the "run unattended" toggle on `/sandbox/profile`.

## Automatic round-ups

`POST /api/transactions/ingest` accepts a card-provider webhook signed with
HMAC-SHA256 over the raw body (`x-pipdrift-signature: sha256=<hex>`). There is
no bank connection yet - this is the seam a provider plugs into. Simulate one:

```bash
npm run tx:push -- --email you@example.com --merchant "Chai Point" --amount 128.40
```

## Extending the agents

Two extension points, both registered in `src/lib/agents/registry.ts`:

- **`SignalSource`** - fetches raw observations (headlines, indicators, alerts).
  Worked example: `src/lib/agents/rss-source.ts`.
- **`SentimentSource`** - receives the tick payload the rebalance agent
  assembled and returns a score plus explanatory tags. Worked example:
  `src/lib/agents/headline-sentiment-source.ts`.

`runRebalanceTick` builds the payload, calls `readSentiment`, and returns the
reading on every `POST /api/rebalance`. Sentiment does **not** move money - a
source you add cannot silently reallocate a portfolio. Two things trigger a
rebalance: drift past the threshold, or a bucket outside its exposure cap.

**Sentiment authority.** Sentiment can move money, but only within limits the
user sets: `sentimentTiltPct` (0 by default, max 15) bounds how far targets may
tilt, the tilt is always clamped to the exposure caps, and the result always
sums to 100. At 0 - the default - news is logged and changes nothing.

See `/docs/agents` for the full walkthrough.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database |
| `AUTH_SECRET` | - | **Required.** Signs session JWTs |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | unset | Any OpenAI-compatible sentiment model (Gemini, Groq, Ollama…) |
| `ANTHROPIC_API_KEY` | unset | Alternative: use Claude directly |
| `CRON_SECRET` | unset | Bearer token for the scheduled tick endpoint |
| `INGEST_SECRET` | unset | HMAC secret for the transaction webhook |
| `PIPDRIFT_RSS_URL` | ET Markets feed | Headline source for `/sandbox/signals` |
| `PIPDRIFT_RSS_SOURCE` | `ET Markets` | Display name for the feed |

## Tests

```bash
npm test          # 115 tests
npm run test:watch
```

Unit tests cover the pure maths - the sentiment tilt, largest-remainder
allocation, round-up parsing, feed interleaving, the broker seam. Integration
tests run against a throwaway SQLite database built by replaying the real
migrations, covering the rebalance tick, the ledger, the reset-token lifecycle,
and rate limiting.

Writing them caught a live bug: `applySentimentTilt` rounded each bucket
independently and could return targets summing to 100.01, breaking the invariant
its own docstring promised. CI (`.github/workflows/ci.yml`) runs the schema
drift check, typecheck, lint, tests, and build.

## Known limitations

- **No trades are executed.** The rebalancer moves numbers in a ledger. Wiring a
  real broker is a separate, licensed concern.
- **No bank or card feed.** `/api/transactions/ingest` is HMAC-signed and works,
  but nothing feeds it. Real round-ups need an Account Aggregator behind it.
- Without a model configured, sentiment runs on the built-in weighted lexicon
  (`src/lib/ai/lexicon.ts`). It handles negation and phrase precedence and
  scored 15/15 on a hand-labelled headline set, but it is rules, not a model.
  The UI always reports which engine produced a label.
- The Anthropic path is covered by tests against a mocked SDK but has never run
  against the live API. The OpenAI-compatible path (Gemini, Groq, OpenRouter,
  Ollama) is the better-trodden one.
- Sentiment reads twenty headlines from five feeds. That is a mood reading, not
  a market view, and the tilt is damped by sample size to reflect that.

## Docs

- [`docs/segments.html`](docs/segments.html) - ranked shortlist of target saver
  segments and the channels where they cluster.

## License

MIT - see [LICENSE](LICENSE). Fork it, change it, run it commercially.
The simulated broker and the disclosures exist for good reasons; if you connect
a real venue, the legal obligations are yours.
