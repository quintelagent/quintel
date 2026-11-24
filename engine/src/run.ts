import { calibrate, logReturns } from './calibrate';
import { crisisLevel } from './crisis';
import { hashObject, keccak256, canonical } from './hash';
import { dexp, dlog, dsqrt, r6 } from './math';
import { DAYS, DN_DAYS, HORIZONS, type SimContext, type SimOut } from './models/common';
import { simulateGbm } from './models/gbm';
import { simulateJump } from './models/jump';
import { simulateBootstrap } from './models/bootstrap';
import { simulateGarch } from './models/garch';
import { simulateMeanRev } from './models/meanrev';
import { Rng } from './rng';
import type {
  EngineInputs, HorizonProbs, HorizonStats, ModelId, ModelOut, Percentiles, RunOutput,
} from './types';

export const MODEL_IDS: ModelId[] = ['gbm', 'jump', 'bootstrap', 'garch', 'meanrev'];
export const DEFAULT_PATHS_PER_MODEL = 200_000;
export const HIST_BUCKETS = 60;
const PCTS: [keyof Percentiles, number][] = [
  ['p1', 0.01], ['p5', 0.05], ['p10', 0.1], ['p25', 0.25], ['p50', 0.5],
  ['p75', 0.75], ['p90', 0.9], ['p95', 0.95], ['p99', 0.99],
];

const SIMS: Record<ModelId, (c: SimContext) => SimOut> = {
  gbm: simulateGbm,
  jump: simulateJump,
  bootstrap: (c) => simulateBootstrap(c),
  garch: simulateGarch,
  meanrev: simulateMeanRev,
};

/** seed = first 64 bits of keccak256(canonical(inputs) + runTimestamp) */
export function deriveSeed(inputs: EngineInputs): string {
  return keccak256(canonical(inputs) + inputs.asOf).slice(2, 18);
}

export function validateInputs(inp: EngineInputs) {
  if (inp.version !== 1 && inp.version !== 2) throw new Error('unsupported input version');
  if (inp.version === 1 && inp.levels) throw new Error('levels need input version 2');
  if (inp.levels && !(inp.levels.backAbove > 0 && inp.levels.giveBack > 0)) throw new Error('levels must be > 0');
  if (!(inp.spot > 0)) throw new Error('spot must be > 0');
  if (!Array.isArray(inp.closes) || inp.closes.length < 120) throw new Error('need ≥ 120 daily closes');
  if (inp.closes.some((c) => !(c > 0))) throw new Error('closes must be > 0');
}

function percentiles(sorted: Float64Array): Percentiles {
  const n = sorted.length;
  const out = {} as Percentiles;
  for (const [k, q] of PCTS) out[k] = r6(sorted[Math.min(n - 1, Math.floor(q * n))]);
  return out;
}

function histogram(sorted: Float64Array, lo: number, hi: number): number[] {
  const counts = new Array(HIST_BUCKETS).fill(0);
  const w = (hi - lo) / HIST_BUCKETS;
  for (let i = 0; i < sorted.length; i++) {
    let b = w > 0 ? Math.floor((sorted[i] - lo) / w) : 0;
    if (b < 0) b = 0;
    else if (b >= HIST_BUCKETS) b = HIST_BUCKETS - 1;
    counts[b]++;
  }
  return counts;
}

function meanOf(a: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

/** count of elements strictly below v in a sorted array */
function lowerBound(sorted: Float64Array, v: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** count of elements ≤ v */
function upperBound(sorted: Float64Array, v: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Round-number price grid covering ±40% of spot. */
export function priceGrid(spot: number): number[] {
  const raw = (spot * 0.8) / 40;
  let p = 1;
  while (p * 10 <= raw) p *= 10;
  while (p > raw) p /= 10;
  let step = p;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (p * m >= raw) { step = p * m; break; }
  }
  const levels: number[] = [];
  let k = Math.ceil((spot * 0.6) / step);
  while (k * step <= spot * 1.4 && levels.length < 120) {
    levels.push(r6(k * step));
    k++;
  }
  return levels;
}

/** Agreement 0–100: how close the five 1-month medians and spreads are. */
export function agreementScore(medians: number[], spreads: number[]): number {
  const n = medians.length;
  const mMed = medians.reduce((a, b) => a + b, 0) / n;
  const mSpr = spreads.reduce((a, b) => a + b, 0) / n;
  if (!(mSpr > 0)) return 100;
  let vMed = 0, vSpr = 0;
  for (let i = 0; i < n; i++) {
    vMed += (medians[i] - mMed) ** 2;
    vSpr += (spreads[i] - mSpr) ** 2;
  }
  const a = dsqrt(vMed / n) / mSpr; // median disagreement relative to spread
  const b = dsqrt(vSpr / n) / mSpr; // spread disagreement
  const s = 100 * (1 - (2 * a + b));
  return Math.round(Math.max(0, Math.min(100, s)));
}

export interface RunOptions {
  pathsPerModel?: number;
  /** Optional progress callback (model index done). */
  onProgress?: (done: number, total: number) => void;
}

export function runScenarios(inputs: EngineInputs, seed: string, opts: RunOptions = {}): RunOutput {
  validateInputs(inputs);
  const N = opts.pathsPerModel ?? DEFAULT_PATHS_PER_MODEL;
  const inputHash = hashObject(inputs);
  const calib = calibrate(inputs);
  const returns = new Float64Array(logReturns(inputs.closes));
  const logSpot = dlog(inputs.spot);

  const touch = inputs.levels
    ? { up: dlog(inputs.levels.backAbove), dn: dlog(inputs.levels.giveBack), upHits: 0, dnHits: 0 }
    : undefined;
  const sims: SimOut[] = [];
  MODEL_IDS.forEach((id, idx) => {
    const ctx: SimContext = {
      spot: inputs.spot, logSpot, calib, returns, logMa: calib.logMa, n: N, rng: new Rng(seed, idx), touch,
    };
    const out = SIMS[id](ctx);
    for (const t of out.term) for (let i = 0; i < N; i++) t[i] = dexp(t[i]);
    sims.push(out);
    opts.onProgress?.(idx + 1, MODEL_IDS.length);
  });

  const M = MODEL_IDS.length;
  const total = N * M;
  const grid = priceGrid(inputs.spot);
  const combinedH: HorizonStats[] = [];
  const probs: HorizonProbs[] = [];
  const modelH: HorizonStats[][] = MODEL_IDS.map(() => []);
  const modelPUp: number[] = [];
  const buf = new Float64Array(total);

  HORIZONS.forEach((days, h) => {
    for (let m = 0; m < M; m++) buf.set(sims[m].term[h], m * N);
    buf.sort();
    const lo = r6(buf[Math.floor(0.001 * total)]);
    const hi = r6(buf[Math.min(total - 1, Math.ceil(0.999 * total) - 1)]);
    combinedH.push({ days, mean: r6(meanOf(buf)), pct: percentiles(buf), hist: { lo, hi, counts: histogram(buf, lo, hi) } });
    const below = grid.map((L) => r6(lowerBound(buf, L) / total));
    probs.push({
      days,
      pUp: r6(1 - upperBound(buf, inputs.spot) / total),
      pDown10: r6(lowerBound(buf, inputs.spot * 0.9) / total),
      pDown20: r6(lowerBound(buf, inputs.spot * 0.8) / total),
      pAbovePreCrisis: r6(1 - upperBound(buf, inputs.preCrisisLevel) / total),
      below,
    });
    for (let m = 0; m < M; m++) {
      const t = sims[m].term[h];
      t.sort();
      modelH[m].push({ days, mean: r6(meanOf(t)), pct: percentiles(t), hist: { lo, hi, counts: histogram(t, lo, hi) } });
      if (h === 2) modelPUp.push(r6(1 - upperBound(t, inputs.spot) / N));
    }
  });

  // Expected max drawdown over one month (path-simulated models only).
  let ddSum = 0, ddN = 0;
  for (const s of sims) {
    if (!s.dd) continue;
    for (let i = 0; i < s.dd.length; i++) ddSum += 1 - dexp(-s.dd[i]);
    ddN += s.dd.length;
  }

  const models: ModelOut[] = MODEL_IDS.map((id, m) => ({ id, paths: N, horizons: modelH[m], pUp1m: modelPUp[m] }));
  const medians = models.map((mo) => mo.horizons[2].pct.p50);
  const spreads = models.map((mo) => mo.horizons[2].pct.p90 - mo.horizons[2].pct.p10);

  const crisis = crisisLevel({
    volRatio: calib.volRatio,
    pDown20_1m: probs[2].pDown20,
    newsIntensity: inputs.newsIntensity,
    tokenPremium: inputs.tokenPremium,
  });

  return {
    version: inputs.version,
    ...(touch && inputs.levels ? {
      touch: {
        backAbove: { level: r6(inputs.levels.backAbove), days: DAYS, p: r6(touch.upHits / total) },
        giveBack: { level: r6(inputs.levels.giveBack), days: DN_DAYS, p: r6(touch.dnHits / total) },
      },
    } : {}),
    seed,
    inputHash,
    spot: r6(inputs.spot),
    horizons: [...HORIZONS],
    pathsPerModel: N,
    totalPaths: total,
    calib: roundDeep(calib),
    models,
    combined: {
      horizons: combinedH,
      probs,
      grid,
      expMaxDrawdown1m: r6(ddN ? ddSum / ddN : 0),
      var95_1m: r6(1 - combinedH[2].pct.p5 / inputs.spot),
    },
    agreement: agreementScore(medians, spreads),
    crisis,
  };
}

function roundDeep<T>(v: T): T {
  if (typeof v === 'number') return r6(v) as unknown as T;
  if (Array.isArray(v)) return v.map(roundDeep) as unknown as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = roundDeep(x);
    return o as T;
  }
  return v;
}

export function outputHash(out: RunOutput): string {
  return hashObject(out);
}
