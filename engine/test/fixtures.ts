import { Rng } from '../src/rng';
import { dexp } from '../src/math';
import type { EngineInputs } from '../src/types';

/** Deterministic synthetic price history (GBM with a few crashes). */
export function syntheticCloses(n = 756, seed = '0123456789abcdef', start = 100): number[] {
  const rng = new Rng(seed, 99);
  const closes = [start];
  for (let i = 1; i < n; i++) {
    let r = 0.0006 + 0.025 * rng.normal();
    if (i % 97 === 0) r -= 0.12;
    closes.push(closes[i - 1] * dexp(r));
  }
  return closes;
}

export function baseInputs(over: Partial<EngineInputs> = {}): EngineInputs {
  const closes = syntheticCloses();
  return {
    version: 1,
    asOf: '2026-11-22T20:00:00.000Z',
    spot: closes[closes.length - 1],
    priceSource: 'stock',
    closes,
    newsIntensity: 0.3,
    preCrisisLevel: closes[closes.length - 30],
    tokenPremium: 0.01,
    ...over,
  };
}
