import { dexp, dlog, dsqrt } from './math';
import type { Calibration, EngineInputs } from './types';

export function logReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) r.push(dlog(closes[i] / closes[i - 1]));
  return r;
}

function mean(a: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length ? s / a.length : 0;
}

function variance(a: number[]): number {
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
  return a.length > 1 ? s / (a.length - 1) : 0;
}

function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  if (!n) return 0;
  return n % 2 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2]);
}

/** EWMA (RiskMetrics, λ=0.94) daily volatility. */
export function ewmaVol(r: number[], lambda = 0.94): number {
  if (!r.length) return 0.02;
  let v = variance(r.slice(0, Math.min(30, r.length))) || r[0] * r[0];
  for (let i = 0; i < r.length; i++) v = lambda * v + (1 - lambda) * r[i] * r[i];
  return dsqrt(v);
}

/** Negative GARCH(1,1) log-likelihood (Gaussian, constants dropped). */
export function garchNll(r: number[], omega: number, alpha: number, beta: number): number {
  if (!(omega > 0) || alpha < 0 || beta < 0 || alpha + beta >= 0.999) return Infinity;
  let h = variance(r);
  let nll = 0;
  for (let i = 0; i < r.length; i++) {
    nll += dlog(h) + (r[i] * r[i]) / h;
    h = omega + alpha * r[i] * r[i] + beta * h;
  }
  return nll;
}

/** Deterministic Nelder–Mead minimiser (fixed iteration count). */
export function nelderMead(f: (x: number[]) => number, x0: number[], step: number[], iters = 400): number[] {
  const n = x0.length;
  let simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += step[i];
    simplex.push(p);
  }
  let vals = simplex.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b] || a - b);
    simplex = idx.map((i) => simplex[i]);
    vals = idx.map((i) => vals[i]);
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const worst = simplex[n];
    const xr = c.map((cj, j) => cj + (cj - worst[j]));
    const fr = f(xr);
    if (fr < vals[0]) {
      const xe = c.map((cj, j) => cj + 2 * (cj - worst[j]));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) {
      simplex[n] = xr; vals[n] = fr;
    } else {
      const xc = c.map((cj, j) => cj + 0.5 * (worst[j] - cj));
      const fc = f(xc);
      if (fc < vals[n]) {
        simplex[n] = xc; vals[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
          vals[i] = f(simplex[i]);
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i <= n; i++) if (vals[i] < vals[best]) best = i;
  return simplex[best];
}

export function fitGarch(rRaw: number[]) {
  const m = mean(rRaw);
  const r = rRaw.map((x) => x - m);
  const v = variance(r);
  // Optimise in scaled space: omega = w * v * 1e-2
  const f = (p: number[]) => garchNll(r, p[0] * v * 0.01, p[1], p[2]);
  let [w, alpha, beta] = nelderMead(f, [2, 0.08, 0.9], [1, 0.03, 0.03]);
  let omega = w * v * 0.01;
  if (!Number.isFinite(f([w, alpha, beta])) || alpha + beta >= 0.999) {
    alpha = 0.08; beta = 0.9; omega = v * 0.02;
  }
  // final conditional variance
  let h = v;
  for (let i = 0; i < r.length; i++) h = omega + alpha * r[i] * r[i] + beta * h;
  return { omega, alpha, beta, h0: h };
}

export function sma(closes: number[], end: number, window: number): number {
  const start = Math.max(0, end - window + 1);
  let s = 0;
  for (let i = start; i <= end; i++) s += closes[i];
  return s / (end - start + 1);
}

export function calibrate(inp: EngineInputs): Calibration {
  const closes = inp.closes;
  const r = logReturns(closes);
  const r1y = r.slice(-252);
  const shock = inp.shock ?? { drift: 0, jumpMult: 1, volMult: 1 };

  let sigma = ewmaVol(r);
  if (inp.intradayVol && inp.intradayVol > 0) sigma = 0.5 * sigma + 0.5 * (inp.intradayVol / dsqrt(252));
  // Long-run drift, shrunk 50% toward zero (historical drift is a noisy estimate).
  const mu = 0.5 * mean(r1y) + shock.drift / 21;

  // Realised vol vs its 1-year median (rolling 20d).
  const rolling: number[] = [];
  for (let i = Math.max(20, r.length - 252); i <= r.length; i++) rolling.push(dsqrt(variance(r.slice(i - 20, i))));
  const curVol = dsqrt(variance(r.slice(-20)));
  const med = median(rolling) || curVol || 1;
  const volRatio = curVol / med;

  // Merton jumps: returns beyond 3 sd of the full sample.
  const sd = dsqrt(variance(r));
  const jumps = r.filter((x) => Math.abs(x - mean(r)) > 3 * sd);
  let lambda = jumps.length / Math.max(1, r.length);
  let muJ = mean(jumps);
  let sdJ = dsqrt(variance(jumps));
  if (jumps.length < 3) { lambda = 2 / 252; muJ = -0.02; sdJ = 0.08; }
  if (!(sdJ > 0)) sdJ = Math.abs(muJ) || 0.05;
  lambda = lambda * (1 + 2 * inp.newsIntensity) * shock.jumpMult;
  const sigmaD = dsqrt(Math.max(sigma * sigma - (jumps.length / Math.max(1, r.length)) * (muJ * muJ + sdJ * sdJ), 0.25 * sigma * sigma));

  const g = fitGarch(r.slice(-756));

  // OU on log-price deviation from a 50-day SMA, fitted as AR(1).
  const maWindow = 50;
  const d: number[] = [];
  for (let i = maWindow; i < closes.length; i++) d.push(dlog(closes[i]) - dlog(sma(closes, i, maWindow)));
  let sxy = 0, sxx = 0;
  for (let i = 1; i < d.length; i++) { sxy += d[i] * d[i - 1]; sxx += d[i - 1] * d[i - 1]; }
  let phi = sxx > 0 ? sxy / sxx : 0.95;
  phi = Math.min(0.995, Math.max(0.5, phi));
  const resid: number[] = [];
  for (let i = 1; i < d.length; i++) resid.push(d[i] - phi * d[i - 1]);
  const ouSigma = dsqrt(variance(resid)) || sigma;
  const d0 = d.length ? d[d.length - 1] : 0;

  return {
    mu,
    volMult: shock.volMult,
    driftShockDaily: shock.drift / 21,
    logMa: dlog(sma(closes, closes.length - 1, maWindow)),
    sigma: sigma * shock.volMult,
    annVol: sigma * dsqrt(252),
    volRatio,
    jump: { lambda, muJ, sdJ, sigmaD: sigmaD * shock.volMult },
    garch: { omega: g.omega, alpha: g.alpha, beta: g.beta, h0: g.h0 * shock.volMult * shock.volMult },
    ou: { phi, sigma: ouSigma * shock.volMult, maWindow, d0 },
  };
}

export { mean, variance, median, dexp };
