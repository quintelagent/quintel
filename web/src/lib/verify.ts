import { useEffect, useState } from 'react';
import { hashObject } from '@engine/hash';
import { deriveSeed } from '@engine/run';
import { api, ApiError, type Fingerprint, type Proof, type RunFull, type RunRow } from './api';
import { runInBrowser } from './engineClient';
import { etTime, hash, int } from './format';

/** Public node, read only. Same endpoint as DEFAULT_RPC in worker/src/data/chainToken.ts. */
const PUBLIC_RPC = 'https://rpc.mainnet.chain.robinhood.com';
const HOUR = 3600000;

export interface FingerprintPayload { hour: string; runIds: number[]; inputHashes: string[]; outputHashes: string[]; briefingHashes: string[]; deskStateHash: string }
export type HourFingerprint = Omit<Fingerprint, 'payload'> & { payload?: FingerprintPayload };

/* ---- what the visitor typed ---- */

export type Target = { run: number } | { hash: string };
/** "85", "#85", "run 85", a 0x hash, or null when it is neither. */
export function parseTarget(text: string): Target | null {
  const t = text.trim();
  const h = t.match(/^(?:0x)?([0-9a-f]{64})$/i);
  if (h) return { hash: '0x' + h[1].toLowerCase() };
  const n = t.match(/^(?:run)?\s*#?\s*(\d{1,9})$/i);
  return n ? { run: Number(n[1]) } : null;
}

type Match = { run: number } | { hour: string } | null;
/** A hash is looked up in the fingerprint list first, then in a week of runs. */
async function findHash(h: string): Promise<Match> {
  const same = (x: string | null) => x?.toLowerCase() === h;
  const { fingerprints } = await api<Proof>('/api/proof?all=1');
  const f = fingerprints.find((x) => same(x.hash) || same(x.tx));
  if (f) return { hour: f.hour };
  const since = new Date(Math.floor(Date.now() / HOUR) * HOUR - 7 * 24 * HOUR).toISOString();
  const runs = await api<RunRow[]>(`/api/runs?since=${encodeURIComponent(since)}&limit=500`);
  const r = runs.find((x) => same(x.output_hash) || same(x.input_hash));
  return r ? { run: r.id } : null;
}

/* ---- the chain ---- */

async function rpc<T>(method: string, tx: string): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(PUBLIC_RPC, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [tx] }) });
    if (!res.ok) throw new Error('rpc status');
    const j = await res.json();
    if (j.error || j.result === undefined) throw new Error('rpc error');
    return j.result;
  } finally { clearTimeout(t); }
}
/** Calldata and block of a transaction, or null when the node has not seen it. */
async function readTx(tx: string): Promise<{ input: string; block: number | null } | null> {
  const [t, receipt] = await Promise.all([rpc<{ input: string }>('eth_getTransactionByHash', tx), rpc<{ blockNumber: string }>('eth_getTransactionReceipt', tx)]);
  if (!t || typeof t.input !== 'string') return null;
  const block = receipt?.blockNumber ? Number(receipt.blockNumber) : NaN;
  return { input: t.input, block: Number.isFinite(block) ? block : null };
}

/* ---- the checks ---- */

/** wait: nothing to check yet. stuck: the check could not run. Neither counts as a pass. */
export type CheckState = 'idle' | 'running' | 'ok' | 'fail' | 'wait' | 'stuck';
export interface Check { state: CheckState; detail?: string }
export const LOAD = 0, INPUTS = 1, SEED = 2, RECOMPUTE = 3, HOURLY = 4, CHAIN = 5;
const CHECKS = 6;

export interface Verification { id: number; run: RunFull | null; checks: Check[]; progress: number; fingerprint: HourFingerprint | null; block: number | null; done: boolean }
export type Lookup =
  | { kind: 'none' } | { kind: 'finding' } | { kind: 'missing'; byHash: boolean } | { kind: 'error' }
  | { kind: 'hour'; fingerprint: HourFingerprint }
  | { kind: 'run'; v: Verification };

export type Verdict = 'checking' | 'verified' | 'waiting' | 'unread' | 'unfinished' | 'mismatch';
export function verdictOf(v: Verification): Verdict {
  if (v.checks.some((c) => c.state === 'fail')) return 'mismatch';
  if (!v.done) return 'checking';
  if (v.checks.every((c) => c.state === 'ok')) return 'verified';
  const stuck = v.checks.flatMap((c, i) => (c.state === 'stuck' ? [i] : []));
  if (stuck.length === 1 && stuck[0] === CHAIN) return 'unread';
  return stuck.length ? 'unfinished' : 'waiting';
}

const yes = (ok: boolean): CheckState => (ok ? 'ok' : 'fail');
const compare = (made: string, stored: string) => (made === stored ? hash(made) : `${hash(made)} here, ${hash(stored)} stored`);

async function verifyRun(id: number, alive: () => boolean, emit: (v: Verification) => void): Promise<'missing' | 'error' | void> {
  let v: Verification = { id, run: null, checks: Array.from({ length: CHECKS }, (_, i) => ({ state: i ? 'idle' : 'running' }) as Check), progress: 0, fingerprint: null, block: null, done: false };
  const put = (p: Partial<Verification>) => { v = { ...v, ...p }; if (alive()) emit(v); };
  const set = (i: number, state: CheckState, detail?: string) => put({ checks: v.checks.map((c, k) => (k === i ? { state, detail } : c)) });
  put({});

  let run: RunFull;
  try { run = await api<RunFull>(`/api/run/${id}`); } catch (e) { return e instanceof ApiError && e.status === 404 ? 'missing' : 'error'; }
  if (!alive()) return;
  put({ run });
  set(LOAD, 'ok', `${int(run.inputs.closes.length)} daily closes`);

  // each check stands alone: one that cannot run must not hide the others
  const step = async (i: number, f: () => Promise<[CheckState, string?]> | [CheckState, string?]) => {
    if (!alive()) return;
    set(i, 'running');
    let r: [CheckState, string?];
    try { r = await f(); } catch { r = ['stuck']; }
    if (alive()) set(i, ...r);
  };

  await step(INPUTS, () => { const h = hashObject(run.inputs); return [yes(h === run.input_hash), compare(h, run.input_hash)]; });
  await step(SEED, () => { const s = deriveSeed(run.inputs); return [yes(s === run.seed), s === run.seed ? s : `${s} here, ${run.seed} stored`]; });
  await step(RECOMPUTE, async () => {
    const r = await runInBrowser(run.inputs, run.seed, run.output.pathsPerModel, { onProgress: (p) => { if (alive() && p - v.progress >= 0.01) put({ progress: p }); } });
    put({ progress: 1 });
    return [yes(r.hash === run.output_hash), `${compare(r.hash, run.output_hash)}, in ${(r.ms / 1000).toFixed(1)}s`];
  });

  let made: string | null = null;
  let fp: HourFingerprint | null = null;
  await step(HOURLY, async () => {
    fp = await api<HourFingerprint>(`/api/fingerprint-for-run?id=${id}`);
    const p = fp.payload;
    if (!p) {
      const end = new Date(new Date(fp.hour).getTime() + HOUR);
      const open = end.getTime() > Date.now();
      fp = null;
      return ['wait', open ? `This run’s hour ends at ${etTime(end)}. Its fingerprint is made after that.` : 'No fingerprint is recorded for this hour yet.'];
    }
    if (alive()) put({ fingerprint: fp });
    made = hashObject(p);
    const k = p.runIds.indexOf(id);
    const has = k >= 0 && p.inputHashes[k] === run.input_hash && p.outputHashes[k] === run.output_hash;
    return [yes(made === fp.hash && has), made !== fp.hash ? compare(made, fp.hash) : has ? `${int(p.runIds.length)} ${p.runIds.length === 1 ? 'run' : 'runs'} in this hour` : 'This run’s hashes are not in the fingerprint'];
  });
  const f = fp as HourFingerprint | null;
  if (v.checks[HOURLY].state === 'stuck') { if (alive()) set(CHAIN, 'stuck', 'Needs the fingerprint first.'); }
  else if (!f?.tx || f.status !== 'sent') { if (alive()) set(CHAIN, 'wait', f ? 'Recorded, not sent yet. Sending is tried every 10 minutes.' : 'Nothing to read yet.'); }
  else {
    await step(CHAIN, async () => {
      const t = await readTx(f.tx!);
      if (!t) return ['stuck', 'The public node has no record of this transaction right now.'];
      if (alive()) put({ block: t.block });
      const ok = t.input.toLowerCase() === (made ?? f.hash).toLowerCase();
      if (ok && t.block === null) return ['wait', 'Sent, not in a block yet.'];
      return [yes(ok), ok ? `Block ${int(t.block)}` : 'The transaction data is not this fingerprint'];
    });
    if (alive() && v.checks[CHAIN].state === 'stuck' && !v.checks[CHAIN].detail) set(CHAIN, 'stuck', 'The public node did not answer.');
  }
  put({ done: true });
}

/** Resolves what was typed and runs every check. A newer target, a retry or leaving the page drops the old work. */
export function useVerify(text: string, attempt: number): Lookup {
  const key = `${text}|${attempt}`;
  const [s, set] = useState<{ key: string; l: Lookup }>({ key: '', l: { kind: 'none' } });
  useEffect(() => {
    if (!text) return;
    let on = true;
    const alive = () => on;
    const put = (l: Lookup) => { if (on) set({ key, l }); };
    (async () => {
      const t = parseTarget(text);
      if (!t) return put({ kind: 'missing', byHash: false });
      let id: number;
      if ('run' in t) id = t.run;
      else {
        const m = await findHash(t.hash);
        if (!m) return put({ kind: 'missing', byHash: true });
        if ('hour' in m) return put({ kind: 'hour', fingerprint: await api<HourFingerprint>(`/api/fingerprint/${encodeURIComponent(m.hour)}`) });
        id = m.run;
      }
      if (!on) return;
      const end = await verifyRun(id, alive, (v) => put({ kind: 'run', v }));
      if (end === 'missing') put({ kind: 'missing', byHash: false });
      if (end === 'error') put({ kind: 'error' });
    })().catch(() => put({ kind: 'error' }));
    return () => { on = false; };
  }, [text, key]);
  if (!text) return { kind: 'none' };
  if (s.key === key) return s.l;
  return parseTarget(text) ? { kind: 'finding' } : { kind: 'missing', byHash: false };
}
