import type { Env } from '../config';
import type { RunOutput } from '../../../engine/src/index';
import { addTradingDays, etParts, isTradingDay, sessionAt } from '../session';

/**
 * Daily scorecard. For each trading day D we score the LAST official run of D
 * (made at or before the close) against the actual close h trading days later.
 * Only matured horizons are scored; nothing is back-filled or simulated.
 */
export async function scoreMatured(env: Env): Promise<number> {
  const closes = await env.DB.prepare('SELECT date, close FROM history_daily ORDER BY date DESC LIMIT 60').all<{ date: string; close: number }>();
  const closeBy = new Map((closes.results || []).map((r) => [r.date, r.close]));
  // candidate days: last 40 calendar days with runs
  const runs = await env.DB.prepare(
    `SELECT r.id, r.ts FROM runs r WHERE r.ts >= ? ORDER BY r.ts`,
  ).bind(new Date(Date.now() - 40 * 86400000).toISOString()).all<{ id: number; ts: string }>();
  const lastByDay = new Map<string, number>();
  for (const r of runs.results || []) {
    const e = etParts(new Date(r.ts));
    if (!isTradingDay(e.date)) continue;
    if (sessionAt(new Date(r.ts)) !== 'open') continue; // only runs made while the market was open
    lastByDay.set(e.date, r.id);
  }
  let added = 0;
  for (const [day, runId] of lastByDay) {
    for (const [hIdx, h] of [[0, 1], [1, 5], [2, 21]] as const) {
      const target = addTradingDays(day, h);
      const actual = closeBy.get(target);
      if (actual === undefined) continue;
      const done = await env.DB.prepare('SELECT 1 FROM scorecard WHERE run_id = ? AND horizon = ?').bind(runId, h).first();
      if (done) continue;
      const row = await env.DB.prepare('SELECT output FROM run_outputs WHERE id = ?').bind(runId).first<{ output: string }>();
      if (!row) continue;
      const o = JSON.parse(row.output) as RunOutput;
      const pct = o.combined.horizons[hIdx].pct;
      const pUp = o.combined.probs[hIdx].pUp;
      const up = actual > o.spot ? 1 : 0;
      await env.DB.prepare(
        'INSERT INTO scorecard (run_id, horizon, run_date, target_date, actual, p5, p25, p75, p95, p_up, in50, in90, brier) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(runId, h, day, target, actual, pct.p5, pct.p25, pct.p75, pct.p95, pUp,
        actual >= pct.p25 && actual <= pct.p75 ? 1 : 0,
        actual >= pct.p5 && actual <= pct.p95 ? 1 : 0,
        (pUp - up) ** 2).run();
      added++;
    }
  }
  return added;
}

export async function scorecardSummary(env: Env) {
  const rows = await env.DB.prepare(
    'SELECT horizon, COUNT(*) AS n, AVG(in50) AS rate50, AVG(in90) AS rate90, AVG(brier) AS brier FROM scorecard GROUP BY horizon ORDER BY horizon',
  ).all<{ horizon: number; n: number; rate50: number; rate90: number; brier: number }>();
  const recent = await env.DB.prepare('SELECT * FROM scorecard ORDER BY target_date DESC, horizon LIMIT 30').all();
  const byH = rows.results || [];
  return {
    status: byH.length ? 'live' : 'collecting',
    note: byH.length ? null : 'Collecting data — the first next-close result lands one trading day after launch. No history is back-filled.',
    horizons: byH,
    recent: recent.results || [],
  };
}
