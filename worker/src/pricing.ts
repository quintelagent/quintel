import type { Session } from './session';

/** Beyond this token/reference gap we assume a corporate-action multiplier mismatch — unless the stock quote disagrees with the reference too. */
export const MAX_SANE_GAP = 0.25;

/** True when daily history is missing a completed session. */
export function historyStale(latestClose: string | null | undefined, lastCompletedSession: string): boolean {
  return !latestClose || latestClose < lastCompletedSession;
}

export interface PricingInput {
  session: Session;
  stock: number | null;
  chain: number | null;
  lastClose: number;
  /** daily history is missing the latest completed session */
  stale: boolean;
}

export interface Pricing { spot: number; source: 'stock' | 'chain' | 'last_close'; ref: number; gap: number | null }

/**
 * Pick the starting price. The reference for the token gap is the live stock price when open,
 * and otherwise the last close — or the latest stock quote if history is behind. In extended
 * hours a big real move shows up in the stock quote as well as the token, so the token is
 * accepted when it agrees with either.
 */
export function choosePrice(i: PricingInput): Pricing {
  const ref = i.session === 'open' && i.stock ? i.stock : i.stale && i.stock ? i.stock : i.lastClose;
  const raw = i.chain ? i.chain / ref - 1 : null;
  const agreesWithStock = i.chain && i.stock ? Math.abs(i.chain / i.stock - 1) <= 0.05 : false;
  const gap = raw !== null && (Math.abs(raw) <= MAX_SANE_GAP || agreesWithStock) ? raw : null;
  if (i.session === 'open' && i.stock) return { spot: i.stock, source: 'stock', ref, gap };
  if (i.chain && gap !== null) return { spot: i.chain, source: 'chain', ref, gap };
  return { spot: ref, source: 'last_close', ref, gap };
}
