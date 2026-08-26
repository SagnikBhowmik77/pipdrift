/**
 * The broker seam.
 *
 * Pipdrift moves numbers in its own ledger; it does not buy anything. That gap
 * is the single largest difference between this app and what it describes, and
 * leaving it implicit is how a demo quietly starts implying it trades.
 *
 * So the gap is modelled explicitly. Every rebalance produces order intents and
 * hands them to a Broker. The default implementation fills nothing and says so
 * - `isLive` is false and every receipt is marked "simulated". Connecting a
 * real venue means implementing this interface, not rewriting the engine.
 *
 * A live implementation is not a coding problem. Placing orders for other
 * people in India requires a SEBI-registered entity and a broker agreement;
 * the interface is here so that when those exist, the engine is already shaped
 * for them.
 */

export type OrderSide = "buy" | "sell";

export type OrderIntent = {
  bucketId: string;
  /** Instrument the bucket tracks, e.g. NIFTYBEES. */
  symbol: string;
  side: OrderSide;
  /** Absolute value of the move, in paise. Never negative. */
  amountPaise: number;
};

export type OrderStatus = "simulated" | "filled" | "rejected";

export type OrderReceipt = {
  intent: OrderIntent;
  status: OrderStatus;
  /** Venue reference, when there is a venue. */
  brokerOrderId?: string;
  /** Why a rejection happened, or what a simulation stood in for. */
  note: string;
  at: string;
};

export type Broker = {
  id: string;
  name: string;
  /**
   * True only when orders reach a real venue with real money. The UI reads this
   * to decide what it is allowed to claim, so an implementation that returns
   * true without executing is the one bug this whole file exists to prevent.
   */
  isLive: boolean;
  placeOrders(intents: OrderIntent[]): Promise<OrderReceipt[]>;
};
