import { beforeEach, describe, expect, it } from 'vitest';
import { cachedBody, resetCache, type Store } from '../src/cache';

const P = { fresh: 20, swr: 60 };
let t = 1e9; const now = () => t;
const bg: Promise<unknown>[] = []; const wu = (x: Promise<unknown>) => { bg.push(x); };
const settle = async () => { while (bg.length) await bg.shift(); };
const loader = (fail = () => false) => { const l: any = async () => { l.n++; const v = `v${l.n}`; await new Promise((r) => setTimeout(r, 5)); if (fail()) throw new Error('D1 overloaded'); return v; }; l.n = 0; return l; };
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
    down = false; expect(await cachedBody('k', P, l, wu, null, now)).toMatch(/^v/);
  });
  it('a failed refresh does not block the next one', async () => {
    let down = true; const l = loader(() => down);
    await expect(cachedBody('k', P, l, wu, null, now)).rejects.toThrow(); down = false;
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
});
