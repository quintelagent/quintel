import { dexp, dsqrt } from '../math';
import { allocOut, type SimContext, type SimOut } from './common';

/** Merton jump-diffusion, sampled exactly per horizon interval. */
export function simulateJump(ctx: SimContext): SimOut {
  const { n, rng, logSpot, calib } = ctx;
  const out = allocOut(n, false);
  const { lambda, muJ, sdJ, sigmaD } = calib.jump;
  const k = dexp(muJ + 0.5 * sdJ * sdJ) - 1; // jump compensator
  const drift = calib.mu - 0.5 * sigmaD * sigmaD - lambda * k;
  const gaps = [1, 4, 16];
  const terms = out.term;
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
