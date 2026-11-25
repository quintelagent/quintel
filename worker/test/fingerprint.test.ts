import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256, parseTransaction } from 'viem';
import { processFingerprints, sendFingerprintTx } from '../src/proof/fingerprint';

/** A small fake chain behind fetch. `broadcast` decides what each node does with a signed transaction. */
function chain(key: `0x${string}`, broadcast: (url: string, n: number, accept: () => void) => void, lookupDown = () => false) {
  const me = privateKeyToAccount(key).address;
  const mined: { hash: string; input: string; nonce: number }[] = [];
  let sends = 0;
  const fetchMock = vi.fn(async (url: any, init: any) => {
    const body = JSON.parse(init.body);
    const reply = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'content-type': 'application/json' } });
    const bad = (message: string) => new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message } }), { headers: { 'content-type': 'application/json' } });
    const find = (h: string) => mined.find((m) => m.hash === h);
    switch (body.method) {
      case 'eth_chainId': return reply('0x1237');
      case 'eth_getTransactionCount': return reply('0x' + mined.length.toString(16));
      case 'eth_estimateGas': return reply('0x5208');
      case 'eth_maxPriorityFeePerGas': return reply('0x1');
      case 'eth_gasPrice': return reply('0x1');
      case 'eth_getBlockByNumber': return reply({ number: '0x5', timestamp: '0x69000000', baseFeePerGas: '0x1', transactions: [] });
      case 'eth_getTransactionByHash': {
        if (lookupDown()) return bad('node down');
        const m = find(body.params[0]);
        return reply(m ? { hash: m.hash, from: me, to: me, value: '0x0', input: m.input, nonce: '0x' + m.nonce.toString(16), blockNumber: '0x5', blockHash: '0x' + '1'.repeat(64), transactionIndex: '0x0', gas: '0x5208', gasPrice: '0x1', type: '0x2', chainId: '0x1237', v: '0x0', r: '0x1', s: '0x1' } : null);
      }
      case 'eth_getTransactionReceipt': {
        const m = find(body.params[0]);
        return reply(m ? { transactionHash: m.hash, status: '0x1', blockNumber: '0x5', blockHash: '0x' + '1'.repeat(64), from: me, to: me, logs: [], gasUsed: '0x1', cumulativeGasUsed: '0x1', effectiveGasPrice: '0x1', transactionIndex: '0x0', type: '0x2' } : null);
      }
      case 'eth_sendRawTransaction': {
        const raw = body.params[0] as `0x${string}`;
        const t = parseTransaction(raw);
        const accept = () => { if (!find(keccak256(raw))) { if ((t.nonce ?? 0) !== mined.length) throw new Error('nonce too low'); mined.push({ hash: keccak256(raw), input: t.data as string, nonce: t.nonce ?? 0 }); } };
        try { broadcast(String(url), sends++, accept); } catch (e) { return bad((e as Error).message); }
        return reply(keccak256(raw));
      }
      default: return bad('unexpected ' + body.method);
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return { mined, env: { FINGERPRINT_KEY: key, FINGERPRINT_ADDRESS: me, RPC_URL: 'https://one.test', CHAIN_ID: '4663' } as any };
}
const H = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
const AT = new Date(0x69000000 * 1000).toISOString();
afterEach(() => vi.unstubAllGlobals());

describe('a fingerprint is posted once', () => {
  it('plain send', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept());
    let signed = '';
    const r = await sendFingerprintTx(c.env, H, null, async (t) => { signed = t; }, 0);
    expect(c.mined.map((m) => [m.hash, m.input])).toEqual([[r.tx, H]]);
    expect(signed).toBe(r.tx);
  });
  it('a node that accepts it and then answers with an error is not a failure', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => { accept(); throw new Error('timeout'); });
    const r = await sendFingerprintTx(c.env, H, null, undefined, 0);
    expect(c.mined).toHaveLength(1);
    expect(r).toEqual({ tx: c.mined[0].hash, at: AT });
  });
  it('the second node gets the same signed bytes', async () => {
    const c = chain(generatePrivateKey(), (u, _n, accept) => { if (u.includes('one.test')) throw new Error('down'); accept(); });
    const r = await sendFingerprintTx(c.env, H, null, undefined, 0);
    expect(c.mined.map((m) => m.hash)).toEqual([r.tx]);
  });
  it('an earlier transaction that landed is recorded with its block time, and nothing is sent', async () => {
    const c = chain(generatePrivateKey(), () => { throw new Error('must not send'); });
    c.mined.push({ hash: '0x' + 'cd'.repeat(32), input: H, nonce: 0 });
    expect(await sendFingerprintTx(c.env, H, '0x' + 'cd'.repeat(32), undefined, 0)).toEqual({ tx: '0x' + 'cd'.repeat(32), at: AT });
  });
  it('an earlier transaction with other data does not count', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept());
    c.mined.push({ hash: '0x' + 'cd'.repeat(32), input: '0x' + '00'.repeat(32), nonce: 0 });
    const r = await sendFingerprintTx(c.env, H, '0x' + 'cd'.repeat(32), undefined, 0);
    expect(c.mined[1].hash).toBe(r.tx);
  });
  it('sends nothing while no node can say what happened to the earlier one', async () => {
    const c = chain(generatePrivateKey(), () => { throw new Error('must not send'); }, () => true);
    await expect(sendFingerprintTx(c.env, H, '0x' + 'cd'.repeat(32), undefined, 0)).rejects.toThrow(/node down/);
    expect(c.mined).toHaveLength(0);
  }, 20000);
});

describe('across ticks', () => {
  /** just enough of D1 for processFingerprints */
  function db(rows: any[]) {
    const meta = new Map<string, string>();
    const stmt = (sql: string, a: any[] = []) => ({
      bind: (...x: any[]) => stmt(sql, x),
      first: async () => {
        if (sql.startsWith('SELECT value FROM meta')) return meta.has(a[0]) ? { value: meta.get(a[0]) } : null;
        if (sql.startsWith('SELECT hour FROM fingerprints')) return { hour: a[0] };
        return null;
      },
      all: async () => ({ results: rows.filter((r) => r.status === 'pending').slice(0, 3) }),
      run: async () => {
        if (sql.startsWith('INSERT INTO meta')) meta.set(a[0], a[1]);
        else if (sql.includes("status = 'sent'")) Object.assign(rows.find((r) => r.hour === a[2]), { tx: a[0], sent_at: a[1], status: 'sent' });
        else if (sql.startsWith('UPDATE fingerprints SET attempts')) rows.find((r) => r.hour === a[1]).error = a[0];
      },
    });
    return { DB: { prepare: (sql: string) => stmt(sql) }, meta };
  }
  it('an hour whose send looked failed but landed is not sent again, and later hours wait for it', async () => {
    let lookupDown = true;
    const c = chain(generatePrivateKey(), (_u, n, accept) => { accept(); if (n < 4) throw new Error('timeout'); }, () => lookupDown);
    const rows = [1, 2].map((i) => ({ hour: `2026-11-24T0${i}:00:00.000Z`, hash: '0x' + `a${i}`.repeat(32), attempts: 0, status: 'pending' } as any));
    const d = db(rows);
    const env = { ...c.env, DB: d.DB };
    await processFingerprints(env, new Date('2026-11-24T03:00:30Z'));
    expect(c.mined).toHaveLength(1);
    expect(rows.map((r) => r.status)).toEqual(['pending', 'pending']);
    lookupDown = false;
    await processFingerprints(env, new Date('2026-11-24T03:10:30Z'));
    expect(c.mined.map((m) => m.input)).toEqual(rows.map((r) => r.hash));
    expect(rows.map((r) => [r.status, r.tx])).toEqual(c.mined.map((m) => ['sent', m.hash]));
    expect(rows[0].sent_at).toBe(AT);
    expect(JSON.parse(d.meta.get('fingerprint_signed')!)).toEqual({});
  }, 30000);
});
