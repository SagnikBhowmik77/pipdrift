import { describe, expect, it } from "vitest";

import { interleave, parseRssItems, type Headline } from "./rss";

/**
 * The sentiment reading is only as good as the sample behind it. These guard
 * the two ways that sample silently narrows: one outlet crowding out the rest,
 * and the same syndicated story counted twice.
 */

function headline(source: string, title: string): Headline {
  return { id: `${source}:${title}`, title, link: "https://example.test", source, publishedAt: null };
}

describe("interleave", () => {
  it("takes from every feed before repeating one", () => {
    const merged = interleave(
      [
        [headline("A", "a1"), headline("A", "a2"), headline("A", "a3")],
        [headline("B", "b1"), headline("B", "b2")],
        [headline("C", "c1")],
      ],
      4,
    );

    expect(merged.map((h) => h.source)).toEqual(["A", "B", "C", "A"]);
  });

  it("drops the same story syndicated across outlets", () => {
    const merged = interleave(
      [
        [headline("A", "RBI holds repo rate steady")],
        [headline("B", "RBI holds repo rate steady!")],
        [headline("C", "rbi   holds repo rate  steady")],
      ],
      10,
    );

    expect(merged).toHaveLength(1);
  });

  it("respects the limit", () => {
    const batches = [
      Array.from({ length: 10 }, (_, i) => headline("A", `a${i}`)),
      Array.from({ length: 10 }, (_, i) => headline("B", `b${i}`)),
    ];

    expect(interleave(batches, 5)).toHaveLength(5);
  });

  it("survives a feed returning nothing", () => {
    const merged = interleave([[], [headline("B", "b1")], []], 5);

    expect(merged.map((h) => h.title)).toEqual(["b1"]);
  });

  it("returns nothing when every feed is empty", () => {
    expect(interleave([[], []], 5)).toEqual([]);
    expect(interleave([], 5)).toEqual([]);
  });

  it("skips blank titles rather than counting them", () => {
    expect(interleave([[headline("A", "   ")], [headline("B", "real")]], 5)).toHaveLength(1);
  });
});

describe("parseRssItems", () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Nifty climbs 1%]]></title><link>https://x.test/1</link>
      <guid>g1</guid><pubDate>Wed, 20 Aug 2025 09:30:00 GMT</pubDate></item>
    <item><title>Rupee &amp; bonds steady</title><link>https://x.test/2</link></item>
    <item><link>https://x.test/3</link></item>
  </channel></rss>`;

  it("reads title, link, guid and date", () => {
    const [first] = parseRssItems(xml, "Test", 10);

    expect(first.title).toBe("Nifty climbs 1%");
    expect(first.id).toBe("g1");
    expect(first.publishedAt).toBe("2025-08-20T09:30:00.000Z");
  });

  it("decodes entities and CDATA", () => {
    expect(parseRssItems(xml, "Test", 10)[1].title).toBe("Rupee & bonds steady");
  });

  it("drops items missing a title or link", () => {
    expect(parseRssItems(xml, "Test", 10)).toHaveLength(2);
  });

  it("falls back to the link when there is no guid", () => {
    expect(parseRssItems(xml, "Test", 10)[1].id).toBe("https://x.test/2");
  });

  it("leaves publishedAt null on an unparseable date", () => {
    const bad = `<item><title>t</title><link>l</link><pubDate>not a date</pubDate></item>`;
    expect(parseRssItems(bad, "Test", 5)[0].publishedAt).toBeNull();
  });

  it("honours the limit and tolerates junk", () => {
    expect(parseRssItems(xml, "Test", 1)).toHaveLength(1);
    expect(parseRssItems("", "Test", 5)).toEqual([]);
    expect(parseRssItems("<html>nope</html>", "Test", 5)).toEqual([]);
  });
});
