export type BucketId = "equities" | "bonds" | "emerging";

export type Bucket = {
  id: BucketId;
  name: string;
  ticker: string;
  blurb: string;
};

/**
 * The three default buckets. NSE-listed so an Indian saver can actually hold
 * them in rupees without an LRS remittance or an unmodelled FX leg.
 */
export const BUCKETS: Bucket[] = [
  {
    id: "equities",
    name: "Equities",
    ticker: "NIFTYBEES",
    blurb: "Nifty 50 index - the growth engine.",
  },
  {
    id: "bonds",
    name: "Bonds",
    ticker: "GILT5YBEES",
    blurb: "5-year government gilts - the cushion for rough quarters.",
  },
  {
    // Named for what it actually holds. MAFANG tracks NYSE FANG+, which is US
    // mega-cap tech - calling it "Emerging Markets" was wrong. Swap the ticker
    // if you want genuine EM exposure; the bucket id stays "emerging" so no
    // migration is needed.
    id: "emerging",
    name: "Global Growth",
    ticker: "MAFANG",
    blurb: "Global tech leaders - diversification beyond India.",
  },
];

export const DEFAULT_BUCKET: BucketId = "equities";

export function isBucketId(value: unknown): value is BucketId {
  return typeof value === "string" && BUCKETS.some((b) => b.id === value);
}

export function getBucket(id: BucketId): Bucket {
  const bucket = BUCKETS.find((b) => b.id === id);
  if (!bucket) throw new Error(`Unknown bucket: ${id}`);
  return bucket;
}
