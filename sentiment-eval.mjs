import { scoreSentiment } from "./src/lib/ai/lexicon.ts";

// Real headlines seen from the feeds, plus the negation cases a flat word-list
// gets wrong. `want` is the label a human would give for a diversified book.
const CASES = [
  ["Trump to allow import of 300,000 metric tons of ground beef without tariff", "positive"],
  ["India bond yields hit two-month high as rate hike fears intensify", "negative"],
  ["Gold rallies to 3-month high on weaker dollar, bullish technicals", "positive"],
  ["Gold could top Goldman's $4,900 forecast as options demand fuels rally", "positive"],
  ["RBI holds rates, signals no rate hike this cycle", "positive"],
  ["Sensex crashes 1,200 points as selloff deepens", "negative"],
  ["Nifty ends flat ahead of policy decision", "neutral"],
  ["Symbiotec Pharmalab gets Rs 526 crore anchor backing ahead of IPO", "neutral"],
  ["Markets rally as inflation eases to 18-month low", "positive"],
  ["Banks report higher provisioning as NPAs climb", "negative"],
  ["Rupee slips to record low amid FII selling", "negative"],
  ["IT stocks surge on strong Q3 profit growth", "positive"],
  ["Auto sales drop as demand weakens", "negative"],
  ["Company avoids default after refinancing deal", "positive"],
  ["Index closes unchanged in thin trade", "neutral"],
];

let pass = 0;
console.log("headline".padEnd(64), "want".padEnd(9), "got".padEnd(9), "score  tags");
console.log("-".repeat(120));
for (const [title, want] of CASES) {
  const { sentiment, score, tags } = scoreSentiment(title);
  const ok = sentiment === want;
  if (ok) pass++;
  console.log(
    (ok ? "  " : "X ") + title.slice(0, 62).padEnd(62),
    want.padEnd(9), sentiment.padEnd(9),
    String(score).padStart(5), " ", tags.join(", ").slice(0, 40),
  );
}
console.log("-".repeat(120));
console.log(`${pass}/${CASES.length} correct`);
