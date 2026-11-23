import { DESK_RULES } from '../config';
import { hashObject } from '../../../engine/src/hash';

export interface Position { side: 'long' | 'short'; qty: number; entryPrice: number; entryTs: string; entryRunId: number }
export interface DeskState {
  cash: number;
  position: Position | null;
  equity: number;
  peakEquity: number;
  maxDrawdown: number;
  wins: number;
  losses: number;
  lastPrice: number;
  updatedAt: string;
}

export interface DeskSignal {
  runId: number;
  ts: string;
  price: number;
  pUp1w: number;
  crisis: number;
  prevCrisis: number | null;
  marketOpen: boolean;
}

export interface TradeEvent { action: 'enter' | 'exit'; side: 'long' | 'short'; price: number; qty: number; pnl: number | null; reason: string }

export function initialDesk(ts: string): DeskState {
  const c = DESK_RULES.startingCash;
  return { cash: c, position: null, equity: c, peakEquity: c, maxDrawdown: 0, wins: 0, losses: 0, lastPrice: 0, updatedAt: ts };
}

export function markToMarket(s: DeskState, price: number): number {
  if (!s.position) return s.cash;
  const p = s.position;
  return p.side === 'long' ? s.cash + p.qty * price : s.cash - p.qty * price;
}

/**
 * Pure rules step. Returns the new state and any trades.
 * Rules (published): enter long when P(up,1w) ≥ 0.58 and Crisis Level is falling;
 * exit when P(up,1w) < 0.50 or the position is down 8%. Long or flat, 1x, fills only while the market is open.
 */
export function stepDesk(prev: DeskState, sig: DeskSignal, rules = DESK_RULES): { state: DeskState; trades: TradeEvent[] } {
  const s: DeskState = { ...prev, position: prev.position ? { ...prev.position } : null };
  const trades: TradeEvent[] = [];
  const canTrade = !rules.tradeOnlyWhenOpen || sig.marketOpen;

  if (canTrade && s.position) {
    const p = s.position;
    const ret = p.side === 'long' ? sig.price / p.entryPrice - 1 : 1 - sig.price / p.entryPrice;
    let reason = '';
    if (ret <= rules.stopLoss) reason = `stop-loss: position ${(ret * 100).toFixed(1)}% vs entry`;
    else if (p.side === 'long' && sig.pUp1w < rules.exitPUp1w) reason = `P(up, 1w) ${(sig.pUp1w * 100).toFixed(1)}% fell below ${Math.round(rules.exitPUp1w * 100)}%`;
    if (reason) {
      const pnl = p.side === 'long' ? p.qty * (sig.price - p.entryPrice) : p.qty * (p.entryPrice - sig.price);
      s.cash = p.side === 'long' ? s.cash + p.qty * sig.price : s.cash - p.qty * sig.price;
      if (pnl >= 0) s.wins++; else s.losses++;
      trades.push({ action: 'exit', side: p.side, price: sig.price, qty: p.qty, pnl, reason });
      s.position = null;
    }
  }

  if (canTrade && !s.position && trades.length === 0) {
    const falling = sig.prevCrisis !== null && sig.crisis < sig.prevCrisis;
    if (sig.pUp1w >= rules.enterLongPUp1w && falling) {
      const qty = (s.cash * rules.maxLeverage) / sig.price;
      s.cash -= qty * sig.price;
      s.position = { side: 'long', qty, entryPrice: sig.price, entryTs: sig.ts, entryRunId: sig.runId };
      trades.push({
        action: 'enter', side: 'long', price: sig.price, qty, pnl: null,
        reason: `P(up, 1w) ${(sig.pUp1w * 100).toFixed(1)}% ≥ ${Math.round(rules.enterLongPUp1w * 100)}% and Crisis Level fell ${sig.prevCrisis}→${sig.crisis}`,
      });
    }
  }

  s.lastPrice = sig.price;
  s.equity = markToMarket(s, sig.price);
  s.peakEquity = Math.max(s.peakEquity, s.equity);
  s.maxDrawdown = Math.max(s.maxDrawdown, 1 - s.equity / s.peakEquity);
  s.updatedAt = sig.ts;
  return { state: s, trades };
}

export function deskHash(s: DeskState): string {
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  return hashObject({
    ...s,
    cash: round(s.cash), equity: round(s.equity), peakEquity: round(s.peakEquity), maxDrawdown: round(s.maxDrawdown), lastPrice: round(s.lastPrice),
    position: s.position ? { ...s.position, qty: round(s.position.qty), entryPrice: round(s.position.entryPrice) } : null,
  });
}
