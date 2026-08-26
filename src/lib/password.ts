import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id with OWASP-recommended parameters. Kept in its own module so the
 * cost settings live in exactly one place.
 */
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    // A malformed or truncated hash must read as "wrong password", never throw.
    return false;
  }
}
