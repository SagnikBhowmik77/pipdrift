import type { Broker, OrderIntent, OrderReceipt } from "./types";

/**
 * Records what would have been traded, and fills nothing.
 *
 * This is the honest default: the rebalancer already moved the ledger, and
 * these receipts are the audit trail of the orders that a live broker would
 * have needed to place to make that ledger true. Marking them "simulated"
 * rather than "filled" keeps the distinction visible everywhere downstream.
 */
export const simulatedBroker: Broker = {
  id: "simulated",
  name: "Simulated broker",
  isLive: false,

  async placeOrders(intents: OrderIntent[]): Promise<OrderReceipt[]> {
    const at = new Date().toISOString();

    return intents.map((intent) => ({
      intent,
      status: "simulated" as const,
      note: "No broker connected - ledger updated, no order placed.",
      at,
    }));
  },
};
