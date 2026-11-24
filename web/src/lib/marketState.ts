import { closeMinute, etParts, etToUtc, isTradingDay, nextOpen, sessionAt, EARLY_CLOSES, HOLIDAYS, addDays } from '../../../worker/src/session';

export { addTradingDays, etParts, etToUtc, isTradingDay, nextOpen, EARLY_CLOSES, HOLIDAYS, addDays } from '../../../worker/src/session';

export type MarketKind = 'open' | 'half-day' | 'after-hours' | 'weekend' | 'holiday';
export interface MarketState { kind: MarketKind; open: boolean; label: string; nextOpen: Date; nextClose: Date | null }

/** One shared answer to "is the market open", from the same calendar the worker uses. */
export function marketState(now: Date): MarketState {
  const e = etParts(now);
  const open = sessionAt(now) === 'open';
  const next = nextOpen(now);
  if (open) {
    const cm = closeMinute(e.date);
    const nextClose = etToUtc(e.date, Math.floor(cm / 60), cm % 60);
    const half = EARLY_CLOSES.has(e.date);
    return { kind: half ? 'half-day' : 'open', open, label: half ? 'Half day' : 'Market open', nextOpen: next, nextClose };
  }
  const base = { open, nextOpen: next, nextClose: null };
  if (HOLIDAYS.has(e.date)) return { kind: 'holiday', label: 'Holiday', ...base };
  if (!isTradingDay(e.date)) return { kind: 'weekend', label: 'Weekend', ...base };
  return { kind: 'after-hours', label: 'After hours', ...base };
}

/** Delayed = no new run for 20 min while open, 45 min while closed (SYSTEM.md section 7). */
export function isDelayed(runTs: string | null | undefined, now: Date): boolean {
  if (!runTs) return false;
  const age = now.getTime() - new Date(runTs).getTime();
  const open = sessionAt(now) === 'open';
  // right after the open the last run may still be on the 30-min cadence
  const justOpened = open && sessionAt(new Date(now.getTime() - 20 * 60000)) !== 'open';
  return age > (open && !justOpened ? 20 : 45) * 60000;
}
/** Minutes between runs right now. */
export const cadenceMin = (now: Date) => (sessionAt(now) === 'open' ? 10 : 30);
/** The trading day a horizon lands on (same rule as the scorecard: N sessions after the run's ET day). */
export { addTradingDays as horizonDate } from '../../../worker/src/session';
