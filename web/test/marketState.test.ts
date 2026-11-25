import { describe, expect, it } from 'vitest';
import { cadenceMin, isDelayed, marketState } from '../src/lib/marketState';

const at = (s: string) => new Date(s);
describe('market state', () => {
  it.each([
    ['2026-11-25T14:29:00Z', 'after-hours', 'After hours', 30],
    ['2026-11-25T14:30:00Z', 'open', 'Market open', 10],
    ['2026-11-25T21:00:00Z', 'after-hours', 'After hours', 30],
    ['2026-11-26T16:00:00Z', 'holiday', 'Holiday', 30],
    ['2026-11-27T16:00:00Z', 'half-day', 'Half day', 10],
    ['2026-11-27T18:00:00Z', 'after-hours', 'After hours', 30],
    ['2026-11-28T16:00:00Z', 'weekend', 'Weekend', 30],
  ])('%s is %s', (t, kind, label, cadence) => {
    const s = marketState(at(t)); expect([s.kind, s.label, cadenceMin(at(t))]).toEqual([kind, label, cadence]);
  });
  it('a half day closes at 1:00pm ET, and Thanksgiving skips to Friday', () => {
    expect(marketState(at('2026-11-27T16:00:00Z')).nextClose?.toISOString()).toBe('2026-11-27T18:00:00.000Z');
    expect(marketState(at('2026-11-25T21:00:00Z')).nextOpen.toISOString()).toBe('2026-11-27T14:30:00.000Z');
  });
});

describe('delayed', () => {
  const run = '2026-11-25T16:00:00Z';
  it('20 minutes while open', () => { expect(isDelayed(run, at('2026-11-25T16:20:00Z'))).toBe(false); expect(isDelayed(run, at('2026-11-25T16:20:01Z'))).toBe(true); });
  it('45 minutes while closed', () => { const r = '2026-11-26T16:00:00Z'; expect(isDelayed(r, at('2026-11-26T16:45:00Z'))).toBe(false); expect(isDelayed(r, at('2026-11-26T16:45:01Z'))).toBe(true); });
  it('the first 20 minutes after the open keep the closed-market limit', () => { expect(isDelayed('2026-11-25T14:00:00Z', at('2026-11-25T14:40:00Z'))).toBe(false); expect(isDelayed('2026-11-25T14:00:00Z', at('2026-11-25T14:51:00Z'))).toBe(true); });
  it('no run yet is not delayed', () => expect(isDelayed(null, at(run))).toBe(false));
});
