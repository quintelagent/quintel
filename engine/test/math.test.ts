import { describe, expect, it } from 'vitest';
import { dexp, dlog } from '../src/math';
import { keccak256, canonical } from '../src/hash';
import { Rng } from '../src/rng';

describe('deterministic math', () => {
  it('dlog/dexp match Math within 1 ulp-ish over a wide range', () => {
    const rng = new Rng('ffffffffffffffff');
    for (let i = 0; i < 20000; i++) {
      const x = (rng.uniform() - 0.5) * 60;
      const e = dexp(x);
      expect(Math.abs(e - Math.exp(x)) / Math.exp(x)).toBeLessThan(1e-15);
      const y = rng.uniform() * 1e4 + 1e-9;
      expect(Math.abs(dlog(y) - Math.log(y))).toBeLessThan(1e-14 * Math.max(1, Math.abs(Math.log(y))));
    }
    expect(dexp(0)).toBe(1);
    expect(dlog(1)).toBe(0);
    expect(dlog(0)).toBe(-Infinity);
    expect(Number.isNaN(dlog(-1))).toBe(true);
    expect(dexp(1000)).toBe(Infinity);
    expect(dexp(-1000)).toBe(0);
    expect(dlog(1e-310)).toBeCloseTo(Math.log(1e-310), 10);
  });
});

describe('keccak256', () => {
  it('matches known vectors', () => {
    expect(keccak256('')).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    expect(keccak256('abc')).toBe('0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
    // multi-block input (> 136 bytes)
    const long = 'a'.repeat(300);
    expect(keccak256(long)).toBe(keccak256(new TextEncoder().encode(long)));
  });
  it('canonical JSON sorts keys and strips -0', () => {
    expect(canonical({ b: 1, a: [1, -0, 'x'], c: { z: true, y: null } })).toBe('{"a":[1,0,"x"],"b":1,"c":{"y":null,"z":true}}');
  });
});

describe('rng', () => {
  it('normal sampler has mean≈0, var≈1', () => {
    const rng = new Rng('0011223344556677');
    let s = 0, s2 = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) { const z = rng.normal(); s += z; s2 += z * z; }
    expect(Math.abs(s / n)).toBeLessThan(0.01);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.01);
  });
  it('poisson mean≈lambda', () => {
    const rng = new Rng('0011223344556677');
    let s = 0;
    for (let i = 0; i < 100000; i++) s += rng.poisson(0.7);
    expect(Math.abs(s / 100000 - 0.7)).toBeLessThan(0.01);
  });
});
