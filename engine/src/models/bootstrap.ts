import { allocOut, DAYS, DN_DAYS, type SimContext, type SimOut } from './common';

export const BLOCK = 5;

/**
 * Block bootstrap of real daily returns (block size 5). Shocks, if any, shift the
 * drift and scale deviations from the sample mean; with no shock every daily step
 * is an actual historical return.
 */
export function simulateBootstrap(ctx: SimContext, onDraw?: (r: number) => void): SimOut {
  const { n, rng, logSpot, returns, calib } = ctx;
  const out = allocOut(n, true);
  const m = returns.length;
  let mean = 0;
  for (let i = 0; i < m; i++) mean += returns[i];
  mean /= m;
  // calib.sigma already includes volMult; recover the multiplier relative to unshocked
  const volMult = calib.volMult;
  const driftAdj = calib.driftShockDaily;
  const pure = volMult === 1 && driftAdj === 0;
  const [t1, t5, t21] = out.term;
  const dd = out.dd!;
  const tc = ctx.touch;
  for (let i = 0; i < n; i++) {
    let x = logSpot;
    let peak = x;
    let mdd = 0;
    let hi = -Infinity, lo = Infinity;
    let start = 0;
    for (let d = 0; d < DAYS; d++) {
      if (d % BLOCK === 0) start = rng.int(m - BLOCK + 1);
      const raw = returns[start + (d % BLOCK)];
      if (onDraw) onDraw(raw);
      x += pure ? raw : mean + (raw - mean) * volMult + driftAdj;
      if (x > hi) hi = x;
      if (d < DN_DAYS && x < lo) lo = x;
      if (x > peak) peak = x;
      else if (peak - x > mdd) mdd = peak - x;
      if (d === 0) t1[i] = x;
      else if (d === 4) t5[i] = x;
    }
    t21[i] = x;
    dd[i] = mdd;
    if (tc) {
      if (hi > tc.up) tc.upHits++;
      if (lo <= tc.dn) tc.dnHits++;
    }
  }
  return out;
}
