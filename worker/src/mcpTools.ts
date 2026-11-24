import type { Briefing, Fingerprint, Latest, Proof, RunFull, RunRow } from '../../web/src/lib/api';
import { displayBriefing, incidentNote } from '../../web/src/lib/briefing';
import { etDate, etShortDate, etTime, int, odds, pct, usd } from '../../web/src/lib/format';
import { cdfFromHist } from '../../web/src/lib/cdf';
import { isDelayed, marketState } from '../../web/src/lib/marketState';
import { ODDS_NOTE, type McpToolName } from '../../web/src/lib/mcpTools';
import { backAboveOf, keptOf } from '../../web/src/lib/metrics';
import { stressLabel } from '../../web/src/lib/stress';
import { DEFAULT_SYMBOL as SYMBOL, symbolConfig } from '../../web/src/lib/symbols';
import type { RunOutput } from '../../engine/src/types';
import { addTradingDays, etParts } from './session';

/** Reads one public API path in-process. null when it does not exist; throws when it is unavailable. */
export type Get = <T>(path: string) => Promise<T | null>;
export type ToolResult = { text: string; data: Record<string, unknown> } | { text: string; isError: true };
export const TOOL_FAILED = { text: `The data is not available right now. Try again in a minute. ${ODDS_NOTE}`, isError: true as const };

const SITE = 'https://quintelagent.com';
const NAMES = { 1: '1 day', 5: '1 week', 21: '1 month' } as Record<number, string>;
const IDX = { '1d': 0, '1w': 1, '1m': 2 } as const;
/** Tue, Nov 24, 2026, 3:30pm ET: an answer can be read long after the run */
const etFull = (ts: string) => `${etDate(ts)}, ${etParts(new Date(ts)).date.slice(0, 4)}, ${etTime(ts)}`;
const verifyUrl = (id: number) => `${SITE}/verify?run=${id}`;
const SOURCE: Record<string, string> = { stock: 'exchange price', chain: 'on-chain token price', last_close: 'last close' };
/** odds as shown on the site, plus a number only where the run can resolve it */
const o = (p: number) => ({ text: odds(p), percent: p < 0.001 || p > 0.999 ? null : parseFloat(odds(p)) });
const cents = (x: number) => Math.round(x * 100) / 100;
/** One line of visible text: hidden characters in a third-party headline must not reach a model. */
export const plain = (s: string, max = 600) => s.replace(/\p{Cf}/gu, '').replace(/[\p{Cc}\s]+/gu, ' ').trim().slice(0, max);
const link = (u: string) => { try { return new URL(u).href; } catch { return ''; } };
const incidentOf = (id: number) => incidentNote({ run_id: id } as Briefing);

const result = (lines: (string | null | false)[], run: { id: number; ts: string }, data: Record<string, unknown>): ToolResult => ({
  text: [...lines.filter((l) => l !== null && l !== false), `Run ${run.id}, ${etFull(run.ts)} (${run.ts}). Verify: ${verifyUrl(run.id)}`, ODDS_NOTE].join('\n'),
  data: { runId: run.id, timeET: etFull(run.ts), timeISO: run.ts, ...data, verify: verifyUrl(run.id), note: ODDS_NOTE },
});
const bad = (text: string): ToolResult => ({ text: `${text} ${ODDS_NOTE}`, isError: true });
const none = bad('There are no runs yet.');

async function latestRun(get: Get): Promise<RunRow | null> { return (await get<Latest>('/api/latest'))?.run ?? null; }

/** The odds in one run's summary. Runs before the touch odds existed leave those out. */
function runOdds(run: RunRow) {
  const s = run.summary, kept = keptOf(s), back = backAboveOf(s), gain = s.event ? `the ${etShortDate(s.event.date)} gain` : symbolConfig().gainName;
  const give = s.touch?.giveBack, incident = incidentOf(run.id);
  const lines = [
    incident,
    `${SYMBOL} started at ${usd(run.spot)} (${SOURCE[run.price_source] ?? run.price_source}). 1,000,000 futures from five models.`,
    kept !== null && give ? `${odds(kept)} of futures keep at least half of ${gain} for a week: no daily close at or below ${usd(give.level)} in ${give.days} trading days.` : null,
    back ? `${odds(back.p)} have at least one daily close above ${usd(back.level)} within 1 month.` : null,
    ...s.horizons.map((h) => `${NAMES[h.days] ?? `${h.days} trading days`}: ${odds(h.pUp)} end higher, ${odds(h.pDown10)} end down 10% or more, ${odds(h.pDown20)} end down 20% or more. Middle 90% of futures: ${usd(h.p5)} to ${usd(h.p95)}, median ${usd(h.p50)}.`),
    `Average worst fall over 1 month: ${pct(s.expMaxDrawdown1m)}. Stress Level ${run.stress} of 100, ${stressLabel(run.stress)}. Model agreement ${s.agreement} of 100.`,
  ];
  const data = {
    symbol: SYMBOL, startPrice: cents(run.spot), priceSource: SOURCE[run.price_source] ?? run.price_source, futures: 1_000_000,
    gainKept: kept !== null && give ? { ...o(kept), meaning: `keeps at least half of ${gain} for a week`, level: cents(give.level), tradingDays: give.days } : null,
    backAbove: back ? { ...o(back.p), meaning: 'any daily close above the level within 1 month', level: cents(back.level) } : null,
    horizons: s.horizons.map((h) => ({ horizon: NAMES[h.days] ?? null, tradingDays: h.days, endHigher: o(h.pUp), endDown10: o(h.pDown10), endDown20: o(h.pDown20), p5: cents(h.p5), median: cents(h.p50), p95: cents(h.p95) })),
    averageWorstFall1mPercent: Math.round(s.expMaxDrawdown1m * 1000) / 10,
    stressLevel: { level: run.stress, label: stressLabel(run.stress) }, modelAgreement: s.agreement,
    ...(incident ? { incident } : {}),
  };
  return { lines, data };
}

type Fp = Partial<Fingerprint> & { hour: string; status: string };
const fpStatus = (s: string) => (s === 'sent' ? 'on chain' : s === 'not_yet' ? 'not made yet' : 'waiting to be sent');
const txUrl = (explorer: string | undefined, tx: string | null | undefined) => (explorer && tx ? `${explorer}/tx/${tx}` : null);

const TOOLS: Record<McpToolName, (args: Record<string, any>, get: Get) => Promise<ToolResult>> = {
  async get_latest_odds(_, get) {
    const run = await latestRun(get);
    if (!run) return none;
    const now = new Date(), { lines, data } = runOdds(run), delayed = isDelayed(run.ts, now), market = marketState(now).label;
    return result([`Latest run. ${market}.${delayed ? ` Delayed: no newer run since ${etFull(run.ts)}.` : ''}`, ...lines], run, { market, delayed, ...data });
  },

  async get_odds_at_price({ price: asked, horizon }, get) {
    const price = cents(asked); // the answer is for the price it shows
    const run = await latestRun(get);
    if (!run) return none;
    const out = (await get<{ output: RunOutput }>(`/api/output/${run.id}`))?.output;
    const h = out?.combined.horizons[IDX[horizon as keyof typeof IDX]];
    if (!out || !h) return TOOL_FAILED;
    const below = cdfFromHist(h, price, out.totalPaths), name = NAMES[h.days];
    const lands = addTradingDays(etParts(new Date(run.ts)).date, h.days);
    const t = out.touch?.backAbove, back = t && Math.abs(t.level - price) < 0.005 ? t : null;
    const incident = incidentOf(run.id), delayed = isDelayed(run.ts, new Date());
    return result([
      incident,
      `In ${name} (${h.days} trading ${h.days === 1 ? 'day' : 'days'}, to the ${etShortDate(lands)} close): ${odds(1 - below)} of futures end at or above ${usd(price)}, ${odds(below)} end below it.`,
      'That is the end of the horizon only. A future that crosses the price and comes back is counted by where it ends.',
      back && `Within 1 month, ${odds(back.p)} of futures have at least one daily close above ${usd(back.level)}. That counts any daily close, so it is a different question.`,
      `The run started at ${usd(out.spot)}.${delayed ? ` Delayed: no newer run since ${etFull(run.ts)}.` : ''}`,
    ], run, {
      symbol: SYMBOL, price, horizon, tradingDays: h.days, endsOn: lands, startPrice: cents(out.spot), futures: out.totalPaths, delayed,
      endOfHorizon: { atOrAbove: o(1 - below), below: o(below), meaning: 'where the price ends, not whether it crosses the level on the way' },
      anyDailyCloseAbove: back ? { ...o(back.p), level: cents(back.level), tradingDays: back.days, meaning: 'at least one daily close above the level within 1 month' } : null,
      ...(incident ? { incident } : {}),
    });
  },

  async get_run({ id }, get) {
    const last = await latestRun(get);
    if (!last) return none;
    // a number past the newest run is refused here, so made-up numbers never reach the database
    const run = id > last.id ? null : await get<RunFull>(`/api/run/${id}`);
    if (!run) return bad(`Run ${id} was not found. The latest is run ${last.id}.`);
    const fp = await get<Fp>(`/api/fingerprint-for-run?id=${id}`).catch(() => null);
    const { lines, data } = runOdds(run);
    return result([
      ...lines,
      `Input hash ${run.input_hash}`, `Output hash ${run.output_hash}`, `Seed ${run.seed}`,
      fp && `Hourly fingerprint: ${fpStatus(fp.status)}${fp.hash ? `, ${fp.hash}` : ''}${fp.tx ? `, transaction ${fp.tx}` : ''}.`,
    ], run, { ...data, inputHash: run.input_hash, outputHash: run.output_hash, seed: run.seed, fingerprint: fp ? { hour: fp.hour, status: fpStatus(fp.status), hash: fp.hash ?? null, transaction: fp.tx ?? null } : null });
  },

  async get_briefings({ limit = 3 }, get) {
    const run = await latestRun(get);
    if (!run) return none;
    const list = ((await get<Briefing[]>('/api/briefings?limit=5')) ?? []).slice(0, limit).map((b) => {
      const s = displayBriefing(b), list = (a: string[]) => a.map((x) => plain(x));
      return { id: b.id, runId: b.run_id, timeET: etFull(b.ts), timeISO: b.ts, headline: plain(s.headline), summary: plain(s.summary, 2000), whatChanged: list(s.whatChanged), keyRisks: list(s.keyRisks), watchNext: list(s.watchNext), sources: s.sources.map((x) => ({ title: plain(x.title, 200), url: link(x.url) })).filter((x) => x.url), hash: b.hash, url: `${SITE}/briefings/${b.id}`, currentWording: s.changed, incident: incidentOf(b.run_id) };
    });
    if (!list.length) return result(['The first briefing posts after the next run.'], run, { briefings: [] });
    return result([
      ...list.flatMap((b) => [
        `${b.headline}`, `Briefing ${b.id}, run ${b.runId}, ${b.timeET} (${b.timeISO}). ${b.url}`, b.incident, b.summary,
        b.whatChanged.length > 0 && `What changed: ${b.whatChanged.join(' ')}`, b.keyRisks.length > 0 && `Key risks: ${b.keyRisks.join(' ')}`, b.watchNext.length > 0 && `Watch next: ${b.watchNext.join(' ')}`,
        b.sources.length > 0 && `Sources (third-party headlines): ${b.sources.map((x) => `${x.title} (${x.url})`).join('; ')}`, b.currentWording && `Shown with current wording. Original hash: ${b.hash}`, '',
      ]),
      'Latest run:',
    ], run, { briefings: list });
  },

  async get_proof(_, get) {
    const run = await latestRun(get);
    const p = await get<Proof>('/api/proof');
    if (!run || !p) return none;
    const list = p.fingerprints.slice(0, 5).map((f) => ({ hourET: etFull(f.hour), hourISO: f.hour, hash: f.hash, status: fpStatus(f.status), transaction: f.tx, url: txUrl(p.explorer, f.tx) }));
    const how = [
      `In a browser: open ${verifyUrl(run.id)} (any run number works). It recomputes all 1,000,000 futures on your device and compares the hashes with the fingerprint on chain.`,
      'From the command line: clone https://github.com/quintelagent/quintel, run npm install, then npx tsx engine/verify.ts <run number>.',
      `On the explorer: the transaction input data equals the fingerprint hash. Method: ${SITE}/docs/proof`,
    ];
    return result([
      `${int(p.sent)} hourly fingerprints on Robinhood Chain (chain ${p.chainId}), ${int(p.pending)} waiting. Wallet ${p.wallet ?? 'not set'}.`,
      ...list.map((f) => `${f.hourET}: ${f.hash}, ${f.status}${f.url ? `, ${f.url}` : ''}`),
      'A fingerprint shows a run existed by then and has not changed since. It does not show that the odds are right.',
      ...how, 'Latest run:',
    ], run, { sent: p.sent, waiting: p.pending, chainId: p.chainId, wallet: p.wallet, fingerprints: list, howToVerify: how });
  },
};

export const callTool = (name: McpToolName, args: Record<string, unknown>, get: Get) => TOOLS[name](args, get);
