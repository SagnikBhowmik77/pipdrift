export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Coffee",
  "Shopping",
  "Bills",
  "Entertainment",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
