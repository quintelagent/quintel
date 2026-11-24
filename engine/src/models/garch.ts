import { dsqrt } from '../math';
import { allocOut, DAYS, DN_DAYS, type SimContext, type SimOut } from './common';

/** GARCH(1,1) path simulation from the last fitted conditional variance. */
export function simulateGarch(ctx: SimContext): SimOut {
  const { n, rng, logSpot, calib } = ctx;
  const out = allocOut(n, true);
  const { omega, alpha, beta, h0 } = calib.garch;
  const mu = calib.mu;
  const volMult2 = (calib.volMult) * (calib.volMult);
  const [t1, t5, t21] = out.term;
  const dd = out.dd!;
  const tc = ctx.touch;
  for (let i = 0; i < n; i++) {
    let x = logSpot;
    let peak = x;
    let mdd = 0;
    let hi = -Infinity, lo = Infinity;
    let h = h0;
    for (let d = 0; d < DAYS; d++) {
      const e = dsqrt(h) * rng.normal();
      x += mu - 0.5 * h + e;
      h = omega * volMult2 + alpha * e * e + beta * h;
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
