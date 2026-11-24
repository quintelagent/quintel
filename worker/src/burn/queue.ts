import type { Env } from '../config';
import { safeError } from '../redact';
import { deriveSeed, hashObject, outputHash, runScenarios, type EngineInputs, type RunOutput } from '../../../engine/src/index';
import { BURN_PATHS_PER_MODEL, customInputs, type BurnResult, type Scenario } from './scenario';

export const MAX_ATTEMPTS = 3;
const MIN = 60_000;
/** A custom run starts only in the first half of a ten-minute slot, and only when the official run was quick enough to leave CPU room. */
const SLOT = 10 * MIN, LATE = 5 * MIN, SLOW_RUN = 20_000, STUCK = 15 * MIN, BASE_AGE = 60 * MIN;

/** What the tick did before this. `officialMs` is wall time around the official run, 0 when none was due. */
export interface TickState { startedMs: number; officialFailed: boolean; officialMs: number }

export function skipReason(t: TickState, nowMs: number): string | null {
  if (t.officialFailed) return 'the official run failed';
  if (nowMs - t.startedMs > LATE || nowMs % SLOT > LATE) return 'the tick is late';
  if (t.officialMs > SLOW_RUN) return 'the official run was slow';
  return null;
}

export interface CustomRun { inputs: EngineInputs; seed: string; inputHash: string; outputHash: string; out: RunOutput; result: BurnResult; distance: number }
export function customRun(base: EngineInputs, s: Scenario, pathsPerModel = BURN_PATHS_PER_MODEL): CustomRun {
  const inputs = customInputs(base, s);
  const seed = deriveSeed(inputs);
  const out = runScenarios(inputs, seed, { pathsPerModel });
  const i = out.horizons.indexOf(s.horizon), h = out.combined.horizons[i];
  const horizons = out.combined.probs.map((p) => ({ days: p.days, above: p.pAbovePreCrisis, atOrBelow: Math.round((1 - p.pAbovePreCrisis) * 1e6) / 1e6 }));
  const { p1, p5, p50, p95, p99 } = h.pct;
  return {
    inputs, seed, inputHash: hashObject(inputs), outputHash: outputHash(out), out, distance: Math.abs(Math.log(s.price / out.spot)),
    result: { spot: out.spot, above: horizons[i].above, atOrBelow: horizons[i].atOrBelow, horizons, pct: { p1, p5, p50, p95, p99 }, mean: h.mean, hist: h.hist },
  };
}

/** At most one custom run. Called at the very end of a tick, after everything official is stored. */
export async function processBurns(env: Env, t: TickState, clock: () => number = Date.now, run: typeof customRun = customRun): Promise<string[]> {
  const iso = (ms = clock()) => new Date(ms).toISOString();
  // an attempt that never came back (killed for CPU, or a deploy): again, or failed once the attempts are used up
  await env.DB.prepare(`UPDATE burn_requests SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'queued' END, queued_at = ?, error = 'stopped early' WHERE status = 'running' AND started_at < ?`)
    .bind(iso(), iso(clock() - STUCK)).run();
  const next = await env.DB.prepare("SELECT id FROM burn_requests WHERE status = 'queued' ORDER BY queued_at, id LIMIT 1").first<{ id: number }>();
  if (!next) return [];
  const skip = skipReason(t, clock());
  if (skip) return [`burn run ${next.id} waits: ${skip}`];
  const base = await env.DB.prepare('SELECT r.id, r.ts, o.inputs FROM runs r JOIN run_outputs o ON o.id = r.id ORDER BY r.id DESC LIMIT 1').first<{ id: number; ts: string; inputs: string }>();
  if (!base || clock() - new Date(base.ts).getTime() > BASE_AGE) return [`burn run ${next.id} waits: no recent official run`];

  // counted before it starts, so an attempt that is killed still counts
  const job = await env.DB.prepare("UPDATE burn_requests SET status = 'running', attempts = attempts + 1, started_at = ? WHERE id = ? AND status = 'queued' RETURNING id, price, horizon, shock")
    .bind(iso(), next.id).first<{ id: number; price: number; horizon: Scenario['horizon']; shock: string | null }>();
  if (!job) return [];
  try {
    const c = run(JSON.parse(base.inputs), { price: job.price, horizon: job.horizon, shock: job.shock ? JSON.parse(job.shock) : null });
    await env.DB.batch([
      env.DB.prepare('INSERT INTO burn_runs (id, ts, base_run_id, seed, input_hash, output_hash, paths_per_model, inputs, result, distance) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(job.id, iso(), base.id, c.seed, c.inputHash, c.outputHash, c.out.pathsPerModel, JSON.stringify(c.inputs), JSON.stringify(c.result), c.distance),
      env.DB.prepare("UPDATE burn_requests SET status = 'done', error = NULL WHERE id = ?").bind(job.id),
    ]);
    return [`burn run ${job.id}: ${c.out.totalPaths} paths, hash ${c.outputHash.slice(0, 12)}`];
  } catch (e) {
    const msg = safeError(e, env);
    await env.DB.prepare(`UPDATE burn_requests SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'queued' END, queued_at = ?, error = ? WHERE id = ? AND status = 'running'`)
      .bind(iso(), msg, job.id).run();
    return [`burn run ${job.id} failed: ${msg}`];
  }
}
