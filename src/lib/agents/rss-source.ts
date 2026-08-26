import "server-only";

import { fetchHeadlines } from "@/lib/signals/rss";
import type { Signal, SignalSource } from "./types";

/**
 * The stock signal source: headlines from a public financial RSS feed.
 * Point it at a different feed with PIPDRIFT_RSS_URL, or copy this file as the
 * starting shape for a source of your own.
 */
export const rssHeadlineSource: SignalSource = {
  id: "rss-headlines",
  name: "Financial headlines",
  description:
    "Latest market headlines from a public RSS feed, cached for five minutes.",

  async fetchSignals(limit: number): Promise<Signal[]> {
    const headlines = await fetchHeadlines(limit);

    return headlines.map((headline) => ({
      id: headline.id,
      title: headline.title,
      url: headline.link,
      source: headline.source,
      publishedAt: headline.publishedAt,
    }));
  },
};
