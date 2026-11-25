import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256, parseTransaction } from 'viem';
import { processFingerprints, sendFingerprintTx } from '../src/proof/fingerprint';

/** A small fake chain behind fetch. `broadcast` decides what each node does with a signed transaction. */
function chain(key: `0x${string}`, broadcast: (url: string, n: number, accept: () => void) => void, lookupDown = () => false, behind: (url: string) => number = () => 0) {
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
      case 'eth_getTransactionCount': return reply('0x' + (mined.length - behind(String(url))).toString(16));
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

const C = '0x' + 'cd'.repeat(32);
describe('posting a fingerprint', () => {
  it('plain send', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept());
    const signed: string[] = [];
    const r = await sendFingerprintTx(c.env, H, [], async (t) => { signed.push(t); }, 0);
    expect(c.mined.map((m) => [m.hash, m.input])).toEqual([[r.tx, H]]);
    expect(signed).toEqual([r.tx]);
  });
  it('a node that accepts it and then answers with an error is not a failure', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => { accept(); throw new Error('timeout'); });
    const r = await sendFingerprintTx(c.env, H, [], undefined, 0);
    expect(c.mined).toHaveLength(1);
    expect(r).toEqual({ tx: c.mined[0].hash, at: AT });
  });
  it('the second node takes over when the first is down', async () => {
    const c = chain(generatePrivateKey(), (u, _n, accept) => { if (u.includes('one.test')) throw new Error('down'); accept(); });
    const r = await sendFingerprintTx(c.env, H, [], undefined, 0);
    expect(c.mined.map((m) => m.hash)).toEqual([r.tx]);
  });
  it('the second node takes over when the first is behind', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept(), undefined, (u) => u.includes('one.test') ? 1 : 0);
    c.mined.push({ hash: C, input: '0x', nonce: 0 }, { hash: '0x' + 'ce'.repeat(32), input: '0x', nonce: 1 });
    const r = await sendFingerprintTx(c.env, H, [], undefined, 0);
    expect(c.mined[2]).toMatchObject({ hash: r.tx, input: H, nonce: 2 });
  });
  it('one that landed earlier is recorded with its block time, and nothing is sent', async () => {
    const c = chain(generatePrivateKey(), () => { throw new Error('must not send'); });
    c.mined.push({ hash: C, input: H, nonce: 0 });
    expect(await sendFingerprintTx(c.env, H, ['0x' + '99'.repeat(32), C], undefined, 0)).toEqual({ tx: C, at: AT });
  });
  it('an earlier one with other data does not count', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept());
    c.mined.push({ hash: C, input: '0x' + '00'.repeat(32), nonce: 0 });
    const r = await sendFingerprintTx(c.env, H, [C], undefined, 0);
    expect(c.mined[1].hash).toBe(r.tx);
  });
  it('the check never blocks posting: no answer about an earlier one, and a note that cannot be saved', async () => {
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept(), () => true);
    const r = await sendFingerprintTx(c.env, H, [C], async () => { throw new Error('D1'); }, 0);
    expect(c.mined.map((m) => m.hash)).toEqual([r.tx]);
  });
  it('all nodes failing is reported per node', async () => {
    const c = chain(generatePrivateKey(), () => { throw new Error('down'); });
    await expect(sendFingerprintTx(c.env, H, [], undefined, 0)).rejects.toThrow(/primary RPC: .*\| public RPC: /s);
  });
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
  const rows = () => [1, 2].map((i) => ({ hour: `2026-11-24T0${i}:00:00.000Z`, hash: '0x' + `a${i}`.repeat(32), attempts: 0, status: 'pending' } as any));
  it('an hour whose send looked failed but landed is not sent again', async () => {
    let down = true;
    const c = chain(generatePrivateKey(), (_u, n, accept) => { if (n === 0) accept(); if (down) throw new Error('timeout'); if (n) accept(); }, () => down);
    const r = rows(), d = db(r), env = { ...c.env, DB: d.DB };
    await processFingerprints(env, new Date('2026-11-24T03:00:30Z'));
    expect(c.mined.map((m) => m.input)).toEqual([r[0].hash]);
    expect(r.map((x) => x.status)).toEqual(['pending', 'pending']);
    down = false;
    await processFingerprints(env, new Date('2026-11-24T03:10:30Z'));
    expect(c.mined.map((m) => m.input)).toEqual(r.map((x) => x.hash));
    expect(r.map((x) => [x.status, x.tx])).toEqual(c.mined.map((m) => ['sent', m.hash]));
    expect(r[0].sent_at).toBe(AT);
  }, 30000);
  it('an hour that cannot be sent does not stop the next one', async () => {
    const r = rows();
    const c = chain(generatePrivateKey(), (_u, _n, accept) => accept());
    r[0].hash = 'not hex';
    await processFingerprints({ ...c.env, DB: db(r).DB }, new Date('2026-11-24T03:00:30Z'));
    expect(r.map((x) => x.status)).toEqual(['pending', 'sent']);
  });
});
