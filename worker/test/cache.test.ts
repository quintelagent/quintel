import { beforeEach, describe, expect, it } from 'vitest';
import { cachedBody, resetCache, type Store } from '../src/cache';

const P = { fresh: 20, swr: 60 };
let t = 1e9; const now = () => t;
const bg: Promise<unknown>[] = []; const wu = (x: Promise<unknown>) => { bg.push(x); };
const settle = async () => { while (bg.length) await bg.shift(); };
const loader = (fail = () => false, ms = 5) => { const l: any = async () => { l.n++; const v = `v${l.n}`; await new Promise((r) => setTimeout(r, ms)); if (fail()) throw new Error('D1 overloaded'); return v; }; l.n = 0; return l; };
const memStore = (): Store & { m: Map<string, any> } => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, e) => { m.set(k, e); } }; };

describe('api cache', () => {
  beforeEach(() => { resetCache(); t = 1e9; });
  it('fresh copies never touch the database', async () => {
    const l = loader();
    expect(await cachedBody('k', P, l, wu, null, now)).toBe('v1');
    t += 19_000; for (let i = 0; i < 500; i++) expect(await cachedBody('k', P, l, wu, null, now)).toBe('v1');
    expect(l.n).toBe(1);
  });
  it('when a copy expires, 500 visitors get the old one and one request refreshes', async () => {
    const l = loader(); await cachedBody('k', P, l, wu, null, now); t += 30_000;
    const all = await Promise.all(Array.from({ length: 500 }, () => cachedBody('k', P, l, wu, null, now)));
    expect(new Set(all)).toEqual(new Set(['v1'])); await settle();
    expect(l.n).toBe(2); expect(await cachedBody('k', P, l, wu, null, now)).toBe('v2');
  });
  it('a cold start of 500 loads once', async () => {
    const l = loader(); const all = await Promise.all(Array.from({ length: 500 }, () => cachedBody('k', P, l, wu, null, now)));
    expect(l.n).toBe(1); expect(new Set(all)).toEqual(new Set(['v1']));
  });
  it('database failing: old copy for up to an hour, then the error', async () => {
    let down = false; const l = loader(() => down); await cachedBody('k', P, l, wu, null, now); down = true;
    t += 30_000; expect(await cachedBody('k', P, l, wu, null, now)).toBe('v1'); await settle();
    t += 600_000; expect(await cachedBody('k', P, l, wu, null, now)).toBe('v1');
    t += 3600_000; await expect(cachedBody('k', P, l, wu, null, now)).rejects.toThrow('overloaded');
    down = false; t += 4000; expect(await cachedBody('k', P, l, wu, null, now)).toMatch(/^v/);
  });
  it('a failed refresh does not block the next one', async () => {
    let down = true; const l = loader(() => down);
    await expect(cachedBody('k', P, l, wu, null, now)).rejects.toThrow(); down = false; t += 4000;
    expect(await cachedBody('k', P, l, wu, null, now)).toBe('v2');
  });
  it('another isolate reuses the shared copy', async () => {
    const s = memStore(), l = loader(); await cachedBody('k', P, l, wu, s, now); await settle(); resetCache(); t += 5000;
    expect(await cachedBody('k', P, l, wu, s, now)).toBe('v1'); expect(l.n).toBe(1);
  });
  it('a broken shared store is ignored', async () => {
    const s: Store = { get: async () => { throw new Error('x'); }, put: async () => { throw new Error('x'); } };
    expect(await cachedBody('k', P, loader(), wu, s, now)).toBe('v1'); await settle();
  });
  it('not found is never cached', async () => { let n = 0; const l = async () => { n++; return null; }; await cachedBody('k', P, l, wu, null, now); expect(await cachedBody('k', P, l, wu, null, now)).toBe(null); expect(n).toBe(2); });
  it('slow database on a cold start: still one load for 500 visitors', async () => {
    const l = loader(() => false, 900), all = await Promise.all(Array.from({ length: 500 }, () => cachedBody('k', P, l, wu, null, now)));
    expect(l.n).toBe(1); expect(new Set(all)).toEqual(new Set(['v1']));
  });
  it('database down with an older copy: 500 visitors, one load, everyone served at once', async () => {
    let down = false; const l = loader(() => down, 300); await cachedBody('k', P, l, wu, null, now); down = true; t += 600_000;
    const t0 = Date.now(), all = await Promise.all(Array.from({ length: 500 }, () => cachedBody('k', P, l, wu, null, now)));
    expect(l.n).toBe(2); expect(new Set(all)).toEqual(new Set(['v1'])); expect(Date.now() - t0).toBeLessThan(700);
    for (let i = 0; i < 50; i++) await cachedBody('k', P, l, wu, null, now); // resting
    expect(l.n).toBe(2);
  });
  it('database down and nothing cached: one load, the rest are told to come back', async () => {
    const l = loader(() => true, 50), r = await Promise.allSettled(Array.from({ length: 200 }, () => cachedBody('k', P, l, wu, null, now)));
    expect(l.n).toBe(1); expect(r.every((x) => x.status === 'rejected')).toBe(true);
  }, 15000);
  it('no stand-in copy when keep is 0 (health)', async () => {
    let down = false; const l = loader(() => down), H = { fresh: 5, swr: 0, keep: 0 }; await cachedBody('h', H, l, wu, null, now); down = true; t += 6000;
    await expect(cachedBody('h', H, l, wu, null, now)).rejects.toThrow();
  });
  it('an older shared copy never replaces a newer one', async () => {
    const s = memStore(), l = loader(); await cachedBody('k', P, l, wu, s, now); await settle(); const old = s.m.get('k');
    t += 30_000; await cachedBody('k', P, l, wu, s, now); await settle(); s.m.set('k', old); t += 1000;
    expect(await cachedBody('k', P, l, wu, s, now)).toBe('v2');
  });
  it('memory stays bounded', async () => { for (let i = 0; i < 40; i++) await cachedBody('b' + i, P, async () => 'x'.repeat(500_000), wu, null, now); let n = 0; await cachedBody('b0', P, async () => { n++; return 'y'; }, wu, null, now); expect(n).toBe(1); });
});
