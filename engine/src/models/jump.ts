import { dexp, dsqrt } from '../math';
import { allocOut, DAYS, DN_DAYS, type SimContext, type SimOut } from './common';

/** Merton jump-diffusion, sampled exactly per horizon interval. */
export function simulateJump(ctx: SimContext): SimOut {
  const { n, rng, logSpot, calib } = ctx;
  const out = allocOut(n, false);
  const { lambda, muJ, sdJ, sigmaD } = calib.jump;
  const k = dexp(muJ + 0.5 * sdJ * sdJ) - 1; // jump compensator
  const drift = calib.mu - 0.5 * sigmaD * sigmaD - lambda * k;
  const gaps = [1, 4, 16];
  const terms = out.term;
  if (ctx.touch) {
    const tc = ctx.touch;
    for (let i = 0; i < n; i++) {
      let x = logSpot, hi = -Infinity, lo = Infinity;
      for (let d = 0; d < DAYS; d++) {
        x += drift + sigmaD * rng.normal();
        const nj = rng.poisson(lambda);
        if (nj > 0) x += nj * muJ + sdJ * dsqrt(nj) * rng.normal();
        if (x > hi) hi = x;
        if (d < DN_DAYS && x < lo) lo = x;
        if (d === 0) terms[0][i] = x;
        else if (d === 4) terms[1][i] = x;
      }
      terms[2][i] = x;
      if (hi > tc.up) tc.upHits++;
      if (lo <= tc.dn) tc.dnHits++;
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    let x = logSpot;
    for (let h = 0; h < 3; h++) {
      const g = gaps[h];
      x += drift * g + sigmaD * dsqrt(g) * rng.normal();
      const nj = rng.poisson(lambda * g);
      if (nj > 0) x += nj * muJ + sdJ * dsqrt(nj) * rng.normal();
      terms[h][i] = x;
    }
  }
  return out;
}
