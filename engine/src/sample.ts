import { calibrate, logReturns } from './calibrate';
import { dexp, dlog, dsqrt, r6 } from './math';
import { Rng } from './rng';
import { BLOCK } from './models/bootstrap';
import type { EngineInputs, ModelId } from './types';
import { MODEL_IDS } from './run';

export interface PathSample {
  seed: string;
  days: number;
  models: { id: ModelId; paths: number[][] }[];
}

/**
 * A small daily-stepped path subset per model for visuals (hero cloud, fan charts).
 * Deterministic, but separate streams from the official run.
 */
export function samplePaths(inputs: EngineInputs, seed: string, perModel = 40, days = 21): PathSample {
  const c = calibrate(inputs);
  const returns = logReturns(inputs.closes);
  const m = returns.length;
  const x0 = dlog(inputs.spot);
  const k = dexp(c.jump.muJ + 0.5 * c.jump.sdJ * c.jump.sdJ) - 1;
  const models = MODEL_IDS.map((id, idx) => {
    const rng = new Rng(seed, 100 + idx);
    const paths: number[][] = [];
    for (let p = 0; p < perModel; p++) {
      let x = x0, h = c.garch.h0, dev = x0 - c.logMa, ma = c.logMa, start = 0;
      const path = [r6(inputs.spot)];
      for (let d = 0; d < days; d++) {
        switch (id) {
          case 'gbm': x += c.mu - 0.5 * c.sigma * c.sigma + c.sigma * rng.normal(); break;
          case 'jump': {
            x += c.mu - 0.5 * c.jump.sigmaD * c.jump.sigmaD - c.jump.lambda * k + c.jump.sigmaD * rng.normal();
            const nj = rng.poisson(c.jump.lambda);
            if (nj) x += nj * c.jump.muJ + c.jump.sdJ * dsqrt(nj) * rng.normal();
            break;
          }
          case 'bootstrap':
            if (d % BLOCK === 0) start = rng.int(m - BLOCK + 1);
            x += returns[start + (d % BLOCK)] * c.volMult + c.driftShockDaily;
            break;
          case 'garch': {
            const e = dsqrt(h) * rng.normal();
            x += c.mu - 0.5 * h + e;
            h = c.garch.omega * c.volMult * c.volMult + c.garch.alpha * e * e + c.garch.beta * h;
            break;
          }
          case 'meanrev':
            ma += c.mu;
            dev = c.ou.phi * dev + c.ou.sigma * rng.normal();
            x = ma + dev;
            break;
        }
        path.push(r6(dexp(x)));
      }
      paths.push(path);
    }
    return { id, paths };
  });
  return { seed, days, models };
}
