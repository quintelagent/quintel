import { describe, expect, it } from 'vitest';
import { runScenarios, outputHash, deriveSeed, priceGrid } from '../src/run';
import { calibrate, logReturns, fitGarch } from '../src/calibrate';
import { crisisLevel } from '../src/crisis';
import { simulateGbm } from '../src/models/gbm';
import { simulateBootstrap } from '../src/models/bootstrap';
import { Rng } from '../src/rng';
import { dexp, dlog, dsqrt } from '../src/math';
import { samplePaths } from '../src/sample';
import { baseInputs } from './fixtures';

const inputs = baseInputs();
const seed = deriveSeed(inputs);

describe('determinism', () => {
  it('same inputs + seed => identical outputHash', () => {
    const a = runScenarios(inputs, seed, { pathsPerModel: 20000 });
    const b = runScenarios(structuredClone(inputs), seed, { pathsPerModel: 20000 });
    expect(outputHash(a)).toBe(outputHash(b));
  });
  it('different seed => different hash', () => {
    const a = runScenarios(inputs, seed, { pathsPerModel: 5000 });
    const b = runScenarios(inputs, 'deadbeefdeadbeef', { pathsPerModel: 5000 });
    expect(outputHash(a)).not.toBe(outputHash(b));
  });
  it('seed is 64 bits hex', () => {
    expect(seed).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('GBM matches closed form', () => {
  it('terminal log mean / variance at 21d', () => {
    const c = calibrate(inputs);
    const n = 200000;
    const out = simulateGbm({ spot: inputs.spot, logSpot: dlog(inputs.spot), calib: c, returns: new Float64Array(), logMa: 0, n, rng: new Rng(seed) });
    const t = out.term[2];
    let s = 0, s2 = 0, sp = 0;
    for (let i = 0; i < n; i++) { const r = t[i] - dlog(inputs.spot); s += r; s2 += r * r; sp += dexp(t[i]); }
    const m = s / n, v = s2 / n - m * m;
    const expM = (c.mu - 0.5 * c.sigma ** 2) * 21;
    const expV = c.sigma ** 2 * 21;
    expect(Math.abs(m - expM)).toBeLessThan(4 * dsqrt(expV / n));
    expect(Math.abs(v / expV - 1)).toBeLessThan(0.02);
    // E[S_T] = S0 * exp(mu * T)
    const expPrice = inputs.spot * Math.exp(c.mu * 21);
    expect(Math.abs(sp / n / expPrice - 1)).toBeLessThan(0.005);
  });
});

describe('output sanity', () => {
  const out = runScenarios(inputs, seed, { pathsPerModel: 20000 });
  it('probabilities in [0,1]', () => {
    for (const p of out.combined.probs) {
      for (const v of [p.pUp, p.pDown10, p.pDown20, p.pAbovePreCrisis, ...p.below]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      // P(below L) non-decreasing in L
      for (let i = 1; i < p.below.length; i++) expect(p.below[i]).toBeGreaterThanOrEqual(p.below[i - 1]);
      expect(p.pDown20).toBeLessThanOrEqual(p.pDown10);
    }
  });
  it('percentiles monotonic, histograms sum to path count', () => {
    const all = [out.combined.horizons, ...out.models.map((m) => m.horizons)];
    all.forEach((hs, idx) => {
      for (const h of hs) {
        const v = Object.values(h.pct);
        const keys = ['p1', 'p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99'] as const;
        for (let i = 1; i < keys.length; i++) expect(h.pct[keys[i]]).toBeGreaterThanOrEqual(h.pct[keys[i - 1]]);
        expect(v.length).toBe(9);
        const sum = h.hist.counts.reduce((a, b) => a + b, 0);
        expect(sum).toBe(idx === 0 ? out.totalPaths : out.pathsPerModel);
        expect(h.hist.counts.length).toBe(60);
      }
    });
  });
  it('agreement and crisis bounded', () => {
    expect(out.agreement).toBeGreaterThanOrEqual(0);
    expect(out.agreement).toBeLessThanOrEqual(100);
    expect(out.crisis.level).toBeGreaterThanOrEqual(0);
    expect(out.crisis.level).toBeLessThanOrEqual(100);
    expect(out.combined.var95_1m).toBeGreaterThan(0);
    expect(out.combined.expMaxDrawdown1m).toBeGreaterThan(0);
  });
  it('price grid spans ±40%', () => {
    const g = priceGrid(183.4);
    expect(g[0]).toBeGreaterThanOrEqual(183.4 * 0.6);
    expect(g[g.length - 1]).toBeLessThanOrEqual(183.4 * 1.4);
    expect(g.length).toBeGreaterThan(10);
  });
});

describe('bootstrap', () => {
  it('only draws real historical returns', () => {
    const c = calibrate(inputs);
    const r = new Float64Array(logReturns(inputs.closes));
    const set = new Set(Array.from(r));
    let draws = 0;
    simulateBootstrap(
      { spot: inputs.spot, logSpot: dlog(inputs.spot), calib: c, returns: r, logMa: 0, n: 2000, rng: new Rng(seed) },
      (x) => { draws++; expect(set.has(x)).toBe(true); },
    );
    expect(draws).toBe(2000 * 21);
    // and with no shock the 21d log return is exactly a sum of real returns
    expect(c.volMult).toBe(1);
    expect(c.driftShockDaily).toBe(0);
  });
});

describe('GARCH', () => {
  it('fit gives alpha+beta < 1 and positive params', () => {
    const g = fitGarch(logReturns(inputs.closes));
    expect(g.alpha).toBeGreaterThanOrEqual(0);
    expect(g.beta).toBeGreaterThanOrEqual(0);
    expect(g.alpha + g.beta).toBeLessThan(1);
    expect(g.omega).toBeGreaterThan(0);
  });
});

describe('crisis level', () => {
  it('bounded and moves the right way', () => {
    const calm = crisisLevel({ volRatio: 0.7, pDown20_1m: 0.0, newsIntensity: 0, tokenPremium: 0 });
    const mid = crisisLevel({ volRatio: 1.5, pDown20_1m: 0.1, newsIntensity: 0.5, tokenPremium: 0.02 });
    const max = crisisLevel({ volRatio: 9, pDown20_1m: 0.9, newsIntensity: 5, tokenPremium: -0.5 });
    expect(calm.level).toBe(0);
    expect(max.level).toBe(100);
    expect(mid.level).toBeGreaterThan(calm.level);
    expect(mid.level).toBeLessThan(max.level);
  });
  it('more news + stressed history => higher crisis in a full run', () => {
    const a = runScenarios(inputs, seed, { pathsPerModel: 5000 });
    const stressed = baseInputs({ newsIntensity: 1, tokenPremium: -0.06, shock: { drift: -0.1, jumpMult: 3, volMult: 2 } });
    const b = runScenarios(stressed, seed, { pathsPerModel: 5000 });
    expect(b.crisis.level).toBeGreaterThan(a.crisis.level);
  });
});

describe('path sample', () => {
  it('returns perModel paths of days+1 points', () => {
    const s = samplePaths(inputs, seed, 10);
    expect(s.models.length).toBe(5);
    for (const m of s.models) {
      expect(m.paths.length).toBe(10);
      for (const p of m.paths) expect(p.length).toBe(22);
    }
  });
});

describe('performance', () => {
  it('1M paths run (log time)', () => {
    const t0 = performance.now();
    const out = runScenarios(inputs, seed);
    const ms = performance.now() - t0;
    console.log(`[perf] 1,000,000 paths in ${ms.toFixed(0)} ms; hash ${outputHash(out).slice(0, 18)}…`);
    expect(out.totalPaths).toBe(1_000_000);
    expect(ms).toBeLessThan(20000);
  });
});

describe('engine versions', () => {
  it('v1 output is frozen — stored runs must verify forever (golden hash)', () => {
    expect(outputHash(runScenarios(inputs, seed))).toBe('0xd2fc24f82d3691a39db4b8bc545312f19f7faa8e4b73b31e7f1aead8bfcdd56e');
  });
  const spot = inputs.spot;
  const v2 = (backAbove: number, giveBack: number) =>
    runScenarios({ ...inputs, version: 2, levels: { backAbove, giveBack } }, seed, { pathsPerModel: 20000 });
  it('v2 touch odds are sane, deterministic and at least the end-of-horizon odds', () => {
    const o = v2(spot * 1.1, spot * 0.9);
    expect(outputHash(o)).toBe(outputHash(v2(spot * 1.1, spot * 0.9)));
    expect(o.touch!.giveBack.p).toBeGreaterThanOrEqual(o.combined.probs[1].pDown10 - 1e-6);
    const end = runScenarios({ ...inputs, version: 2, preCrisisLevel: spot * 1.1, levels: { backAbove: spot * 1.1, giveBack: spot * 0.9 } }, seed, { pathsPerModel: 20000 });
    expect(end.touch!.backAbove.p).toBeGreaterThanOrEqual(end.combined.probs[2].pAbovePreCrisis);
    expect(end.touch!.backAbove.p).toBeLessThan(1);
  });
  it('touch odds move the right way and hit the extremes', () => {
    expect(v2(spot * 1.05, spot * 0.95).touch!.backAbove.p).toBeGreaterThan(v2(spot * 1.2, spot * 0.95).touch!.backAbove.p);
    const x = v2(spot * 100, spot * 100).touch!;
    expect(x.backAbove.p).toBe(0);
    expect(x.giveBack.p).toBe(1);
  });
  it('v2 daily GBM keeps the v1 distribution', () => {
    const a = runScenarios(inputs, seed, { pathsPerModel: 100000 }).models[0].horizons[2].pct;
    const b = runScenarios({ ...inputs, version: 2, levels: { backAbove: 1e6, giveBack: 1 } }, seed, { pathsPerModel: 100000 }).models[0].horizons[2].pct;
    for (const k of ['p5', 'p50', 'p95'] as const) expect(Math.abs(a[k] / b[k] - 1)).toBeLessThan(0.01);
  });
});
