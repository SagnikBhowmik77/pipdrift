/**
 * Standing disclosure that no order is ever placed.
 *
 * Every figure in the sandbox is a ledger entry, not a holding: no broker is
 * connected and nothing is bought or sold. A reader looking at a rupee figure
 * beside an ETF ticker will reasonably assume otherwise unless told plainly and
 * in the same view, so this sits on the dashboard chrome rather than in a
 * footer nobody scrolls to.
 *
 * It is also the honest position legally: allocating other people's money in
 * India is SEBI-registered activity, and the fact that nothing here trades is
 * exactly what keeps this a demo rather than an unlicensed service.
 */
export function PaperBadge() {
  return (
    <span className="rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200/90">
      Paper
    </span>
  );
}

export function TradingDisclosure() {
  return (
    <p className="mx-auto w-full max-w-7xl px-5 pb-10 text-sm leading-relaxed text-slate-500 lg:px-8">
      Balances here are a ledger, not holdings. No broker is connected and no
      order is ever placed. Nothing on this page is investment advice, and
      Pipdrift is not a SEBI-registered adviser or distributor.
    </p>
  );
}
