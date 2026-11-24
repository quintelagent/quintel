import type { HorizonStats } from '@engine/types';
import { DEAD_ADDRESS, type BurnBodyJson, type BurnErrorCode, type BurnHorizon, type BurnReply, type BurnResult, type BurnSummary, type Scenario } from '../../../worker/src/burn/scenario';
import { pctChange, usd } from './format';
import type { WalletProblem } from './wallet';

export * from '../../../worker/src/burn/scenario';

export const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const when = (h: BurnHorizon) => ({ 1: 'at the next close', 5: 'in 1 week', 21: 'in 1 month' })[h];
export const shockLine = (s: Scenario['shock']) => (s ? `Drift ${pctChange(s.drift, 0)}, jumps ${s.jumpMult.toFixed(1)}×, volatility ${s.volMult.toFixed(2)}×` : 'No shock');
export const aboveLine = (s: Scenario) => `of futures end above ${usd(s.price)} ${when(s.horizon)}`;
/** Minutes until a queued run should start: the next ten-minute slot, then one per slot. */
export const waitMinutes = (ahead: number, now: Date) => Math.ceil((600_000 - (now.getTime() % 600_000)) / 60_000) + 1 + ahead * 10;
export const statsOf = (r: BurnResult, days: number) => ({ days, mean: r.mean, pct: r.pct, hist: r.hist }) as unknown as HorizonStats;

/** The exact transfer, or null when anything read just now differs from what the page shows. */
export function burnTransfer(shown: BurnSummary, now: BurnSummary, official: { token: string | null; chainId: number }): { token: string; raw: bigint; chainId: number; decimals: number } | null {
  const { token, amount, amountRaw, decimals, chainId } = now;
  if (!now.open || !token || amount === null || decimals === null || !same(token, shown.token) || !same(token, official.token) || chainId !== shown.chainId || chainId !== official.chainId) return null;
  const raw = BigInt(amount) * 10n ** BigInt(decimals);
  return amount === shown.amount && amountRaw === raw.toString() && now.burnAddress === DEAD_ADDRESS && shown.burnAddress === DEAD_ADDRESS ? { token, raw, chainId, decimals } : null;
}

export function errorText(code: BurnErrorCode, amount: string): string {
  const t: Record<BurnErrorCode, string> = {
    bad_request: 'The request couldn’t be read. Check the hash and the signature.',
    too_large: 'The request couldn’t be read. Check the hash and the signature.',
    slow_down: 'Too many tries. Wait a minute, then try again.',
    not_open: 'Burn-to-run isn’t open yet.',
    not_found: 'We couldn’t find that burn. Check the transaction hash and network.',
    reverted: 'That transaction failed on the chain, so nothing was burned.',
    wrong_token: 'That transaction doesn’t move $QNTL.',
    wrong_recipient: 'That $QNTL went to another address, not the burn address.',
    too_small: `This burn is below ${amount} $QNTL, so it can’t start a run.`,
    too_old: 'This burn is from before burn-to-run opened.',
    wrong_signer: 'The signature isn’t from the wallet that burned. Sign with that wallet.',
    used: 'This burn already has its run.',
    out_of_range: 'The price is too far from the latest run. Choose a closer one.',
    unavailable: 'Couldn’t check the burn just now. Try again: a burn is never used twice.',
  };
  return t[code];
}
export const WALLET_TEXT: Record<WalletProblem, string> = {
  none: 'No wallet found in this browser.',
  rejected: 'You closed the request in your wallet. Nothing was sent.',
  busy: 'Your wallet already has a request open. Finish it there first.',
  failed: 'Your wallet couldn’t finish that. Check it before you try again.',
};

export async function sendRequest(body: BurnBodyJson): Promise<BurnReply> {
  try {
    const r = await fetch('/api/burn/request', { method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json()) as BurnReply;
    return 'id' in j || 'waiting' in j || ('error' in j && errorText(j.error, '')) ? j : { error: 'unavailable' };
  } catch { return { error: 'unavailable' }; }
}
