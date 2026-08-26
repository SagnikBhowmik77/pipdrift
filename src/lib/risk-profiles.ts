import type { BucketId } from "./buckets";

export type RiskProfileId = "conservative" | "balanced" | "growth";

export type RiskProfile = {
  id: RiskProfileId;
  name: string;
  blurb: string;
  targets: Record<BucketId, number>;
};

/** Presets must each sum to 100 - asserted in assertProfilesSumTo100 below. */
export const RISK_PROFILES: RiskProfile[] = [
  {
    id: "conservative",
    name: "Conservative",
    blurb: "Bond-heavy. Smaller swings, slower compounding.",
    targets: { equities: 25, bonds: 60, emerging: 15 },
  },
  {
    id: "balanced",
    name: "Balanced",
    blurb: "The default mix. Growth with a real cushion.",
    targets: { equities: 45, bonds: 35, emerging: 20 },
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "Equity-tilted. Bigger drawdowns, bigger upside.",
    targets: { equities: 70, bonds: 10, emerging: 20 },
  },
];

export const DEFAULT_RISK_PROFILE: RiskProfileId = "balanced";

export function getRiskProfile(id: string): RiskProfile {
  return (
    RISK_PROFILES.find((p) => p.id === id) ??
    RISK_PROFILES.find((p) => p.id === DEFAULT_RISK_PROFILE)!
  );
}

for (const profile of RISK_PROFILES) {
  const sum = Object.values(profile.targets).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    throw new Error(`Risk profile ${profile.id} targets sum to ${sum}, not 100`);
  }
}
