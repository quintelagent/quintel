import { describe, expect, it } from 'vitest';
import { addr, ago, countdown, etDate, etTime, odds, pct, pctChange, pts, usd, usdChange, usdShort } from '../src/lib/format';

// SYSTEM.md section 8
describe('numbers', () => {
  it('missing values are a dash, never NaN', () => {
    for (const f of [usd, usdShort, usdChange, pct, odds, pctChange, pts]) for (const x of [null, undefined, NaN, Infinity]) expect(f(x)).toBe('—');
  });
  it('prices', () => { expect(usd(186.64)).toBe('$186.64'); expect(usd(-1.5)).toBe('−$1.50'); expect(usdShort(1_200_000)).toBe('$1.2M'); });
  it('odds never read as certainty', () => {
    expect([0, 0.0009, 0.001, 0.612, 0.999, 0.9991, 1].map(odds)).toEqual(['<0.1%', '<0.1%', '0.1%', '61.2%', '99.9%', '>99.9%', '>99.9%']);
  });
  it('changes carry a sign, and zero does not', () => {
    expect([usdChange(1.42), usdChange(-1.42), usdChange(0)]).toEqual(['+$1.42', '−$1.42', '$0.00']);
    expect([pts(0.004), pts(-0.004), pts(0)]).toEqual(['+0.4 pts', '−0.4 pts', '0.0 pts']);
    expect([pctChange(0.008), pctChange(-0.008), pctChange(-0.0001)]).toEqual(['+0.8%', '−0.8%', '0.0%']);
    expect(pct(-0.0001)).toBe('0.0%');
  });
});

describe('time', () => {
  it('is Eastern, before and after the clocks change', () => { expect(etTime('2026-11-25T15:40:00Z')).toBe('10:40am ET'); expect(etTime('2026-10-28T14:40:00Z')).toBe('10:40am ET'); expect(etTime('not a date')).toBe('—'); });
  it('computes the weekday, and a bare date is an ET date', () => { expect(etDate('2026-12-01')).toBe('Tue, Dec 1'); expect(etDate('2026-12-01T03:00:00Z')).toBe('Mon, Nov 30'); });
  it('countdowns', () => { expect([((38 * 60 + 22) * 60_000), 14 * 3600_000 + 22 * 60_000, 42 * 60_000 + 10_000, -5].map(countdown)).toEqual(['1d 14h 22m', '14h 22m', '42:10', '00:00']); });
  it('ages', () => { const n = Date.parse('2026-11-25T15:00:00Z'); expect([20_000, 120_000, 3 * 3600_000, 50 * 3600_000].map((ms) => ago(new Date(n - ms), n))).toEqual(['just now', '2 min ago', '3h ago', '2d ago']); });
});

it('addresses are shortened', () => { expect(addr('0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47')).toBe('0xdF…47'); expect(addr(null)).toBe('—'); });
