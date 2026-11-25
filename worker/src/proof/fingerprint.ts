import type { Env } from '../config';
import { hashObject } from '../../../engine/src/hash';
import { getMeta, setMeta } from '../db';
import { redact, safeError } from '../redact';
import { rpcUrls } from '../data/chainToken';

export interface FingerprintPayload {
  hour: string; // ISO hour start, e.g. 2026-11-23T14:00:00.000Z
  runIds: number[];
  inputHashes: string[];
  outputHashes: string[];
  briefingHashes: string[];
  deskStateHash: string;
}

export function fingerprintHash(p: FingerprintPayload): string {
  return hashObject(p);
}

/** "Locked from day one" may only be claimed if every hour since launch was sent within 2h of ending. */
export function lockedFromDayOne(rows: { hour: string; status: string; sent_at: string | null }[], launchAt: string | undefined): boolean {
  if (!launchAt) return false;
  const since = rows.filter((r) => r.hour >= new Date(launchAt).toISOString());
  return since.length > 0 && since.every((r) => r.status === 'sent' && !!r.sent_at && new Date(r.sent_at).getTime() - new Date(r.hour).getTime() <= 3 * 3600_000);
}

export async function buildPayload(env: Env, hourStart: Date): Promise<FingerprintPayload> {
  const from = hourStart.toISOString();
  const to = new Date(hourStart.getTime() + 3600_000).toISOString();
  const runs = await env.DB.prepare('SELECT id, input_hash, output_hash FROM runs WHERE ts >= ? AND ts < ? ORDER BY id')
    .bind(from, to).all<{ id: number; input_hash: string; output_hash: string }>();
  const briefs = await env.DB.prepare('SELECT hash FROM briefings WHERE ts >= ? AND ts < ? ORDER BY id')
    .bind(from, to).all<{ hash: string }>();
  const desk = await env.DB.prepare('SELECT state_hash FROM desk_equity WHERE ts < ? ORDER BY ts DESC LIMIT 1')
    .bind(to).first<{ state_hash: string }>();
  const r = runs.results || [];
  return {
    hour: from,
    runIds: r.map((x) => x.id),
    inputHashes: r.map((x) => x.input_hash),
    outputHashes: r.map((x) => x.output_hash),
    briefingHashes: (briefs.results || []).map((x) => x.hash),
    deskStateHash: desk?.state_hash ?? '0x',
  };
}

export interface Posted { tx: string; at: string }

/**
 * Post a 0-value self-transaction carrying the hash as calldata.
 * A node can accept a transaction and still answer with an error, so each one is noted (`onSigned`) before it goes out, and the
 * chain is asked about the noted ones (`earlier`) first. The check only ever saves a second post: when it finds nothing or cannot
 * be made, posting goes ahead.
 */
export async function sendFingerprintTx(env: Env, hash: string, earlier: string[] = [], onSigned: (tx: string) => Promise<void> = async () => {}, pauseMs = 1500): Promise<Posted> {
  if (!env.FINGERPRINT_KEY) throw new Error('FINGERPRINT_KEY not set');
  const { createWalletClient, createPublicClient, http, defineChain, keccak256 } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const key = (env.FINGERPRINT_KEY.startsWith('0x') ? env.FINGERPRINT_KEY : '0x' + env.FINGERPRINT_KEY) as `0x${string}`;
  const account = privateKeyToAccount(key);
  // never post from a wallet other than the published one
  if (env.FINGERPRINT_ADDRESS && account.address.toLowerCase() !== env.FINGERPRINT_ADDRESS.toLowerCase()) {
    throw new Error(`FINGERPRINT_KEY belongs to ${account.address}, not the published wallet ${env.FINGERPRINT_ADDRESS}`);
  }
  // one RPC at a time, so a failure says which one failed (labels only, never the URL)
  const nodes = rpcUrls(env).map((url, i) => {
    const chain = defineChain({
      id: Number(env.CHAIN_ID || 4663),
      name: 'Robinhood Chain',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [url] } },
    });
    return {
      label: env.RPC_URL && i === 0 ? 'primary RPC' : 'public RPC',
      wallet: createWalletClient({ account, chain, transport: http(url, { retryCount: 1, timeout: 15000 }) }),
      reader: createPublicClient({ chain, transport: http(url, { retryCount: 0, timeout: 5000 }) }),
    };
  });
  type Node = (typeof nodes)[number];

  /** The block time of a transaction that landed with this hash, or null when it did not or the node cannot say. */
  const landed = async (n: Node, tx: string): Promise<string | null> => {
    try {
      const t = await n.reader.getTransaction({ hash: tx as `0x${string}` });
      if (t.blockNumber === null || t.input.toLowerCase() !== hash.toLowerCase()) return null;
      const block = await n.reader.getBlock({ blockNumber: t.blockNumber });
      return new Date(Number(block.timestamp) * 1000).toISOString();
    } catch { return null; }
  };

  for (const tx of earlier) {
    for (const n of nodes) {
      const at = await landed(n, tx);
      if (at) return { tx, at };
    }
  }

  const errors: string[] = [];
  for (const n of nodes) {
    let tx: `0x${string}` | null = null;
    try {
      const request = await n.wallet.prepareTransactionRequest({ to: account.address, value: 0n, data: hash as `0x${string}` });
      const raw = await account.signTransaction(request as any);
      tx = keccak256(raw);
      await onSigned(tx).catch(() => {});
      await n.wallet.sendRawTransaction({ serializedTransaction: raw });
      return { tx, at: new Date().toISOString() };
    } catch (e) {
      errors.push(`${n.label}: ${safeError(e, env)}`);
    }
    if (!tx) continue;
    await new Promise((r) => setTimeout(r, pauseMs));
    for (const m of nodes) {
      const at = await landed(m, tx);
      if (at) return { tx, at };
    }
  }
  throw new Error(errors.join(' | '));
}

/** meta key: the last few transactions signed for each hour that is not marked as sent */
const SIGNED = 'fingerprint_signed';

/** Create the record for the hour that just ended and (re)try sending every pending fingerprint. */
export async function processFingerprints(env: Env, now: Date): Promise<string[]> {
  const log: string[] = [];
  const hourStart = new Date(Math.floor(now.getTime() / 3600_000) * 3600_000 - 3600_000);
  const exists = await env.DB.prepare('SELECT hour FROM fingerprints WHERE hour = ?').bind(hourStart.toISOString()).first();
  if (!exists) {
    const payload = await buildPayload(env, hourStart);
    if (payload.runIds.length) {
      const hash = fingerprintHash(payload);
      await env.DB.prepare('INSERT INTO fingerprints (hour, hash, payload, status, created_at) VALUES (?,?,?,?,?)')
        .bind(payload.hour, hash, JSON.stringify(payload), 'pending', now.toISOString()).run();
      log.push(`fingerprint ${payload.hour} ${hash}`);
    }
  }
  const pending = await env.DB.prepare("SELECT hour, hash, attempts FROM fingerprints WHERE status = 'pending' ORDER BY hour LIMIT 3")
    .all<{ hour: string; hash: string; attempts: number }>();
  const waiting = pending.results || [];
  const noted = waiting.length ? await getMeta<Record<string, string[]>>(env, SIGNED).catch(() => null) : null;
  const signed: Record<string, string[]> = {};
  for (const p of waiting) if (Array.isArray(noted?.[p.hour])) signed[p.hour] = noted[p.hour];
  for (const p of waiting) {
    try {
      const { tx, at } = await sendFingerprintTx(env, p.hash, signed[p.hour], async (t) => {
        signed[p.hour] = [...(signed[p.hour] ?? []), t].slice(-6);
        await setMeta(env, SIGNED, signed);
      });
      await env.DB.prepare("UPDATE fingerprints SET tx = ?, status = 'sent', sent_at = ?, attempts = attempts + 1, error = NULL WHERE hour = ?")
        .bind(tx, at, p.hour).run();
      log.push(`sent ${p.hour} ${tx}`);
    } catch (e) {
      await env.DB.prepare("UPDATE fingerprints SET attempts = attempts + 1, error = ? WHERE hour = ? AND status = 'pending'")
        .bind(redact((e as Error).message, env).slice(0, 400), p.hour).run();
      log.push(`fingerprint send failed ${p.hour}: ${redact((e as Error).message, env).slice(0, 400)}`);
    }
  }
  return log;
}
