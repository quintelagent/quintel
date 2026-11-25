import type { Env } from '../config';
import { rpcUrls } from '../data/chainToken';
import { getMeta, setMeta } from '../db';
import { CONFIRMATIONS, DEAD_ADDRESS, isAddress, isTxHash } from './scenario';

/** Owner values. Null until every one is set and well formed. */
export interface BurnConfig { token: string; amount: number; fromBlock: number; chainId: number }
export function burnConfig(env: Pick<Env, 'QNTL_TOKEN_PONS' | 'BURN_AMOUNT' | 'BURN_FROM_BLOCK' | 'CHAIN_ID'>): BurnConfig | null {
  const token = env.QNTL_TOKEN_PONS ?? '', amount = env.BURN_AMOUNT ?? '', from = env.BURN_FROM_BLOCK ?? '';
  if (!isAddress(token) || !/^[1-9]\d{0,14}$/.test(amount) || !/^[1-9]\d{0,14}$/.test(from)) return null;
  return { token, amount: Number(amount), fromBlock: Number(from), chainId: Number(env.CHAIN_ID || 4663) };
}
export const rawAmount = (whole: number, decimals: number) => BigInt(whole) * 10n ** BigInt(decimals);

/** A busy node answers 429: wait a moment and ask again, twice at most. */
const WAITS = [400, 1200];
async function call(url: string, method: string, params: unknown[]): Promise<unknown> {
  for (let i = 0; ; i++) {
    try { return await callOnce(url, method, params); } catch (e) {
      if (i >= WAITS.length || (e as Error).message !== 'RPC HTTP 429') throw e;
      await new Promise((f) => setTimeout(f, WAITS[i]));
    }
  }
}

async function callOnce(url: string, method: string, params: unknown[]): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const j = (await res.json()) as { result?: unknown; error?: { message?: string } } | null;
    if (!j || j.error || j.result === undefined) throw new Error('RPC error ' + String(j?.error?.message ?? '').slice(0, 80));
    return j.result;
  } finally { clearTimeout(t); }
}

const rightChain = new Map<string, number>();
const decimalsOf = new Map<string, number>();
export const resetChain = () => { rightChain.clear(); decimalsOf.clear(); };

/** Primary RPC first, then the public one. A node that has nothing (null) also passes the question on. Nodes on another chain are skipped. */
export async function rpc(env: Env, method: string, params: unknown[]): Promise<unknown> {
  let empty = false, last: unknown;
  for (const url of rpcUrls(env)) {
    try {
      if (!rightChain.has(url)) rightChain.set(url, Number(await call(url, 'eth_chainId', [])));
      if (rightChain.get(url) !== Number(env.CHAIN_ID || 4663)) { rightChain.delete(url); throw new Error('RPC is on another chain'); }
      const r = await call(url, method, params);
      if (r !== null) return r;
      empty = true;
    } catch (e) { last = e; }
  }
  if (empty) return null;
  throw last;
}

/** A token's decimals never change: read once, then kept in memory and in the database. */
export async function tokenDecimals(env: Env, token: string): Promise<number> {
  const key = 'burn_decimals:' + token.toLowerCase();
  const known = decimalsOf.get(key) ?? (await getMeta<number>(env, key));
  if (known !== null && known !== undefined) { decimalsOf.set(key, known); return known; }
  const r = await rpc(env, 'eth_call', [{ to: token, data: '0x313ce567' }, 'latest']);
  const d = typeof r === 'string' && /^0x[0-9a-fA-F]{64}$/.test(r) ? Number(BigInt(r)) : NaN;
  if (!Number.isInteger(d) || d < 0 || d > 36) throw new Error('token decimals unreadable');
  decimalsOf.set(key, d);
  await setMeta(env, key, d);
  return d;
}

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export interface Transfer { logIndex: number; from: string; to: string; value: bigint }
export interface Receipt { ok: boolean; block: number | null; transfers: Transfer[]; tokenSeen: boolean }

const quantity = (v: unknown): number | null => {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{1,13}$/.test(v)) return null;
  return Number(v);
};
const topicAddress = (t: unknown) => (typeof t === 'string' && /^0x0{24}[0-9a-fA-F]{40}$/.test(t) ? '0x' + t.slice(26).toLowerCase() : null);

/** Reads only what is needed, and drops anything that is not exactly a Transfer of this token. Null when it is not this transaction's receipt. */
export function readReceipt(r: unknown, tx: string, token: string): Receipt | null {
  const x = r as { transactionHash?: unknown; status?: unknown; blockNumber?: unknown; logs?: unknown } | null;
  if (!x || typeof x !== 'object' || !isTxHash(x.transactionHash) || x.transactionHash.toLowerCase() !== tx.toLowerCase()) return null;
  const transfers: Transfer[] = [];
  let tokenSeen = false;
  for (const l of Array.isArray(x.logs) ? x.logs : []) {
    if (!l || typeof l !== 'object' || l.removed === true || !isAddress(l.address) || l.address.toLowerCase() !== token.toLowerCase()) continue;
    if (!Array.isArray(l.topics) || l.topics.length !== 3 || String(l.topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    const from = topicAddress(l.topics[1]), to = topicAddress(l.topics[2]), logIndex = quantity(l.logIndex);
    if (!from || !to || logIndex === null || typeof l.data !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(l.data)) continue;
    tokenSeen = true;
    transfers.push({ logIndex, from, to, value: BigInt(l.data) });
  }
  return { ok: x.status === '0x1', block: quantity(x.blockNumber), transfers: transfers.sort((a, b) => a.logIndex - b.logIndex), tokenSeen };
}

export type BurnCheck =
  | { kind: 'ok'; block: number; burns: Transfer[] }
  | { kind: 'waiting'; confirmations: number }
  | { kind: 'reverted' | 'wrong_token' | 'wrong_recipient' | 'too_small' | 'too_old' | 'wrong_signer' };

/** Every transfer in the receipt that counts as a burn by `signer`. */
export function checkBurn(r: Receipt, head: number, signer: string, min: bigint, fromBlock: number): BurnCheck {
  if (r.block === null) return { kind: 'waiting', confirmations: 0 };
  if (!r.ok) return { kind: 'reverted' };
  if (!r.tokenSeen) return { kind: 'wrong_token' };
  const dead = r.transfers.filter((t) => t.to === DEAD_ADDRESS.toLowerCase());
  if (!dead.length) return { kind: 'wrong_recipient' };
  const big = dead.filter((t) => t.value >= min);
  if (!big.length) return { kind: 'too_small' };
  if (r.block < fromBlock) return { kind: 'too_old' };
  const burns = big.filter((t) => t.from === signer.toLowerCase());
  if (!burns.length) return { kind: 'wrong_signer' };
  const confirmations = Math.max(0, head - r.block + 1);
  return confirmations < CONFIRMATIONS ? { kind: 'waiting', confirmations } : { kind: 'ok', block: r.block, burns };
}

/** Receipt and current block, or null when no node knows the transaction. */
export async function fetchBurn(env: Env, tx: string, token: string): Promise<{ receipt: Receipt; head: number } | null> {
  const raw = await rpc(env, 'eth_getTransactionReceipt', [tx]);
  if (raw === null) return null;
  const receipt = readReceipt(raw, tx, token);
  const head = quantity(await rpc(env, 'eth_blockNumber', []));
  if (!receipt || head === null) throw new Error('unreadable RPC answer');
  return { receipt, head };
}
