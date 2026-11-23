import { describe, expect, it } from 'vitest';
import { allowedNumbers, extractNumbers, guardText, briefingText } from '../src/agent/guards';
import { runFacts, templatedBriefing } from '../src/agent/briefing';
import { initialDesk, stepDesk, deskHash, markToMarket } from '../src/desk/desk';
import { fingerprintHash } from '../src/proof/fingerprint';
import { priceFromSqrtX96 } from '../src/data/chainToken';
import { sessionAt, addTradingDays, nextOpen, lastCloseDate } from '../src/session';
import { newsIntensity } from '../src/agent/triage';
import { runScenarios, deriveSeed } from '../../engine/src/index';
import { baseInputs } from '../../engine/test/fixtures';

const inputs = baseInputs();
const out = runScenarios(inputs, deriveSeed(inputs), { pathsPerModel: 5000 });

describe('briefing guards', () => {
  const facts = runFacts(out)!;
  const allowed = allowedNumbers(facts);

  it('extracts numbers in many formats', () => {
    expect(extractNumbers('$1,234.56 and 47% then -3.2, 1M paths, 200K, Q3')).toEqual([1234.56, 47, 3.2, 1e6, 200000]);
  });
  it('accepts a briefing that only uses run numbers', () => {
    const b = templatedBriefing(out, []);
    const g = guardText(briefingText(b), allowed);
    expect(g.badNumbers).toEqual([]);
    expect(g.ok).toBe(true);
  });
  it('rejects a number not in the RunOutput', () => {
    const g = guardText(`The median is $${facts.oneMonth.median} and odds of 73.4% look strong`, allowed);
    expect(g.ok).toBe(false);
    expect(g.badNumbers).toContain(73.4);
  });
  it('rejects banned words', () => {
    for (const s of ['This is fraud', 'Our prediction is up', 'Time to buy', 'a guaranteed bounce', 'sell now']) {
      expect(guardText(s, allowed).ok).toBe(false);
    }
    expect(guardText('Scenario odds shifted lower.', allowed).ok).toBe(true);
  });
});

describe('paper desk', () => {
  const base = { runId: 1, ts: '2026-11-23T15:00:00Z', marketOpen: true };
  it('follows the rules on a synthetic series', () => {
    let s = initialDesk('t0');
    // 1. high odds but crisis not falling -> no trade
    let r = stepDesk(s, { ...base, price: 100, pUp1w: 0.6, crisis: 50, prevCrisis: 50 });
    expect(r.trades).toHaveLength(0);
    s = r.state;
    // 2. high odds and falling crisis -> enter long with all cash
    r = stepDesk(s, { ...base, price: 100, pUp1w: 0.6, crisis: 45, prevCrisis: 50 });
    expect(r.trades[0].action).toBe('enter');
    expect(r.state.position!.qty).toBeCloseTo(1000, 6);
    expect(r.state.cash).toBeCloseTo(0, 6);
    s = r.state;
    // 3. price up, odds fine -> hold, equity marked
    r = stepDesk(s, { ...base, price: 110, pUp1w: 0.55, crisis: 44, prevCrisis: 45 });
    expect(r.trades).toHaveLength(0);
    expect(r.state.equity).toBeCloseTo(110000, 6);
    s = r.state;
    // 4. odds drop below 50% -> exit with profit
    r = stepDesk(s, { ...base, price: 108, pUp1w: 0.49, crisis: 44, prevCrisis: 44 });
    expect(r.trades[0].action).toBe('exit');
    expect(r.trades[0].pnl).toBeCloseTo(8000, 6);
    expect(r.state.wins).toBe(1);
    s = r.state;
    // 5. re-enter, then stop-loss at -8%
    r = stepDesk(s, { ...base, price: 100, pUp1w: 0.7, crisis: 40, prevCrisis: 44 });
    s = r.state;
    r = stepDesk(s, { ...base, price: 91.9, pUp1w: 0.7, crisis: 39, prevCrisis: 40 });
    expect(r.trades[0].reason).toMatch(/stop-loss/);
    expect(r.state.losses).toBe(1);
    expect(r.state.equity).toBeCloseTo(108000 * 0.919, 4);
    expect(r.state.maxDrawdown).toBeGreaterThan(0.08);
  });
  it('does not trade while the market is closed but still marks to market', () => {
    const s = initialDesk('t0');
    const r = stepDesk(s, { ...base, marketOpen: false, price: 100, pUp1w: 0.9, crisis: 10, prevCrisis: 50 });
    expect(r.trades).toHaveLength(0);
    expect(markToMarket(r.state, 100)).toBe(100000);
  });
  it('desk hash is stable', () => {
    const s = initialDesk('t0');
    expect(deskHash(s)).toBe(deskHash({ ...s }));
  });
});

describe('fingerprint', () => {
  it('is stable for the same hour data and changes when data changes', () => {
    const p = { hour: '2026-11-23T14:00:00.000Z', runIds: [1, 2], inputHashes: ['0xa', '0xb'], outputHashes: ['0xc', '0xd'], briefingHashes: ['0xe'], deskStateHash: '0xf' };
    expect(fingerprintHash(p)).toBe(fingerprintHash(JSON.parse(JSON.stringify(p))));
    expect(fingerprintHash(p)).not.toBe(fingerprintHash({ ...p, runIds: [1, 3] }));
    expect(fingerprintHash(p)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('chain price decoding', () => {
  it('decodes the live sample sqrtPriceX96', () => {
    expect(priceFromSqrtX96(BigInt('0x1532e363e8c134dbf455887dc0000'))).toBeCloseTo(132.635, 2);
  });
});

describe('NYSE session', () => {
  it('knows open, closed, weekends, holidays and early closes', () => {
    expect(sessionAt(new Date('2026-11-23T15:00:00Z'))).toBe('open'); // Mon 10:00 ET
    expect(sessionAt(new Date('2026-11-23T14:00:00Z'))).toBe('closed'); // 09:00 ET
    expect(sessionAt(new Date('2026-11-22T15:00:00Z'))).toBe('closed'); // Sunday
    expect(sessionAt(new Date('2026-11-26T15:00:00Z'))).toBe('closed'); // Thanksgiving
    expect(sessionAt(new Date('2026-11-27T18:30:00Z'))).toBe('closed'); // 13:30 ET early close
    expect(sessionAt(new Date('2026-11-27T17:30:00Z'))).toBe('open');
    expect(addTradingDays('2026-11-25', 1)).toBe('2026-11-27');
    expect(nextOpen(new Date('2026-11-22T20:00:00Z')).toISOString()).toBe('2026-11-23T14:30:00.000Z');
    expect(lastCloseDate(new Date('2026-11-22T20:00:00Z'))).toBe('2026-11-20');
  });
});

describe('news intensity', () => {
  it('is bounded and decays', () => {
    const now = new Date('2026-11-23T12:00:00Z');
    const fresh = [{ ts: '2026-11-23T11:30:00Z', score: 0.9, relevant: 1 }];
    const old = [{ ts: '2026-11-22T20:00:00Z', score: 0.9, relevant: 1 }];
    expect(newsIntensity(fresh, now)).toBeGreaterThan(newsIntensity(old, now));
    expect(newsIntensity(Array(50).fill(fresh[0]), now)).toBe(1);
  });
});
