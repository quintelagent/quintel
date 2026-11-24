import { dsqrt } from '../math';
import { allocOut, DAYS, DN_DAYS, type SimContext, type SimOut } from './common';

/** GBM sampled exactly at each horizon via independent increments (1d, +4d, +16d). */
export function simulateGbm(ctx: SimContext): SimOut {
  const { n, rng, logSpot, calib } = ctx;
  const out = allocOut(n, false);
  const s = calib.sigma;
  const drift = calib.mu - 0.5 * s * s;
  const gaps = [1, 4, 16];
  const sq = gaps.map((g) => s * dsqrt(g));
  const [t1, t5, t21] = out.term;
  if (ctx.touch) {
    const tc = ctx.touch;
    for (let i = 0; i < n; i++) {
      let x = logSpot, hi = -Infinity, lo = Infinity;
      for (let d = 0; d < DAYS; d++) {
        x += drift + s * rng.normal();
        if (x > hi) hi = x;
        if (d < DN_DAYS && x < lo) lo = x;
        if (d === 0) t1[i] = x;
        else if (d === 4) t5[i] = x;
      }
      t21[i] = x;
      if (hi > tc.up) tc.upHits++;
      if (lo <= tc.dn) tc.dnHits++;
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    let x = logSpot + drift * gaps[0] + sq[0] * rng.normal();
    t1[i] = x;
    x += drift * gaps[1] + sq[1] * rng.normal();
    t5[i] = x;
    x += drift * gaps[2] + sq[2] * rng.normal();
    t21[i] = x;
  }
  return out;
}
