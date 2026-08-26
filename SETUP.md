# Pipdrift — setup checklist

Everything here is a thing **you** have to do, in order. Each step says what to
run, and how to tell it worked.

---

## 1. Turn on a real sentiment model (free)

Pipdrift labels headlines with a built-in word-list until you point it at a
model. Any **OpenAI-compatible** provider works — pick one of these free
options. (Free tiers change; check the provider's current limits.)

### Option A — Google Gemini *(recommended: most generous free tier)*

1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Click **Create API key**. Copy it.
3. Add to `.env`:

```bash
LLM_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
LLM_MODEL="gemini-2.0-flash"
LLM_API_KEY="paste-your-key-here"
```

### Option B — Groq *(fastest responses)*

1. Sign up at <https://console.groq.com>.
2. **API Keys → Create API Key**. Copy it.
3. Add to `.env`:

```bash
LLM_BASE_URL="https://api.groq.com/openai/v1"
LLM_MODEL="llama-3.3-70b-versatile"
LLM_API_KEY="paste-your-key-here"
```

### Option C — Ollama *(no key, no signup, runs on your machine)*

Genuinely free forever, but uses your own CPU/RAM and needs a few GB of disk.

1. Install from <https://ollama.com/download> (Windows installer).
2. In a terminal: `ollama pull llama3.2`
3. Add to `.env` — **leave the key empty**:

```bash
LLM_BASE_URL="http://localhost:11434/v1"
LLM_MODEL="llama3.2"
LLM_API_KEY=""
```

### Then, whichever you picked

```bash
npm run dev
```

Open <http://localhost:3100/sandbox/signals>. The line under the headlines
should change from *"labeled by the built-in lexicon"* to **"labeled by
`<your model>`"**.

> If it still says lexicon, the call failed and Pipdrift fell back on purpose.
> Look at the terminal running `npm run dev` — there will be an `[agents]` line
> with the reason (bad key, rate limit, wrong model name).

---

## 2. Keep the agents running

The fleet only works around the clock if something calls it on a clock.

### While developing

Two terminals:

```bash
npm run dev
```

```bash
npm run agent:watch
```

You'll see a tick line every 5 minutes. Every pass is recorded — check
<http://localhost:3100/sandbox/profile> for "Last tick ran on schedule".

### In production

Point any scheduler at the endpoint with the secret from `.env`:

```bash
curl -X POST https://your-host/api/cron/rebalance -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- **Vercel** — add `vercel.json` with a `crons` entry hitting `/api/cron/rebalance`
- **GitHub Actions** — a `schedule:` workflow running the curl above
- **A VPS** — a systemd timer or plain `crontab`

---

## 3. Test automatic round-ups

There's no bank connection yet, but the ingestion webhook is real. Simulate a
card provider pushing a purchase:

```bash
npm run tx:push -- --email you@example.com --merchant "Chai Point" --amount 128.40
```

You should get `"ok": true` with the round-up in paise. Check
<http://localhost:3100/sandbox> — the purchase is there.

To make this automatic for real you need a provider that can read a user's card
transactions. In India that means an **Account Aggregator** (Setu, Finvu,
Perfios) or a card-network partnership. When you have one, point its webhook at
`POST /api/transactions/ingest` and have it sign the body with `INGEST_SECRET`.

---

## 4. Decide on the third bucket

The third bucket is now labelled **Global Growth** holding `MAFANG`, because
that ETF tracks NYSE FANG+ (US mega-cap tech). It was previously mislabelled
"Emerging Markets", which it is not.

If you want genuine emerging-market exposure instead, change `src/lib/buckets.ts`
— the bucket `id` stays `emerging`, so no database migration is needed.

---

## 5. Before this touches real money

Not optional, and not things code alone solves:

- **A broker.** Pipdrift moves numbers in a ledger. Executing real trades needs
  a SEBI-registered broker relationship and the regulatory standing to place
  orders on someone's behalf.
- **Tests.** There is no test suite. The round-up and rebalancing maths are the
  first things that deserve one.
- **Email.** Signup, waitlist, and contact messages are stored but nothing is
  sent, so there is no password reset.
- **Hardening.** No rate limiting, no email verification, no lockout on repeated
  failed logins.
- **Deployment.** It runs on your laptop against a SQLite file. A hosted
  deployment needs Postgres and a real host.

---

## Quick reference

| Command | What it does |
|---|---|
| `npm run dev` | App on port 3100 |
| `npm run agent:watch` | Run agent ticks every 5 min |
| `npm run agent:once` | One tick, then exit |
| `npm run tx:push -- --email … --amount …` | Simulate a card purchase |
| `npm run db:migrate` | Apply schema changes |
| `npm run build` | Production build |

**After any `prisma generate`, restart `npm run dev`** — the dev server keeps the
old client in memory and writes to new columns will fail.
