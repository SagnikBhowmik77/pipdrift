import "server-only";

export type Headline = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
};

export type Feed = { source: string; url: string };

/**
 * Several outlets rather than one.
 *
 * A single feed makes the sentiment reading a read on one newsroom as much as
 * on the market, and one outage silences the agent entirely. These five are
 * public, unauthenticated, and were each verified to return parseable items.
 */
const DEFAULT_FEEDS: Feed[] = [
  {
    source: "ET Markets",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  },
  {
    source: "Business Standard",
    url: "https://www.business-standard.com/rss/markets-106.rss",
  },
  { source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/marketreports.xml" },
  { source: "Livemint", url: "https://www.livemint.com/rss/markets" },
  {
    source: "BusinessLine",
    url: "https://www.thehindubusinessline.com/markets/feeder/default.rss",
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

/** Read per feed before interleaving, so no one outlet can fill the sample. */
const PER_FEED_LIMIT = 6;

type CacheEntry = { fetchedAt: number; key: string; headlines: Headline[] };

// Module-level cache: the panel is read far more often than the feed updates,
// and an upstream outage should not take the page down with it.
let cache: CacheEntry | null = null;

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeEntities(match[1]) : null;
}

/**
 * Minimal RSS <item> reader. A full XML parser is more than this needs - we
 * read four known fields from one known feed shape and drop anything malformed.
 */
export function parseRssItems(xml: string, source: string, limit: number): Headline[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const headlines: Headline[] = [];

  for (const block of blocks) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) continue;

    const pubDate = extractTag(block, "pubDate");
    const parsed = pubDate ? new Date(pubDate) : null;

    headlines.push({
      id: extractTag(block, "guid") ?? link,
      title,
      link,
      source,
      publishedAt:
        parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    });

    if (headlines.length >= limit) break;
  }

  return headlines;
}

/**
 * Feeds to read, from env or the built-in list.
 *
 * PIPDRIFT_RSS_URL accepts a comma-separated list; PIPDRIFT_RSS_SOURCE names
 * them positionally. A URL without a matching name falls back to its hostname,
 * so a half-filled override still attributes headlines honestly.
 */
export function readFeeds(): Feed[] {
  const urls = (process.env.PIPDRIFT_RSS_URL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (urls.length === 0) return DEFAULT_FEEDS;

  const names = (process.env.PIPDRIFT_RSS_SOURCE ?? "")
    .split(",")
    .map((value) => value.trim());

  return urls.map((url, i) => ({
    url,
    source: names[i] || hostnameOf(url),
  }));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www./, "");
  } catch {
    return "Unknown source";
  }
}

/**
 * Round-robins across feeds so the sample stays diverse.
 *
 * Merging by timestamp alone lets the busiest newsroom supply most of the
 * headlines, which is the single-source problem wearing a disguise. Taking one
 * from each feed in turn keeps every outlet represented before any outlet
 * repeats. Duplicates - the same story syndicated twice - are dropped on a
 * normalised title.
 */
export function interleave(batches: Headline[][], limit: number): Headline[] {
  const seen = new Set<string>();
  const merged: Headline[] = [];
  const depth = Math.max(0, ...batches.map((b) => b.length));

  for (let rank = 0; rank < depth && merged.length < limit; rank++) {
    for (const batch of batches) {
      if (merged.length >= limit) break;

      const headline = batch[rank];
      if (!headline) continue;

      const key = headline.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;

      seen.add(key);
      merged.push(headline);
    }
  }

  return merged;
}

async function fetchFeed(feed: Feed): Promise<Headline[]> {
  const response = await fetch(feed.url, {
    headers: { "user-agent": "pipdrift-sandbox/0.1" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Feed responded ${response.status}`);

  return parseRssItems(await response.text(), feed.source, PER_FEED_LIMIT);
}

/**
 * Pulls every configured feed in parallel and interleaves the result.
 *
 * A feed that fails contributes nothing rather than rejecting the batch, so the
 * agent degrades one outlet at a time instead of going silent. Only a pull that
 * produced something replaces the cache - stale headlines beat none at all.
 */
export async function fetchHeadlines(limit = 5): Promise<Headline[]> {
  const feeds = readFeeds();
  const key = feeds.map((f) => f.url).join("|");

  if (cache && cache.key === key && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.headlines.slice(0, limit);
  }

  const settled = await Promise.allSettled(feeds.map(fetchFeed));

  const batches: Headline[][] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      batches.push(result.value);
    } else {
      console.error(`[signals] feed ${feeds[i].source} failed`, result.reason);
    }
  });

  const headlines = interleave(batches, Math.max(limit, PER_FEED_LIMIT * feeds.length));

  if (headlines.length > 0) {
    cache = { fetchedAt: Date.now(), key, headlines };
    return headlines.slice(0, limit);
  }

  // Every feed failed: serve the last good pull if there is one.
  return cache?.headlines.slice(0, limit) ?? [];
}
