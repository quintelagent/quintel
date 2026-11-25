import { DESK_RULES, SCHEDULE, type Env } from './config';
import { burnGallery, burnRequestView, burnRunView, burnSummary, postBurn } from './burn/request';
import { Busy, cachedBody } from './cache';
import type { TokenVolume } from './data/chainToken';
import { getMeta } from './db';
import { workerFlag } from './flags';
import { etParts, sessionAt, nextOpen } from './session';
import { mcpRoute } from './mcp';
import { spentToday } from './agent/openrouter';
import { lockedFromDayOne } from './proof/fingerprint';
import { redact, safeError } from './redact';
import { scorecardSummary } from './proof/scorecard';
import { initialDesk, type DeskState } from './desk/desk';
import { CRISIS_WEIGHTS, MODEL_INFO } from '../../engine/src/index';

const raw = (body: string, maxAge = 30, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge * 2}` : 'no-store',
      'access-control-allow-origin': '*',
    },
  });

const json = (data: unknown, maxAge = 30, status = 200) => raw(JSON.stringify(data), maxAge, status);

export function nextRunAt(now: Date): Date {
  const open = sessionAt(now) === 'open';
  const step = open ? 10 : 10 * SCHEDULE.closedRunEveryTicks;
  const t = new Date(now);
  t.setUTCSeconds(0, 0);
  const m = t.getUTCMinutes();
  t.setUTCMinutes(m - (m % step) + step);
  return t;
}

/** Public alias: `stress` mirrors the stored `crisis` field (kept so old hashes still verify). */
function withStress<T extends { crisis: number; summary: any }>(r: T) {
  return { ...r, stress: r.crisis, summary: { ...r.summary, stress: r.summary.crisis } };
}

async function latest(env: Env) {
  const now = new Date();
  const today = etParts(now).date;
  // one round trip
  const [runs, lastB, counters, chain, stock, vol] = await env.DB.batch<any>([
    env.DB.prepare('SELECT id, ts, session, seed, input_hash, output_hash, spot, price_source, crisis, cpu_ms, summary FROM runs ORDER BY id DESC LIMIT 2'),
    env.DB.prepare('SELECT ts FROM briefings ORDER BY id DESC LIMIT 1'),
    env.DB.prepare('SELECT key, value FROM counters WHERE key IN (?, ?)').bind('runs_' + today, 'runs_total'),
    env.DB.prepare("SELECT ts, price FROM prices WHERE source LIKE 'chain:%' ORDER BY ts DESC LIMIT 1"),
    env.DB.prepare("SELECT ts, price FROM prices WHERE source LIKE 'stock:%' ORDER BY ts DESC LIMIT 1"),
    env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind('token_volume'),
  ]);
  const [run, prev] = runs.results ?? [];
  const count = (k: string) => Number((counters.results ?? []).find((r: any) => r.key === k)?.value ?? 0);
  const briefed = lastB.results?.[0]?.ts as string | undefined;
  const volume = vol.results?.[0] ? (JSON.parse(vol.results[0].value) as TokenVolume) : null;
  const runsToday = count('runs_' + today), runsTotal = count('runs_total');
  return {
    now: now.toISOString(),
    session: sessionAt(now),
    nextRunAt: nextRunAt(now).toISOString(),
    nextOpen: nextOpen(now).toISOString(),
    nextBriefingAt: briefed ? new Date(new Date(briefed).getTime() + SCHEDULE.briefingEveryMin * 60000).toISOString() : null,
    scenariosToday: runsToday * 1_000_000,
    runsToday,
    scenariosTotal: runsTotal * 1_000_000,
    prices: { stock: stock.results?.[0] ?? null, chain: chain.results?.[0] ?? null },
    tokenVolume: volume && now.getTime() - new Date(volume.ts).getTime() < 2 * 3600_000 ? volume : null,
    prevCrisis: prev?.crisis ?? null,
    prevStress: prev?.crisis ?? null,
    run: run ? withStress({ ...run, summary: JSON.parse(run.summary) }) : null,
  };
}

async function runById(env: Env, id: number) {
  const run = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(id).first<any>();
  if (!run) return null;
  const o = await env.DB.prepare('SELECT inputs, output FROM run_outputs WHERE id = ?').bind(id).first<any>();
  if (!o) throw new Error('run output not ready');
  return { ...withStress({ ...run, summary: JSON.parse(run.summary) }), inputs: JSON.parse(o.inputs), output: JSON.parse(o.output) };
}

/** The newest 48 hours, or every recorded hour. */
async function proof(env: Env, every: boolean) {
  const fps = await env.DB.prepare(`SELECT hour, hash, tx, status, attempts, created_at, sent_at, error FROM fingerprints ORDER BY hour DESC${every ? '' : ' LIMIT 48'}`).all();
  const all = (await env.DB.prepare('SELECT hour, status, sent_at FROM fingerprints').all<{ hour: string; status: string; sent_at: string | null }>()).results || [];
  return {
    sent: all.filter((r) => r.status === 'sent').length,
    pending: all.filter((r) => r.status !== 'sent').length,
    lockedFromDayOne: lockedFromDayOne(all, env.LAUNCH_AT),
    explorer: env.CHAIN_EXPLORER,
    chainId: Number(env.CHAIN_ID),
    wallet: env.FINGERPRINT_ADDRESS || null,
    fingerprints: (fps.results || []).map((f: any) => ({ ...f, error: f.error ? redact(f.error, env).slice(0, 200) : null })),
  };
}

async function desk(env: Env) {
  const state = (await getMeta<DeskState>(env, 'desk_state')) ?? initialDesk(new Date().toISOString());
  const trades = await env.DB.prepare('SELECT * FROM desk_trades ORDER BY id DESC LIMIT 500').all();
  const eq = await env.DB.prepare('SELECT ts, equity, price FROM (SELECT ts, equity, price FROM desk_equity ORDER BY ts DESC LIMIT 2000) ORDER BY ts').all();
  const closed = (trades.results || []).filter((t: any) => t.action === 'exit');
  return {
    rules: DESK_RULES,
    state,
    returnPct: state.equity / DESK_RULES.startingCash - 1,
    winRate: closed.length ? state.wins / (state.wins + state.losses) : null,
    trades: trades.results || [],
    equity: eq.results || [],
  };
}

async function health(env: Env) {
  const day = etParts(new Date()).date;
  const ai = await env.DB.prepare('SELECT purpose, model, COUNT(*) AS calls, SUM(tokens_in) AS tokens_in, SUM(tokens_out) AS tokens_out, SUM(cost_usd) AS cost_usd, SUM(ok) AS ok FROM ai_usage WHERE day = ? GROUP BY purpose, model').bind(day).all();
  const spent = await spentToday(env);
  const cap = Number(env.AI_DAILY_CAP_USD || '4');
  const lastTick = await getMeta<any>(env, 'last_tick');
  const lastRun = await env.DB.prepare('SELECT id, ts, cpu_ms FROM runs ORDER BY id DESC LIMIT 1').first<any>();
  const hist = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(date) AS last FROM history_daily').first<any>();
  return {
    ok: !!lastRun && Date.now() - new Date(lastRun.ts).getTime() < 45 * 60000,
    lastTick, lastRun, history: hist,
    historySource: await getMeta(env, 'history_source'),
    secrets: {
      openrouter: !!env.OPENROUTER_API_KEY, alpaca: !!env.ALPACA_KEY_ID, finnhub: !!env.FINNHUB_API_KEY,
      fingerprintKey: !!env.FINGERPRINT_KEY,
    },
    ai: { day, spentUsd: Math.round(spent * 1e4) / 1e4, capUsd: cap, capped: spent >= cap, byModel: ai.results || [] },
  };
}

function config(env: Env) {
  return {
    symbol: env.SYMBOL,
    chainId: Number(env.CHAIN_ID),
    explorer: env.CHAIN_EXPLORER,
    nvdaToken: env.NVDA_TOKEN_ADDRESS,
    hearing: env.HEARING_DATE ? { date: env.HEARING_DATE, label: env.HEARING_LABEL || 'Reported event', url: env.HEARING_URL || null } : null,
    fingerprintWallet: env.FINGERPRINT_ADDRESS || null,
    tokens: { pons: env.QNTL_TOKEN_PONS || null, solana: env.QNTL_TOKEN_SOLANA || null },
    deskRules: DESK_RULES,
    crisisWeights: CRISIS_WEIGHTS,
    stressWeights: CRISIS_WEIGHTS,
    models: MODEL_INFO,
    schedule: SCHEDULE,
  };
}

export async function handleApi(req: Request, env: Env, ctx: ExecutionContext, tickFn: (env: Env, force: boolean) => Promise<unknown>): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '');

  if (p === '/api/mcp') {
    return mcpRoute(req, env, async (path) => {
      const r = await handleApi(new Request(url.origin + path), env, ctx, tickFn);
      if (!r.ok && r.status !== 404) throw new Error('unavailable');
      return r.ok ? r.json() : null;
    });
  }
  if (p === '/api/admin/tick' && req.method === 'POST') {
    const auth = req.headers.get('authorization') || '';
    if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'unauthorized' }, 0, 401);
    return json(await tickFn(env, url.searchParams.get('force') === '1'), 0);
  }
  const burn = p === '/api/burn' || p.startsWith('/api/burn/');
  if (burn && !workerFlag(env, 'BURN_TO_RUN')) return json({ error: 'not found' }, 0, 404);
  if (p === '/api/burn/request' && req.method === 'POST') { const a = await postBurn(req, env); return json(a.body, 0, a.status); }
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 0, 405);

  const int = (k: string, d: number, max: number) => { const n = Math.floor(Number(url.searchParams.get(k) || d)); return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : d; };
  let m: RegExpMatchArray | null;
  // the cache key holds only what changes the answer, so extra parameters cannot get around the cache
  const serve = async (key: string, fresh: number, swr: number, load: () => Promise<unknown>, keep?: number): Promise<Response> => {
    const body = await cachedBody(key, { fresh, swr, keep }, async () => { const v = await load(); return v === null || v === undefined ? null : JSON.stringify(v); }, (x) => ctx.waitUntil(x));
    return body === null ? json({ error: 'not found' }, 0, 404) : raw(body, fresh);
  };
  const all = async (q: D1PreparedStatement) => (await q.all<any>()).results || [];
  const fpRow = (r: any) => (r ? { ...r, error: r.error ? redact(r.error, env).slice(0, 200) : null, payload: JSON.parse(r.payload) } : null);
  try {
    if (p === '/api/latest') return await serve(p, 20, 60, () => latest(env));
    if (p === '/api/health') return await serve(p, 5, 0, () => health(env), 0); // never a stale answer: monitoring reads this
    if (p === '/api/config') return json(config(env), 300); // no database
    if ((m = p.match(/^\/api\/run\/(\d{1,9})$/))) { const id = Number(m[1]); return await serve('/api/run/' + id, 3600, 86400, () => runById(env, id)); }
    if (p === '/api/runs') {
      const t = Date.parse(url.searchParams.get('since') ?? '');
      const from = Math.max(Number.isFinite(t) ? t : Date.now() - 86400000, Date.now() - 45 * 86400000);
      const since = new Date(Math.floor(from / 3600_000) * 3600_000).toISOString(); // whole hours, 45 days back at most
      const limit = int('limit', 200, 500);
      return await serve(`${p}?since=${since}&limit=${limit}`, 30, 60, async () => (await all(env.DB.prepare('SELECT id, ts, session, seed, input_hash, output_hash, spot, price_source, crisis, summary FROM runs WHERE ts >= ? ORDER BY id DESC LIMIT ?').bind(since, limit))).map((x) => withStress({ ...x, summary: JSON.parse(x.summary) })));
    }
    if ((m = p.match(/^\/api\/(sample|output)\/(\d{1,9}|latest)$/))) {
      const col = m[1], id = m[2];
      return await serve(`/api/${col}/${id === 'latest' ? id : Number(id)}`, id === 'latest' ? 30 : 3600, id === 'latest' ? 60 : 86400, async () => {
        const row = id === 'latest'
          ? await env.DB.prepare(`SELECT id, ${col} AS v FROM run_outputs ORDER BY id DESC LIMIT 1`).first<any>()
          : await env.DB.prepare(`SELECT id, ${col} AS v FROM run_outputs WHERE id = ?`).bind(Number(id)).first<any>();
        return row ? (col === 'sample' ? { id: row.id, ...JSON.parse(row.v) } : { id: row.id, output: JSON.parse(row.v) }) : null;
      });
    }
    if (p === '/api/briefings') {
      const limit = int('limit', 20, 100);
      return await serve(`${p}?limit=${limit}`, 30, 60, async () => (await all(env.DB.prepare('SELECT id, ts, run_id, body, hash, model, fallback FROM briefings ORDER BY id DESC LIMIT ?').bind(limit))).map((x) => ({ ...x, body: JSON.parse(x.body) })));
    }
    if (p === '/api/news') return await serve(p, 60, 120, () => all(env.DB.prepare('SELECT ts, title, url, source, score, category, one_line FROM news WHERE relevant = 1 ORDER BY ts DESC LIMIT 30')));
    if (p === '/api/desk') return await serve(p, 30, 60, () => desk(env));
    if (p === '/api/proof') { const every = url.searchParams.get('all') === '1'; return await serve(every ? `${p}?all=1` : p, 30, 60, () => proof(env, every)); }
    if ((m = p.match(/^\/api\/fingerprint\/(.{1,60})$/))) { let hour = ''; try { hour = decodeURIComponent(m[1]); } catch { return json({ error: 'not found' }, 0, 404); } return await serve('/api/fingerprint/' + encodeURIComponent(hour), 60, 120, async () => fpRow(await env.DB.prepare('SELECT * FROM fingerprints WHERE hour = ?').bind(hour).first<any>())); }
    if (p === '/api/fingerprint-for-run') {
      const id = Math.floor(Number(url.searchParams.get('id')));
      if (!Number.isFinite(id) || id < 1) return json({ error: 'not found' }, 0, 404);
      return await serve(`${p}?id=${id}`, 60, 60, async () => {
        const run = await env.DB.prepare('SELECT ts FROM runs WHERE id = ?').bind(id).first<{ ts: string }>();
        if (!run) return null;
        const hour = new Date(Math.floor(new Date(run.ts).getTime() / 3600_000) * 3600_000).toISOString();
        return fpRow(await env.DB.prepare('SELECT * FROM fingerprints WHERE hour = ?').bind(hour).first<any>()) ?? { hour, status: 'not_yet' };
      });
    }
    if (p === '/api/scorecard') return await serve(p, 300, 600, () => scorecardSummary(env));
    if (burn) {
      if (p === '/api/burn') return await serve(p, 15, 0, () => burnSummary(env));
      if (p === '/api/burn/gallery') { const sort = url.searchParams.get('sort') === 'extreme' ? 'extreme' : 'latest'; return await serve(`${p}?sort=${sort}`, 15, 0, () => burnGallery(env, sort)); }
      if ((m = p.match(/^\/api\/burn\/(request|run)\/(\d{1,9})$/))) { const id = Number(m[2]); return await (m[1] === 'run' ? serve(`/api/burn/run/${id}`, 3600, 86400, () => burnRunView(env, id)) : serve(`/api/burn/request/${id}`, 5, 10, () => burnRequestView(env, id), 60)); }
    }
    if (p === '/api/history') return await serve(p, 600, 1200, async () => (await all(env.DB.prepare('SELECT date, close FROM history_daily ORDER BY date DESC LIMIT 260'))).reverse());
    return json({ error: 'not found' }, 0, 404);
  } catch (e) {
    if (!(e instanceof Busy)) console.error('api', p, safeError(e, env));
    return json({ error: 'temporarily unavailable' }, 0, 503);
  }
}
