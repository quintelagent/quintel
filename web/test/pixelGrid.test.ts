import { describe, expect, it } from 'vitest';
import { count, createCells, filledCells, futuresPerPixel, keptCells, moveToward, MOVE_TICKS, shimmer } from '../src/lib/pixelGrid';

const rng = (a: number) => () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('PixelField grid', () => {
  for (const n of [24, 64, 100]) for (const kept of [0, 0.001, 0.5, 0.612, 0.999, 1]) {
    it(`${n}×${n} at ${kept}: exact counts, and the shimmer never changes them`, () => {
      const r = rng(n), c = createCells(n, kept, r), k = keptCells(n, kept), f = filledCells(n);
      const check = () => { expect(count(c, 1)).toBe(k); expect(count(c, 2)).toBe(f - k); expect(count(c, 0)).toBe(n * n - f); };
      check();
      for (let i = 0; i < 50; i++) shimmer(c, r, () => {});
      check();
    });
  }
  it('reaches the exact new split in MOVE_TICKS while shimmering, both ways', () => {
    for (const [a, b] of [[0.612, 0.55], [0.3, 0.9], [0.5, 0.5004], [1, 0]]) {
      const n = 64, r = rng(7), c = createCells(n, a, r), target = keptCells(n, b);
      for (let left = MOVE_TICKS; left > 0; left--) { moveToward(c, target, left, r, () => {}); shimmer(c, r, () => {}); }
      expect(count(c, 1)).toBe(target);
      expect(count(c, 0)).toBe(n * n - filledCells(n));
    }
  });
  it('draws every changed cell', () => {
    const r = rng(3), c = createCells(64, 0.6, r), view = c.slice();
    for (let i = 0; i < 20; i++) { moveToward(c, keptCells(64, 0.4), 20 - i, r, (k) => { view[k] = c[k]; }); shimmer(c, r, (k) => { view[k] = c[k]; }); }
    expect([...view]).toEqual([...c]);
  });
  it('is scattered: red share is even across the halves and quarters of the grid', () => {
    const n = 100, c = createCells(n, 0.7, rng(84));
    const share = (f: (x: number, y: number) => boolean) => { let red = 0, all = 0; c.forEach((v, i) => { if (v && f(i % n, Math.floor(i / n))) { all++; if (v === 2) red++; } }); return red / all; };
    for (const f of [(_: number, y: number) => y < 50, (_: number, y: number) => y >= 50, (x: number) => x < 50, (x: number) => x >= 50, (x: number, y: number) => x < 25 && y < 25]) expect(Math.abs(share(f) - 0.3)).toBeLessThan(0.05);
  });
  it('futures per pixel', () => { expect(futuresPerPixel(64)).toBe(287); expect(futuresPerPixel(100)).toBe(118); });
});
