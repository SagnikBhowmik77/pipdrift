import "server-only";

import { redirect } from "next/navigation";

import { auth } from "./auth";

/**
 * Resolves the signed-in user for every /sandbox page and API route.
 * Unauthenticated callers are sent to the login page rather than silently
 * getting an empty portfolio.
 */
export async function getSessionUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect("/login");
  return userId;
}

/** Same lookup for route handlers, which must return a 401 rather than redirect. */
export async function getSessionUserIdOrNull(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
