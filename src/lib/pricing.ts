/**
 * Single source of truth for pricing copy. /pricing and /faq both read from
 * here so the two pages cannot drift apart on the fee or the threshold - the
 * exact inconsistency the FAQ brief warned about.
 */

export const AUM_THRESHOLD_RUPEES = 500_000;
export const MANAGED_FEE_PCT = 0.2;

export const AUM_THRESHOLD_LABEL = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(AUM_THRESHOLD_RUPEES);

export type Tier = {
  id: "personal" | "managed";
  name: string;
  price: string;
  priceNote: string;
  pitch: string;
  cta: string;
  features: string[];
};

/** Feature rows for the side-by-side checklist. */
export const FEATURE_MATRIX: { feature: string; personal: boolean; managed: boolean }[] =
  [
    { feature: "Spare-change round-ups", personal: true, managed: true },
    { feature: "Three default ETF buckets", personal: true, managed: true },
    { feature: "Sandbox rebalancing engine", personal: true, managed: true },
    { feature: "User-set drift threshold", personal: true, managed: true },
    { feature: "Open, forkable agent pipeline", personal: true, managed: true },
    { feature: "Rebalance history and audit trail", personal: true, managed: true },
    { feature: "Advanced risk profiles", personal: false, managed: true },
    { feature: "Per-ETF exposure caps", personal: false, managed: true },
    { feature: "Tax-aware rebalancing", personal: false, managed: true },
    { feature: "Priority support", personal: false, managed: true },
  ];

export const TIERS: Tier[] = [
  {
    id: "personal",
    name: "Personal",
    price: "0%",
    priceNote: "No AUM fee. No monthly fee.",
    pitch:
      "Everything you need to round up, allocate, and rebalance on your own terms - free, whatever your balance.",
    cta: "Open sandbox",
    features: FEATURE_MATRIX.filter((f) => f.personal).map((f) => f.feature),
  },
  {
    id: "managed",
    name: "Managed",
    price: `${MANAGED_FEE_PCT}%`,
    priceNote: `Charged annually on assets above ${AUM_THRESHOLD_LABEL} only.`,
    pitch:
      "Adds the controls that matter once a portfolio is large enough for tax and concentration to cost more than the fee.",
    cta: "Join the waitlist",
    features: FEATURE_MATRIX.filter((f) => f.managed).map((f) => f.feature),
  },
];
