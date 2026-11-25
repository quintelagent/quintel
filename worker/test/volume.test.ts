import { afterEach, describe, expect, it, vi } from 'vitest';
import { poolVolume } from '../src/data/chainToken';

const POOL = '0xAbC0000000000000000000000000000000000001', NOW = new Date('2026-11-25T15:00:00Z');
const answer = (body: unknown, status = 200) => vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status }));
const pair = (p: object = {}) => ({ pairs: [{ pairAddress: POOL.toLowerCase(), baseToken: { symbol: 'NVDA' }, volume: { h24: 10_013_967.4 }, ...p }] });
afterEach(() => vi.unstubAllGlobals());

describe('24-hour token volume', () => {
  it('is read for the one pool, rounded, with its time', async () => {
    answer(pair()); expect(await poolVolume(POOL, NOW)).toEqual({ ts: NOW.toISOString(), usd24h: 10_013_967, scope: 'pool', source: 'dexscreener' });
  });
  it('zero is a real answer', async () => { answer(pair({ volume: { h24: 0 } })); expect((await poolVolume(POOL, NOW)).usd24h).toBe(0); });
  it('a rate limit is an error, not a number', async () => { answer({}, 429); await expect(poolVolume(POOL, NOW)).rejects.toThrow('HTTP 429'); });
  it.each([['another pool', { pairAddress: '0x02' }], ['another token', { baseToken: { symbol: 'TSLA' } }], ['no volume', { volume: {} }], ['a negative volume', { volume: { h24: -1 } }]])('%s is refused', async (_, p) => {
    answer(pair(p)); await expect(poolVolume(POOL, NOW)).rejects.toThrow('no pool volume');
  });
});
