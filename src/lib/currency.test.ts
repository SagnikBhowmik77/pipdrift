import { describe, expect, it } from "vitest";

import {
  formatPaise,
  PAISE_PER_RUPEE,
  parseAmountToPaise,
  roundUpPaise,
} from "./currency";

/**
 * Money is integer paise everywhere. These tests exist because the failure mode
 * is silent: a float that loses a paisa per transaction never throws, it just
 * makes the ledger wrong over time.
 */

describe("parseAmountToPaise", () => {
  it("parses plain and decimal rupee amounts", () => {
    expect(parseAmountToPaise("12")).toBe(1200);
    expect(parseAmountToPaise("12.3")).toBe(1230);
    expect(parseAmountToPaise("12.34")).toBe(1234);
    expect(parseAmountToPaise("0.05")).toBe(5);
  });

  it("tolerates currency symbols, commas and whitespace", () => {
    expect(parseAmountToPaise("  ₹1,234.50 ")).toBe(123450);
  });

  it("rejects anything that is not a well-formed amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1.2.3", "1e3", "٣"]) {
      expect(parseAmountToPaise(bad)).toBeNull();
    }
  });

  it("does not lose a paisa to float arithmetic", () => {
    // 0.1 + 0.2 territory: these are exactly the values naive parsing breaks on.
    expect(parseAmountToPaise("0.29")).toBe(29);
    expect(parseAmountToPaise("1.15")).toBe(115);
    expect(parseAmountToPaise("4.35")).toBe(435);
    expect(parseAmountToPaise("8.07")).toBe(807);
  });
});

describe("roundUpPaise", () => {
  it("returns the change to the next whole rupee", () => {
    expect(roundUpPaise(435)).toBe(65);
    expect(roundUpPaise(1)).toBe(99);
    expect(roundUpPaise(199)).toBe(1);
  });

  it("returns zero on an exact rupee - there is no spare change", () => {
    expect(roundUpPaise(0)).toBe(0);
    expect(roundUpPaise(100)).toBe(0);
    expect(roundUpPaise(123400)).toBe(0);
  });

  it("always lands the purchase on a whole rupee", () => {
    for (let paise = 0; paise < 1000; paise++) {
      expect((paise + roundUpPaise(paise)) % PAISE_PER_RUPEE).toBe(0);
    }
  });

  it("never returns more than a rupee", () => {
    for (let paise = 0; paise < 1000; paise++) {
      const change = roundUpPaise(paise);
      expect(change).toBeGreaterThanOrEqual(0);
      expect(change).toBeLessThan(PAISE_PER_RUPEE);
    }
  });
});

describe("formatPaise", () => {
  it("always shows two decimal places", () => {
    expect(formatPaise(0)).toContain("0.00");
    expect(formatPaise(5)).toContain("0.05");
    expect(formatPaise(1234)).toContain("12.34");
  });

  it("round-trips through the parser", () => {
    for (const paise of [0, 1, 99, 100, 435, 123456]) {
      expect(parseAmountToPaise(formatPaise(paise))).toBe(paise);
    }
  });
});
