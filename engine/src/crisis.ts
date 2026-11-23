import { clamp01, r6 } from './math';
import type { CrisisOut } from './types';

/** Public weights for the Crisis Level (sum to 1). */
export const CRISIS_WEIGHTS = { vol: 0.35, tail: 0.3, news: 0.2, chain: 0.15 } as const;

export interface CrisisInputs {
  /** current 20d realised vol ÷ its 1-year median */
  volRatio: number;
  /** combined P(down > 20% within 1 month) */
  pDown20_1m: number;
  /** 0–1 from news triage */
  newsIntensity: number;
  /** (chain − stock)/stock */
  tokenPremium: number;
}

/**
 * Crisis Level 0–100.
 * vol:   0 at ratio ≤ 0.8, 1 at ratio ≥ 2.5
 * tail:  0 at 0%, 1 at ≥ 25% chance of a 20% drop in a month
 * news:  news intensity as-is
 * chain: 0 at no gap, 1 at ≥ 5% gap between token and stock (either side)
 */
export function crisisLevel(c: CrisisInputs): CrisisOut {
  const components = {
    vol: clamp01((c.volRatio - 0.8) / 1.7),
    tail: clamp01(c.pDown20_1m / 0.25),
    news: clamp01(c.newsIntensity),
    chain: clamp01(Math.abs(c.tokenPremium) / 0.05),
  };
  const w = CRISIS_WEIGHTS;
  const raw = w.vol * components.vol + w.tail * components.tail + w.news * components.news + w.chain * components.chain;
  return {
    level: Math.round(100 * clamp01(raw)),
    components: {
      vol: r6(components.vol),
      tail: r6(components.tail),
      news: r6(components.news),
      chain: r6(components.chain),
    },
    weights: { ...w },
  };
}
