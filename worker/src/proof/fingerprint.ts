import type { Env } from '../config';
import { hashObject } from '../../../engine/src/hash';

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

/** Send a 0-value self-transaction carrying the hash as calldata. Returns tx hash. */
export async function sendFingerprintTx(env: Env, hash: string): Promise<string> {
  if (!env.FINGERPRINT_KEY) throw new Error('FINGERPRINT_KEY not set');
  const { createWalletClient, http, defineChain } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const rpc = env.CHAIN_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
  const chain = defineChain({
    id: Number(env.CHAIN_ID || 4663),
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
  const key = (env.FINGERPRINT_KEY.startsWith('0x') ? env.FINGERPRINT_KEY : '0x' + env.FINGERPRINT_KEY) as `0x${string}`;
  const account = privateKeyToAccount(key);
  const client = createWalletClient({ account, chain, transport: http(rpc) });
  return client.sendTransaction({ to: account.address, value: 0n, data: hash as `0x${string}` });
}

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
  for (const p of pending.results || []) {
    try {
      const tx = await sendFingerprintTx(env, p.hash);
      await env.DB.prepare("UPDATE fingerprints SET tx = ?, status = 'sent', sent_at = ?, attempts = attempts + 1, error = NULL WHERE hour = ?")
        .bind(tx, new Date().toISOString(), p.hour).run();
      log.push(`sent ${p.hour} ${tx}`);
    } catch (e) {
      await env.DB.prepare('UPDATE fingerprints SET attempts = attempts + 1, error = ? WHERE hour = ?')
        .bind(String((e as Error).message).slice(0, 300), p.hour).run();
      log.push(`fingerprint send failed ${p.hour}: ${(e as Error).message}`);
    }
  }
  return log;
}
