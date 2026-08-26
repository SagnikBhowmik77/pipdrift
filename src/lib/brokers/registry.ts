import "server-only";

import { simulatedBroker } from "./simulated-broker";
import type { Broker, OrderIntent } from "./types";

/**
 * Resolves the broker for this deployment.
 *
 * There is exactly one today. A real one registers here and everything
 * upstream - the tick, the receipts, the UI's claims - follows from `isLive`.
 */
export function getBroker(): Broker {
  return simulatedBroker;
}

/**
 * Turns a set of balance changes into the orders that would realise them.
 *
 * A bucket whose balance rises needs a buy, one that falls needs a sell, and a
 * bucket that did not move needs nothing - emitting a zero-value order would
 * put noise in an audit trail whose whole purpose is to be trustworthy.
 */
export function toOrderIntents(
  moves: { bucketId: string; symbol: string; fromPaise: number; toPaise: number }[],
): OrderIntent[] {
  const intents: OrderIntent[] = [];

  for (const move of moves) {
    const delta = move.toPaise - move.fromPaise;
    if (delta === 0) continue;

    intents.push({
      bucketId: move.bucketId,
      symbol: move.symbol,
      side: delta > 0 ? "buy" : "sell",
      amountPaise: Math.abs(delta),
    });
  }

  return intents;
}
