import { SCHEDULE, type Env } from './config';
import { getMeta, setMeta, incr } from './db';
import { sessionAt, etParts, lastCloseDate, type Session } from './session';
import { choosePrice, historyStale } from './pricing';
import { getStockQuote } from './data/stockPrice';
import { getDailyHistory, intradayVol } from './data/history';
import { getNews } from './data/news';
import { getChainPrice } from './data/chainToken';
import { triageHeadlines, newsIntensity } from './agent/triage';
import { writeBriefing, type NewsForBriefing } from './agent/briefing';
import { writeDeskNote } from './agent/deskNote';
import { initialDesk, stepDesk, deskHash, type DeskState } from './desk/desk';
import { processFingerprints } from './proof/fingerprint';
import { scoreMatured } from './proof/scorecard';
import {
  runScenarios, deriveSeed, outputHash, samplePaths, hashObject,
  type EngineInputs, type RunOutput,
} from '../../engine/src/index';

export interface TickReport { ts: string; session: Session; ran: boolean; runId?: number; log: string[] }

async function refreshHistory(env: Env, now: Date, log: string[]) {
  const today = etParts(now).date;
  const last = await getMeta<string>(env, 'history_refreshed');
  const have = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(date) AS latest FROM history_daily').first<{ n: number; latest: string | null }>();
  // refresh daily, and keep retrying every tick while a completed session is missing
  if (last === today && (have?.n ?? 0) > 200 && !historyStale(have?.latest, lastCloseDate(now))) return;
  const start = new Date(now.getTime() - 3.2 * 365 * 86400000).toISOString().slice(0, 10);
  try {
    const h = await getDailyHistory(env, env.SYMBOL, start);
    // Only completed sessions
    const lastClose = lastCloseDate(now);
    const rows = h.value.filter((r) => r.date <= lastClose);
    const stmts = rows.map((r) => env.DB.prepare('INSERT INTO history_daily (date, close) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET close = excluded.close').bind(r.date, r.close));
    for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
    await setMeta(env, 'history_refreshed', today);
    await setMeta(env, 'history_source', h.source);
    log.push(`history: ${rows.length} closes from ${h.source}${h.errors.length ? ' (' + h.errors.join('; ') + ')' : ''}`);
  } catch (e) {
    log.push('history refresh failed: ' + (e as Error).message);
  }
}

async function loadCloses(env: Env): Promise<{ date: string; close: number }[]> {
  const r = await env.DB.prepare('SELECT date, close FROM history_daily ORDER BY date DESC LIMIT 756').all<{ date: string; close: number }>();
  return (r.results || []).reverse();
}

async function triageNews(env: Env, now: Date, log: string[]): Promise<{ intensity: number; bigNews: boolean }> {
  let bigNews = false;
  try {
    const { items, errors } = await getNews(env, env.SYMBOL);
    if (errors.length) log.push('news: ' + errors.join('; '));
    const fresh: typeof items = [];
    for (const h of items.slice(0, 30)) {
      const seen = await env.DB.prepare('SELECT 1 FROM news WHERE id = ?').bind(h.id).first();
      if (!seen) fresh.push(h);
    }
    if (fresh.length) {
      const tri = await triageHeadlines(env, fresh);
      const stmts = fresh.map((h, i) => env.DB.prepare(
        'INSERT OR IGNORE INTO news (id, ts, title, url, source, relevant, score, category, one_line, triaged_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      ).bind(h.id, h.ts, h.title, h.url, h.source, tri[i].relevant ? 1 : 0, tri[i].score, tri[i].category, tri[i].oneLine, now.toISOString()));
      await env.DB.batch(stmts);
      bigNews = tri.some((t, i) => t.relevant && t.score >= SCHEDULE.bigNewsScore && now.getTime() - new Date(fresh[i].ts).getTime() < 3600_000);
      log.push(`news: ${fresh.length} new, ${tri.filter((t) => t.relevant).length} relevant${bigNews ? ', BIG NEWS' : ''}`);
    }
  } catch (e) {
    log.push('news failed: ' + (e as Error).message);
  }
  const rows = await env.DB.prepare('SELECT ts, score, relevant FROM news WHERE ts >= ?')
    .bind(new Date(now.getTime() - 86400000).toISOString()).all<{ ts: string; score: number; relevant: number }>();
  return { intensity: Math.round(newsIntensity(rows.results || [], now) * 1e4) / 1e4, bigNews };
}

export async function loadRunOutput(env: Env, id: number): Promise<RunOutput | null> {
  const r = await env.DB.prepare('SELECT output FROM run_outputs WHERE id = ?').bind(id).first<{ output: string }>();
  return r ? (JSON.parse(r.output) as RunOutput) : null;
}

export async function tick(env: Env, now = new Date(), opts: { force?: boolean } = {}): Promise<TickReport> {
  const log: string[] = [];
  const session = sessionAt(now);
  const et = etParts(now);
  const nowIso = now.toISOString();

  // 1. Prices
  let stock: { price: number; prevClose: number | null } | null = null;
  try {
    const q = await getStockQuote(env, env.SYMBOL);
    stock = q.value;
    await env.DB.prepare('INSERT OR REPLACE INTO prices (ts, source, price) VALUES (?,?,?)').bind(nowIso, 'stock:' + q.source, q.value.price).run();
  } catch (e) { log.push('stock quote failed: ' + (e as Error).message); }
  let chain: number | null = null;
  try {
    const c = await getChainPrice(env);
    chain = c.price;
    // a failed write must not throw away the fresh price we just read
    await env.DB.prepare('INSERT OR REPLACE INTO prices (ts, source, price) VALUES (?,?,?)').bind(nowIso, 'chain:' + c.source, c.price).run()
      .catch((err) => log.push('prices write failed: ' + (err as Error).message));
  } catch (e) {
    log.push('chain price failed: ' + (e as Error).message);
    // reuse the last good on-chain price if it is recent (honestly logged)
    const recent = await env.DB.prepare("SELECT ts, price FROM prices WHERE source LIKE 'chain:%' AND ts >= ? ORDER BY ts DESC LIMIT 1")
      .bind(new Date(now.getTime() - 30 * 60000).toISOString()).first<{ ts: string; price: number }>();
    if (recent) {
      chain = recent.price;
      log.push(`using last on-chain price from ${Math.round((now.getTime() - new Date(recent.ts).getTime()) / 60000)}m ago`);
    }
  }

  // 2. History + news
  await refreshHistory(env, now, log);
  const { intensity, bigNews } = await triageNews(env, now, log);
  await setMeta(env, 'news_intensity', intensity);

  // 3. Decide whether to run
  const last = await env.DB.prepare('SELECT id, ts, spot, crisis, price_source FROM runs ORDER BY id DESC LIMIT 1').first<{ id: number; ts: string; spot: number; crisis: number; price_source: string }>();
  const minsSinceLast = last ? (now.getTime() - new Date(last.ts).getTime()) / 60000 : Infinity;
  const onClosedCadence = et.minute % (10 * SCHEDULE.closedRunEveryTicks) < 10;
  const shouldRun = opts.force || session === 'open' || onClosedCadence || minsSinceLast > 35;

  const history = await loadCloses(env);
  let ranId: number | undefined;
  if (shouldRun && history.length >= 120) {
    const closes = history.map((h) => h.close);
    const lastClose = closes[closes.length - 1];
    const stale = historyStale(history[history.length - 1].date, lastCloseDate(now));
    if (stale) log.push('history is behind the last completed session');
    const px = choosePrice({ session, stock: stock?.price ?? null, chain, lastClose, stale });
    const { spot, source: priceSource } = px;
    const gapSane = px.gap !== null;
    if (chain && !gapSane) log.push(`token is ${((chain / px.ref - 1) * 100).toFixed(1)}% from reference and the stock quote disagrees; ignoring token price`);
    const tokenPremium = px.gap !== null ? Math.round(px.gap * 1e6) / 1e6 : 0;

    const preCfg = Number(env.PRE_CRISIS_LEVEL || 0);
    const preCrisisLevel = preCfg > 0 ? preCfg : Math.max(...closes.slice(-60));
    const iv = session === 'open' ? await intradayVol(env, env.SYMBOL) : null;
    const inputs: EngineInputs = {
      version: 1,
      asOf: nowIso,
      spot: Math.round(spot * 1e6) / 1e6,
      priceSource,
      closes: closes.map((c) => Math.round(c * 1e6) / 1e6),
      newsIntensity: intensity,
      preCrisisLevel: Math.round(preCrisisLevel * 1e6) / 1e6,
      tokenPremium,
      ...(iv ? { intradayVol: Math.round(iv * 1e6) / 1e6 } : {}),
    };
    const seed = deriveSeed(inputs);
    const t0 = Date.now();
    const out = runScenarios(inputs, seed, { pathsPerModel: SCHEDULE.pathsPerModel });
    const ms = Date.now() - t0;
    const oh = outputHash(out);
    const sample = samplePaths(inputs, seed, SCHEDULE.samplePerModel);
    const c = out.combined;
    const summary = {
      spot: out.spot, priceSource, session,
      stockPrice: stock?.price ?? null, lastClose: session === 'open' ? lastClose : px.ref, chainPrice: chain, gap: gapSane ? tokenPremium : null,
      crisis: out.crisis, agreement: out.agreement, newsIntensity: intensity,
      horizons: c.horizons.map((h, i) => ({ days: h.days, p5: h.pct.p5, p25: h.pct.p25, p50: h.pct.p50, p75: h.pct.p75, p95: h.pct.p95, pUp: c.probs[i].pUp, pDown10: c.probs[i].pDown10, pDown20: c.probs[i].pDown20 })),
      expMaxDrawdown1m: c.expMaxDrawdown1m, var95_1m: c.var95_1m, preCrisisLevel: inputs.preCrisisLevel,
      pAbovePreCrisis1m: c.probs[2].pAbovePreCrisis,
    };
    const ins = await env.DB.prepare(
      'INSERT INTO runs (ts, session, seed, input_hash, output_hash, spot, price_source, crisis, cpu_ms, summary) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id',
    ).bind(nowIso, session, seed, out.inputHash, oh, out.spot, priceSource, out.crisis.level, ms > 0 ? ms : null, JSON.stringify(summary)).first<{ id: number }>();
    ranId = ins!.id;
    await env.DB.prepare('INSERT INTO run_outputs (id, inputs, output, sample) VALUES (?,?,?,?)')
      .bind(ranId, JSON.stringify(inputs), JSON.stringify(out), JSON.stringify(sample)).run();
    await incr(env, 'runs_' + et.date);
    await incr(env, 'runs_total');
    log.push(`run ${ranId}: ${out.totalPaths} paths${ms > 0 ? ` in ${ms}ms` : ''}, crisis ${out.crisis.level}, hash ${oh.slice(0, 12)}`);

    // 4. Desk
    try {
      const prevState = (await getMeta<DeskState>(env, 'desk_state')) ?? initialDesk(nowIso);
      const { state, trades } = stepDesk(prevState, {
        runId: ranId, ts: nowIso, price: out.spot, pUp1w: c.probs[1].pUp,
        crisis: out.crisis.level, prevCrisis: last?.crisis ?? null, marketOpen: session === 'open',
      });
      const h = deskHash(state);
      for (const t of trades) {
        const note = await writeDeskNote(env, t, summary);
        await env.DB.prepare('INSERT INTO desk_trades (ts, run_id, action, side, price, qty, pnl, reason, note) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(nowIso, ranId, t.action, t.side, t.price, t.qty, t.pnl, t.reason, note).run();
        log.push(`desk ${t.action} ${t.side} @ ${t.price}`);
      }
      await setMeta(env, 'desk_state', state);
      await env.DB.prepare('INSERT OR REPLACE INTO desk_equity (ts, run_id, equity, price, state_hash) VALUES (?,?,?,?,?)')
        .bind(nowIso, ranId, state.equity, out.spot, h).run();
    } catch (e) { log.push('desk failed: ' + (e as Error).message); }

    // 5. Briefing: every 30 min, or immediately on big news / big move
    try {
      const lastB = await env.DB.prepare('SELECT ts FROM briefings ORDER BY id DESC LIMIT 1').first<{ ts: string }>();
      const minsSinceB = lastB ? (now.getTime() - new Date(lastB.ts).getTime()) / 60000 : Infinity;
      // only compare like with like: a switch between stock / token / last-close pricing is not a market move
      const bigMove = last && last.price_source === priceSource ? Math.abs(out.spot / last.spot - 1) > SCHEDULE.bigMovePct : false;
      if (minsSinceB >= SCHEDULE.briefingEveryMin - 1 || bigNews || bigMove) {
        const prevOut = last ? await loadRunOutput(env, last.id) : null;
        const newsRows = await env.DB.prepare('SELECT title, url, ts, one_line AS oneLine, score, category FROM news WHERE relevant = 1 AND ts >= ? ORDER BY score DESC, ts DESC LIMIT 12')
          .bind(new Date(now.getTime() - 2 * 86400000).toISOString()).all<NewsForBriefing>();
        const b = await writeBriefing(env, out, prevOut, newsRows.results || []);
        const body = { ...b.briefing, runId: ranId, trigger: bigNews ? 'big_news' : bigMove ? 'big_move' : 'schedule' };
        const bh = hashObject(body);
        await env.DB.prepare('INSERT INTO briefings (ts, run_id, body, hash, model, fallback, attempts) VALUES (?,?,?,?,?,?,?)')
          .bind(nowIso, ranId, JSON.stringify(body), bh, b.model, b.fallback ? 1 : 0, b.attempts).run();
        log.push(`briefing (${b.model}${b.fallback ? ', fallback: ' + b.rejections.join(' | ').slice(0, 200) : ''})`);
      }
    } catch (e) { log.push('briefing failed: ' + (e as Error).message); }
  } else if (shouldRun) {
    log.push(`not enough history (${history.length} closes) — run skipped`);
  }

  // 6. Hourly fingerprint (first tick of each hour; pending ones retried every tick)
  try {
    const fp = await processFingerprints(env, now);
    log.push(...fp);
  } catch (e) { log.push('fingerprint failed: ' + (e as Error).message); }

  // 7. Daily scorecard at 00:30 ET
  if (et.hour === 0 && et.minute >= 30 && et.minute < 40) {
    try { log.push(`scorecard: ${await scoreMatured(env)} rows`); } catch (e) { log.push('scorecard failed: ' + (e as Error).message); }
  }

  await setMeta(env, 'last_tick', { ts: nowIso, session, log });
  return { ts: nowIso, session, ran: ranId !== undefined, runId: ranId, log };
}
