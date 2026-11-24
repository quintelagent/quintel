import { allocOut, DAYS, DN_DAYS, type SimContext, type SimOut } from './common';

/**
 * Ornstein–Uhlenbeck on the log-price deviation from a slow moving average.
 * The average itself drifts with mu; the deviation decays at rate phi per day.
 */
export function simulateMeanRev(ctx: SimContext): SimOut {
  const { n, rng, logSpot, logMa, calib } = ctx;
  const out = allocOut(n, true);
  const { phi, sigma } = calib.ou;
  const mu = calib.mu;
  const d0 = logSpot - logMa;
  const [t1, t5, t21] = out.term;
  const dd = out.dd!;
  const tc = ctx.touch;
  for (let i = 0; i < n; i++) {
    let m = logMa;
    let dev = d0;
    let peak = logSpot;
    let mdd = 0;
    let hi = -Infinity, lo = Infinity;
    let x = logSpot;
    for (let d = 0; d < DAYS; d++) {
      m += mu;
      dev = phi * dev + sigma * rng.normal();
      x = m + dev;
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
