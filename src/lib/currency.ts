/**
 * Round-up math and rupee formatting.
 *
 * Everything is integer paise - floats lose money at scale, and the whole
 * product is built out of amounts too small to lose.
 */

export const PAISE_PER_RUPEE = 100;
export const CURRENCY_SYMBOL = "\u20B9";

/** Parse a user-typed amount ("128.40", "₹128.40", "128") into integer paise. */
export function parseAmountToPaise(raw: string): number | null {
  const cleaned = raw.trim().replace(/[\u20B9,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/**
 * Spare change to the next whole rupee.
 * A purchase that already lands on a rupee contributes nothing - matching how
 * every round-up product behaves, and worth showing before the user submits.
 */
export function roundUpPaise(amountPaise: number): number {
  const remainder = amountPaise % PAISE_PER_RUPEE;
  return remainder === 0 ? 0 : PAISE_PER_RUPEE - remainder;
}

// Indian digit grouping (1,23,456.78), not the Western 123,456.78.
const RUPEE_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPaise(paise: number): string {
  return RUPEE_FORMAT.format(paise / PAISE_PER_RUPEE);
}
