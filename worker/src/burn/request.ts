import type { Env } from '../config';
import { keccak256 } from '../../../engine/src/hash';
import { safeError } from '../redact';
import { burnConfig, checkBurn, fetchBurn, rawAmount, tokenDecimals } from './chain';
import {
  burnMessage, CONFIRMATIONS, exactKeys, isTxHash, NOT_OPEN, parseScenario, priceInSpan, shortAddress, DEAD_ADDRESS,
  type BurnErrorCode, type BurnReply, type BurnRequestView, type BurnResult, type BurnRunRow, type BurnRunView, type BurnStatus, type BurnSummary, type GalleryItem, type Scenario,
} from './scenario';

export const MAX_BODY = 8192;
const GALLERY_SIZE = 24;
const now = () => new Date().toISOString();

export function burnDomain(env: Pick<Env, 'SITE_URL'>): string {
  try { return new URL(env.SITE_URL || '').host; } catch { return 'quintelagent.com'; }
}

/* ---- reads ---- */

export async function burnSummary(env: Env): Promise<BurnSummary> {
  const cfg = burnConfig(env);
  const sum = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(tokens), 0) AS t FROM burn_requests').first<{ n: number; t: number }>();
  const decimals = cfg ? await tokenDecimals(env, cfg.token).catch(() => null) : null;
  return {
    open: !!cfg, status: cfg ? 'Open' : NOT_OPEN,
    domain: burnDomain(env), chainId: Number(env.CHAIN_ID || 4663), explorer: env.CHAIN_EXPLORER, burnAddress: DEAD_ADDRESS, confirmations: CONFIRMATIONS,
    token: cfg?.token ?? null, amount: cfg?.amount ?? null, decimals,
    amountRaw: cfg && decimals !== null ? rawAmount(cfg.amount, decimals).toString() : null, fromBlock: cfg?.fromBlock ?? null,
    burned: sum?.t ?? 0, requests: sum?.n ?? 0,
  };
}

interface Row { id: number; tx: string; burner: string; price: number; horizon: Scenario['horizon']; shock: string | null; anonymous: number; status: BurnStatus; created_at: string; queued_at: string }
interface RunRow { ts: string; base_run_id: number; seed: string; input_hash: string; output_hash: string; paths_per_model: number; inputs: string; result: string }
const scenarioOf = (r: Pick<Row, 'price' | 'horizon' | 'shock'>): Scenario => ({ price: r.price, horizon: r.horizon, shock: r.shock ? JSON.parse(r.shock) : null });
const shown = (r: Pick<Row, 'burner' | 'anonymous' | 'tx'>) => (r.anonymous ? { by: null, tx: null } : { by: shortAddress(r.burner), tx: r.tx });
const runOf = (r: RunRow): BurnRunRow => ({ ts: r.ts, baseRunId: r.base_run_id, seed: r.seed, inputHash: r.input_hash, outputHash: r.output_hash, pathsPerModel: r.paths_per_model, result: JSON.parse(r.result) });

export async function burnRequestView(env: Env, id: number): Promise<BurnRequestView | null> {
  const r = await env.DB.prepare('SELECT * FROM burn_requests WHERE id = ?').bind(id).first<Row>();
  if (!r) return null;
  const run = r.status === 'done' ? await env.DB.prepare('SELECT * FROM burn_runs WHERE id = ?').bind(id).first<RunRow>() : null;
  const ahead = r.status === 'queued'
    ? await env.DB.prepare("SELECT COUNT(*) AS n FROM burn_requests WHERE status = 'running' OR (status = 'queued' AND (queued_at < ? OR (queued_at = ? AND id < ?)))").bind(r.queued_at, r.queued_at, id).first<{ n: number }>()
    : null;
  return { id, status: r.status, ...shown(r), createdAt: r.created_at, scenario: scenarioOf(r), ahead: ahead?.n ?? 0, run: run && runOf(run) };
}

export async function burnRunView(env: Env, id: number): Promise<BurnRunView | null> {
  const r = await env.DB.prepare('SELECT q.tx, q.burner, q.anonymous, q.price, q.horizon, q.shock, b.* FROM burn_runs b JOIN burn_requests q ON q.id = b.id WHERE b.id = ?').bind(id).first<Row & RunRow>();
  if (!r) return null;
  return {
    id, label: 'Custom scenario, not an official run', ...shown(r), scenario: scenarioOf(r), ...runOf(r), inputs: JSON.parse(r.inputs),
    verify: 'inputs = the inputs of official run baseRunId with preCrisisLevel set to the price, plus the shock if there is one. Seed = deriveSeed(inputs). outputHash = outputHash(runScenarios(inputs, seed, { pathsPerModel })), from engine/src in the public repository. Not in any hourly fingerprint.',
  };
}

export async function burnGallery(env: Env, sort: 'latest' | 'extreme'): Promise<GalleryItem[]> {
  const rows = (await env.DB.prepare(`SELECT q.burner, q.tx, q.anonymous, q.price, q.horizon, q.shock, b.id, b.ts, b.result FROM burn_runs b JOIN burn_requests q ON q.id = b.id ORDER BY ${sort === 'extreme' ? 'b.distance DESC, b.id DESC' : 'b.id DESC'} LIMIT ?`).bind(GALLERY_SIZE).all<Row & { ts: string; result: string }>()).results || [];
  return rows.map((r) => {
    const x = JSON.parse(r.result) as BurnResult, c = x.hist.counts;
    return { id: r.id, ts: r.ts, by: shown(r).by, scenario: scenarioOf(r), spot: x.spot, above: x.above, atOrBelow: x.atOrBelow, shape: Array.from({ length: Math.ceil(c.length / 2) }, (_, i) => c[2 * i] + (c[2 * i + 1] ?? 0)) };
  });
}

/* ---- the one write ---- */

/** Fixed windows, in memory only: nothing about a visitor is stored. */
export function limiter(max: number, windowMs: number) {
  const seen = new Map<string, { n: number; until: number }>();
  return (key: string, t = Date.now()): boolean => {
    const e = seen.get(key);
    if (e && t < e.until) return ++e.n <= max;
    if (seen.size > 5000) for (const [k, v] of seen) if (t >= v.until) seen.delete(k);
    if (seen.size > 5000) return false;
    seen.set(key, { n: 1, until: t + windowMs });
    return true;
  };
}
const perVisitor = limiter(20, 60_000), everyone = limiter(240, 60_000);

/** The body as text, or null when it is over the limit. Never reads past it. */
async function readBody(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return null;
  if (!req.body) return '';
  const reader = req.body.getReader(), parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > MAX_BODY) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const all = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

export interface BurnBody { tx: string; scenario: Scenario; anonymous: boolean; signature: `0x${string}` }
export function parseBody(text: string): BurnBody | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return null; }
  if (!exactKeys(v, ['tx', 'scenario', 'anonymous', 'signature'])) return null;
  const scenario = parseScenario(v.scenario);
  if (!scenario || !isTxHash(v.tx) || typeof v.anonymous !== 'boolean' || typeof v.signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(v.signature)) return null;
  return { tx: v.tx.toLowerCase(), scenario, anonymous: v.anonymous, signature: v.signature as `0x${string}` };
}

/** The address that signed the message, lower case; null when the signature is not valid. */
export async function signerOf(message: string, signature: `0x${string}`): Promise<string | null> {
  const { recoverMessageAddress } = await import('viem');
  return recoverMessageAddress({ message, signature }).then((a) => a.toLowerCase(), () => null);
}

export interface Answer { status: number; body: BurnReply }
const no = (status: number, error: BurnErrorCode): Answer => ({ status, body: { error } });
const yes = (id: number, status: BurnStatus): Answer => ({ status: 200, body: { id, status } });

export async function postBurn(req: Request, env: Env): Promise<Answer> {
  try { return await handle(req, env); } catch (e) {
    console.error('burn', safeError(e, env));
    return no(503, 'unavailable');
  }
}

async function handle(req: Request, env: Env): Promise<Answer> {
  const cfg = burnConfig(env);
  if (!cfg) return no(503, 'not_open');
  if (!perVisitor(req.headers.get('cf-connecting-ip') || 'none') || !everyone('all')) return no(429, 'slow_down');
  // a JSON content type also keeps other sites' pages from posting here
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return no(400, 'bad_request');
  const text = await readBody(req);
  if (text === null) return no(413, 'too_large');
  const b = parseBody(text);
  if (!b) return no(400, 'bad_request');

  const message = burnMessage({ domain: burnDomain(env), chainId: cfg.chainId, tx: b.tx, scenario: b.scenario, anonymous: b.anonymous });
  const signer = await signerOf(message, b.signature);
  if (!signer) return no(400, 'bad_request');

  const last = await env.DB.prepare('SELECT spot FROM runs ORDER BY id DESC LIMIT 1').first<{ spot: number }>();
  if (!last) return no(503, 'unavailable');
  if (!priceInSpan(b.scenario.price, last.spot)) return no(422, 'out_of_range');

  const found = await fetchBurn(env, b.tx, cfg.token);
  if (!found) return no(404, 'not_found');
  const decimals = await tokenDecimals(env, cfg.token);
  const c = checkBurn(found.receipt, found.head, signer, rawAmount(cfg.amount, decimals), cfg.fromBlock);
  if (c.kind === 'waiting') return { status: 202, body: { waiting: true, confirmations: c.confirmations, needed: CONFIRMATIONS } };
  if (c.kind !== 'ok') return no(422, c.kind);

  // a transaction can hold several burns: each one is good for one run, and the same message never uses two
  const hash = keccak256(message + '\n' + signer), at = now(), s = b.scenario, shock = s.shock ? JSON.stringify(s.shock) : null;
  for (let tries = 0; tries < 3; tries++) {
    const rows = (await env.DB.prepare('SELECT id, log_index, burner, request_hash, status FROM burn_requests WHERE tx = ?').bind(b.tx).all<{ id: number; log_index: number; burner: string; request_hash: string; status: BurnStatus }>()).results || [];
    const same = rows.find((r) => r.request_hash === hash);
    if (same && same.status !== 'failed') return yes(same.id, same.status);
    const free = same ? undefined : c.burns.find((t) => !rows.some((r) => r.log_index === t.logIndex));
    if (free) {
      const ins = await env.DB.prepare('INSERT OR IGNORE INTO burn_requests (tx, log_index, block, burner, amount, tokens, price, horizon, shock, anonymous, request_hash, signature, created_at, queued_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id')
        .bind(b.tx, free.logIndex, c.block, signer, free.value.toString(), tokensOf(free.value, decimals), s.price, s.horizon, shock, b.anonymous ? 1 : 0, hash, b.signature, at, at).first<{ id: number }>();
      if (ins) return yes(ins.id, 'queued');
      continue; // another request took this burn a moment ago: look again
    }
    const retry = same ?? rows.find((r) => r.status === 'failed' && r.burner === signer);
    if (!retry) return no(409, 'used');
    const up = await env.DB.prepare("UPDATE burn_requests SET status = 'queued', attempts = 0, error = NULL, price = ?, horizon = ?, shock = ?, anonymous = ?, request_hash = ?, signature = ?, queued_at = ?, started_at = NULL WHERE id = ? AND status = 'failed' RETURNING id")
      .bind(s.price, s.horizon, shock, b.anonymous ? 1 : 0, hash, b.signature, at, retry.id).first<{ id: number }>();
    if (up) return yes(up.id, 'queued');
  }
  return no(503, 'unavailable');
}

/** Whole tokens for the public counter; the exact raw amount is stored next to it. */
export function tokensOf(raw: bigint, decimals: number): number {
  const one = 10n ** BigInt(decimals);
  return Number(raw / one) + Number(raw % one) / Number(one);
}
