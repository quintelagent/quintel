import type { Calibration } from '../types';
import type { Rng } from '../rng';

export const HORIZONS = [1, 5, 21] as const;
export const DAYS = 21;
/** days in which the give-back level may be touched (1 week) */
export const DN_DAYS = 5;

export interface SimContext {
  spot: number;
  logSpot: number;
  calib: Calibration;
  /** historical daily log returns (for bootstrap) */
  returns: Float64Array;
  /** log of the slow moving average (for mean reversion) */
  logMa: number;
  n: number;
  rng: Rng;
  /** v2: log-price levels; simulators count paths that close beyond them */
  touch?: { up: number; dn: number; upHits: number; dnHits: number };
}

export interface SimOut {
  /** terminal LOG prices per horizon, each length n */
  term: [Float64Array, Float64Array, Float64Array];
  /** max drawdown in log space per path (path models only) */
  dd: Float64Array | null;
}

export function allocOut(n: number, withDD: boolean): SimOut {
  return {
    term: [new Float64Array(n), new Float64Array(n), new Float64Array(n)],
    dd: withDD ? new Float64Array(n) : null,
  };
}

/** Plain-English one-liners (also used on the site and in METHODOLOGY.md). */
export const MODEL_INFO: Record<string, { name: string; oneLiner: string }> = {
  gbm: { name: 'Random walk', oneLiner: 'Price drifts with today’s volatility and no memory — the textbook baseline.' },
  jump: { name: 'Jump', oneLiner: 'Random walk plus sudden gaps, sized from past big moves and amplified when the news is loud.' },
  bootstrap: { name: 'History replay', oneLiner: 'Replays real past weeks of returns in random order — no bell-curve assumptions.' },
  garch: { name: 'Vol clusters', oneLiner: 'Calm follows calm and storms follow storms: volatility reacts to every big day.' },
  meanrev: { name: 'Bounce', oneLiner: 'Price is pulled back toward its slow moving average — captures oversold bounces.' },
};
