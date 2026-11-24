import { readFileSync } from 'node:fs';
// @ts-ignore node types are not part of the site
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseInputs } from '../../engine/test/fixtures';
import { deriveSeed, hashObject } from '../../engine/src/index';
import { handleApi } from '../../worker/src/api';
import { resetChain } from '../../worker/src/burn/chain';
import { customRun, MAX_ATTEMPTS, processBurns } from '../../worker/src/burn/queue';
import { burnGallery, burnRequestView, burnRunView, burnSummary, postBurn } from '../../worker/src/burn/request';
import { resetCache } from '../../worker/src/cache';
import { account, env as makeEnv, fakeRpc, log, ONE, OTHER, post, receipt, SCENARIO, signedBody, TX } from '../../worker/test/burnFixtures';

const sql = (f: string) => readFileSync(new URL(`../../worker/migrations/${f}`, import.meta.url), 'utf8');
/** The real migrations on a real SQLite, behind the D1 calls the worker uses. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(sql('0001_init.sql')); db.exec(sql('0003_burn.sql'));
  const stmt = (q: string, args: any[] = []): any => ({
    bind: (...a: any[]) => stmt(q, a),
    first: async () => db.prepare(q).get(...args) ?? null,
    all: async () => ({ results: db.prepare(q).all(...args) }),
    run: async () => { db.prepare(q).run(...args); },
  });
  return { db, prepare: (q: string) => stmt(q), batch: async (s: any[]) => { db.exec('BEGIN'); try { for (const x of s) await x.run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}

const SLOT = Date.UTC(2026, 10, 24, 15, 0), me = account(), you = account();
let D: ReturnType<typeof d1>, env: any, chain: { receipts: Record<string, unknown>; head: number; down?: boolean; decimals?: number };
const base = baseInputs({ asOf: new Date(SLOT).toISOString(), spot: 180 });
const tick = (o = {}) => ({ startedMs: SLOT, officialFailed: false, officialMs: 4000, ...o });
const at = (ms = 20_000) => () => SLOT + ms;
const quick: typeof customRun = (b, s) => customRun(b, s, 500);
const row = (id: number) => D.db.prepare('SELECT * FROM burn_requests WHERE id = ?').get(id) as any;
const send = async (who = me, over: Parameters<typeof signedBody>[1] = {}, ip = String(Math.random())) => postBurn(post(await signedBody(who, over), { 'cf-connecting-ip': ip }), env);
const tables = () => JSON.stringify(['runs', 'run_outputs', 'fingerprints', 'counters', 'briefings', 'desk_equity'].map((t) => D.db.prepare(`SELECT * FROM ${t}`).all()));

beforeEach(() => {
  resetChain(); resetCache();
  D = d1(); env = makeEnv({ DB: D });
  D.db.prepare("INSERT INTO runs (ts, session, seed, input_hash, output_hash, spot, price_source, crisis, summary) VALUES (?, 'open', ?, ?, 'x', 180, 'stock', 40, '{}')").run(base.asOf, deriveSeed(base), hashObject(base));
  D.db.prepare("INSERT INTO run_outputs (id, inputs, output) VALUES (1, ?, '{}')").run(JSON.stringify(base));
  chain = { receipts: { [TX]: receipt([log({ from: me.address })]) }, head: 501 };
  vi.stubGlobal('fetch', fakeRpc(chain));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('burn requests', () => {
  it('a verified burn is queued with what was signed', async () => {
    expect(await send(me, { scenario: { price: 150.5, horizon: 21, shock: { drift: -0.1, jumpMult: 2, volMult: 1.5 } } })).toEqual({ status: 200, body: { id: 1, status: 'queued' } });
    expect(row(1)).toMatchObject({ tx: TX, log_index: 0, block: 500, burner: me.address.toLowerCase(), amount: (1000n * ONE).toString(), tokens: 1000, price: 150.5, horizon: 21, shock: '{"drift":-0.1,"jumpMult":2,"volMult":1.5}', anonymous: 0, status: 'queued' });
  });
  it('each burn is good for one run', async () => {
    await send();
    expect(await send()).toEqual({ status: 200, body: { id: 1, status: 'queued' } }); // the same message again is the same request
    expect((await send(me, { scenario: { ...SCENARIO, price: 170 } })).body).toEqual({ error: 'used' });
    expect((await send(me, { anonymous: true })).body).toEqual({ error: 'used' });
    expect((await send(you)).body).toEqual({ error: 'wrong_signer' });
    expect(D.db.prepare('SELECT COUNT(*) AS n FROM burn_requests').get()).toMatchObject({ n: 1 });
  });
  it('the database refuses the same burn twice', async () => {
    await send();
    expect(() => D.db.prepare("INSERT INTO burn_requests (tx, log_index, block, burner, amount, tokens, price, horizon, request_hash, signature, created_at, queued_at) SELECT tx, log_index, block, burner, amount, tokens, price, horizon, 'other', signature, created_at, queued_at FROM burn_requests").run()).toThrow(/UNIQUE/);
  });
  it('the same message twice at once is one request', async () => {
    const all = await Promise.all([send(), send(), send(), send()]);
    expect(all.map((a) => a.body)).toEqual(Array(4).fill({ id: 1, status: 'queued' }));
    chain.receipts[TX] = receipt([log({ from: me.address }), log({ from: me.address, index: 1 })]);
    expect((await Promise.all([send(), send()])).map((a) => a.body)).toEqual(Array(2).fill({ id: 1, status: 'queued' }));
  });
  it('two burns in one transaction make two runs, each signed by its burner', async () => {
    chain.receipts[TX] = receipt([log({ from: me.address, index: 2 }), log({ from: me.address, index: 5 }), log({ from: you.address, index: 8 })]);
    const ids = [await send(), await send(me, { scenario: { ...SCENARIO, price: 170 } }), await send(you)].map((a: any) => a.body.id);
    expect(ids.map((i) => row(i).log_index)).toEqual([2, 5, 8]);
    expect((await send(me, { scenario: { ...SCENARIO, price: 171 } })).body).toEqual({ error: 'used' });
  });
  it('says why a burn does not count', async () => {
    const is = async (r: unknown, status: number, error: string) => { chain.receipts[TX] = r; expect(await send()).toEqual({ status, body: { error } }); };
    await is(undefined, 404, 'not_found');
    await is(receipt([log({ from: me.address, token: OTHER })]), 422, 'wrong_token');
    await is(receipt([log({ from: me.address, to: you.address })]), 422, 'wrong_recipient');
    await is(receipt([log({ from: me.address, value: 999n * ONE })]), 422, 'too_small');
    await is(receipt([log({ from: me.address })], { status: '0x0' }), 422, 'reverted');
    await is(receipt([log({ from: me.address })], { blockNumber: '0x63' }), 422, 'too_old');
    await is(receipt([log({ from: you.address })]), 422, 'wrong_signer');
    expect(await burnSummary(env)).toMatchObject({ burned: 0, requests: 0 });
  });
  it('waits for confirmations without storing anything', async () => {
    chain.head = 500;
    expect(await send()).toEqual({ status: 202, body: { waiting: true, confirmations: 1, needed: 2 } });
    expect(row(1)).toBeUndefined();
    chain.head = 501;
    expect((await send()).status).toBe(200);
  });
  it('other decimals come from the chain', async () => {
    chain.decimals = 6;
    chain.receipts[TX] = receipt([log({ from: me.address, value: 2_500_000_000n })]);
    expect((await send()).status).toBe(200);
    expect(row(1)).toMatchObject({ amount: '2500000000', tokens: 2500 });
    expect(await burnSummary(env)).toMatchObject({ decimals: 6, amountRaw: '1000000000', burned: 2500 });
  });
  it('a retry needs no node, and settings that changed since do not strand the burn', async () => {
    await send();
    D.db.exec("UPDATE burn_requests SET status = 'failed', attempts = 3");
    chain.down = true; resetChain(); env = { ...env, BURN_AMOUNT: '5000', BURN_FROM_BLOCK: '900' };
    expect((await send(me, { scenario: { ...SCENARIO, price: 171 } })).body).toEqual({ id: 1, status: 'queued' });
    expect((await send(me, { scenario: { ...SCENARIO, price: 171 } })).body).toEqual({ id: 1, status: 'queued' });
    expect(row(1)).toMatchObject({ price: 171, amount: (1000n * ONE).toString() });
    expect((await send(you)).status).toBe(503);
  });
  it('a burn the chain moved to another block is still one burn', async () => {
    await send();
    chain.receipts[TX] = receipt([log({ from: me.address, index: 6 })], { blockNumber: '0x1f5' });
    chain.head = 600;
    expect((await send(me, { scenario: { ...SCENARIO, price: 170 } })).body).toEqual({ error: 'used' });
    expect(await burnSummary(env)).toMatchObject({ burned: 1000, requests: 1 });
  });
  it('an answer already given does not depend on today’s price', async () => {
    await send();
    D.db.exec('UPDATE runs SET spot = 1700');
    expect((await send()).body).toEqual({ id: 1, status: 'queued' });
  });
  it('a price far from the market is refused before the burn is used', async () => {
    expect(await send(me, { scenario: { ...SCENARIO, price: 17 } })).toEqual({ status: 422, body: { error: 'out_of_range' } });
    expect((await send()).status).toBe(200);
  });
  it('a node that is down is a plain 503', async () => { chain.down = true; expect(await send()).toEqual({ status: 503, body: { error: 'unavailable' } }); });
  it('bad, big and too many requests', async () => {
    const b = await signedBody(me), raw = async (body: unknown, h = {}) => (await postBurn(post(body, { 'cf-connecting-ip': String(Math.random()), ...h }), env)).status;
    expect(await raw('{')).toBe(400);
    expect(await raw({ ...b, extra: true })).toBe(400);
    expect(await raw(b, { 'content-type': 'text/plain' })).toBe(400);
    expect(await raw(JSON.stringify(b) + ' '.repeat(8200))).toBe(413);
    expect(await raw({ ...b, signature: '0x' + 'ff'.repeat(65) })).toBe(400);
    const same = [];
    for (let i = 0; i < 32; i++) same.push((await postBurn(post('{', { 'cf-connecting-ip': 'one' }), env)).status);
    expect([same.filter((s) => s === 400).length, same.filter((s) => s === 429).length]).toEqual([30, 2]);
  });
  it('not open until the owner sets every value', async () => {
    for (const k of ['QNTL_TOKEN_PONS', 'BURN_AMOUNT', 'BURN_FROM_BLOCK']) {
      env = makeEnv({ DB: D, [k]: undefined });
      expect(await send()).toEqual({ status: 503, body: { error: 'not_open' } });
      expect(await burnSummary(env)).toMatchObject({ open: false, status: 'Not open yet', token: null, amount: null, amountRaw: null, fromBlock: null });
    }
  });
});

describe('burn queue', () => {
  it('one run per tick, first come first served, and official tables never change', async () => {
    chain.receipts[TX] = receipt([log({ from: me.address }), log({ from: me.address, index: 1 })]);
    await send(); await send(me, { scenario: { ...SCENARIO, price: 170 }, anonymous: true });
    const before = tables();
    expect(await burnRequestView(env, 2)).toMatchObject({ status: 'queued', ahead: 1, by: null, tx: null, run: null });
    await processBurns(env, tick(), at(), quick);
    expect([row(1).status, row(2).status]).toEqual(['done', 'queued']);
    expect((await burnRequestView(env, 2))!.ahead).toBe(0);
    await processBurns(env, tick(), at(), quick);
    expect(row(2).status).toBe('done');
    expect(await processBurns(env, tick(), at(), quick)).toEqual([]);
    expect(tables()).toBe(before);
  });
  it('a stored run can be made again from what is public', async () => {
    await send(); await processBurns(env, tick(), at(), quick);
    const v = (await burnRunView(env, 1))!;
    expect(v).toMatchObject({ label: 'Custom scenario, not an official run', baseRunId: 1, scenario: SCENARIO, pathsPerModel: 500 });
    const again = customRun(base, v.scenario, v.pathsPerModel);
    expect([hashObject(v.inputs), deriveSeed(v.inputs)]).toEqual([v.inputHash, v.seed]);
    expect([again.inputHash, again.seed, again.outputHash, again.result]).toEqual([v.inputHash, v.seed, v.outputHash, v.result]);
  });
  it('waits when the tick is late, or the official run failed, was slow or is old', async () => {
    await send();
    for (const [t, c] of [[tick({ officialFailed: true }), at()], [tick({ officialMs: 30_000 }), at()], [tick(), at(400_000)], [tick({ startedMs: SLOT + 7_200_000 }), at(7_220_000)]] as const) { expect((await processBurns(env, t, c, quick))[0]).toContain('waits'); expect(row(1)).toMatchObject({ status: 'queued', attempts: 0 }); }
  });
  it('a run that keeps failing stops after three tries, and the burn stays usable', async () => {
    await send();
    const boom = () => { throw new Error('engine stopped at https://secret.example/key'); };
    for (let i = 1; i <= MAX_ATTEMPTS; i++) { expect((await processBurns(env, tick(), at(), boom))[0]).toContain('failed'); expect(row(1)).toMatchObject({ attempts: i, status: i < MAX_ATTEMPTS ? 'queued' : 'failed' }); }
    expect(row(1).error).not.toContain('secret');
    expect(await processBurns(env, tick(), at(), boom)).toEqual([]);
    expect((await send(you)).body).toEqual({ error: 'wrong_signer' });
    expect((await send(me, { scenario: { ...SCENARIO, price: 175 } })).body).toEqual({ id: 1, status: 'queued' });
    expect(row(1)).toMatchObject({ attempts: 0, price: 175, error: null });
    await processBurns(env, tick(), at(), quick);
    expect(row(1).status).toBe('done');
    expect((await send(me, { scenario: { ...SCENARIO, price: 176 } })).body).toEqual({ error: 'used' });
    expect(await burnSummary(env)).toMatchObject({ burned: 1000, requests: 1 });
  });
  it('the same message also retries a failed run', async () => {
    await send();
    D.db.exec("UPDATE burn_requests SET status = 'failed', attempts = 3");
    expect((await send()).body).toEqual({ id: 1, status: 'queued' });
  });
  it('one failing request does not hold up the next', async () => {
    chain.receipts[TX] = receipt([log({ from: me.address }), log({ from: me.address, index: 1 })]);
    await send(); await send(me, { scenario: { ...SCENARIO, price: 170 } });
    D.db.exec("UPDATE burn_requests SET queued_at = '2026-11-24T14:00:00.000Z'");
    await processBurns(env, tick(), at(), () => { throw new Error('x'); });
    await processBurns(env, tick(), at(), quick);
    expect([row(1).status, row(2).status]).toEqual(['queued', 'done']);
  });
  it('an attempt that was killed is tried again, and counts', async () => {
    await send();
    const killed = (attempts: number) => D.db.exec(`UPDATE burn_requests SET status = 'running', attempts = ${attempts}, started_at = '${new Date(SLOT - 1_200_000).toISOString()}'`);
    killed(1); await processBurns(env, tick(), at(), quick); expect(row(1)).toMatchObject({ status: 'done', attempts: 2 });
    D.db.exec('DELETE FROM burn_runs'); killed(3);
    expect(await processBurns(env, tick(), at(), quick)).toEqual([]);
    expect(row(1).status).toBe('failed');
  });
  it('a run in progress is left alone', async () => {
    await send();
    D.db.exec(`UPDATE burn_requests SET status = 'running', attempts = 1, started_at = '${new Date(SLOT).toISOString()}'`);
    expect(await processBurns(env, tick(), at(), quick)).toEqual([]);
    expect(row(1).status).toBe('running');
  });
});

describe('burn pages', () => {
  const ctx = { waitUntil: () => {} } as any, get = (p: string) => handleApi(new Request('https://x.test' + p), env, ctx, async () => ({}));
  it('counts verified burns, gallery by time and by distance, and never shows a full address', async () => {
    chain.receipts[TX] = receipt([log({ from: me.address, value: 1500n * ONE }), log({ from: me.address, index: 1 }), log({ from: you.address, index: 2 })]);
    await send(me, { scenario: { ...SCENARIO, price: 90 } }); await send(me, { scenario: { ...SCENARIO, price: 181 } }); await send(you, { anonymous: true });
    expect(await burnSummary(env)).toMatchObject({ burned: 3500, requests: 3 });
    for (let i = 0; i < 3; i++) await processBurns(env, tick(), at(), quick);
    expect((await burnGallery(env, 'latest')).map((g) => g.id)).toEqual([3, 2, 1]);
    expect((await burnGallery(env, 'extreme')).map((g) => g.id)).toEqual([1, 3, 2]);
    const texts = await Promise.all(['/api/burn', '/api/burn/gallery', '/api/burn/gallery?sort=extreme', '/api/burn/request/1', '/api/burn/request/3', '/api/burn/run/1', '/api/burn/run/3'].map(async (p) => { const r = await get(p); expect(r.status).toBe(200); return r.text(); }));
    for (const t of texts) for (const a of [me, you]) expect(t.toLowerCase()).not.toContain(a.address.toLowerCase().slice(4));
    for (const t of [texts[4], texts[6]]) { expect(JSON.parse(t).by).toBeNull(); expect(t).not.toContain(TX); }
    expect(texts[5]).toContain(TX);
    expect(JSON.parse(texts[1])[0]).toMatchObject({ by: null, shape: expect.any(Array) });
    expect(texts.join()).not.toContain('signature');
  });
  it('unknown ids are 404', async () => { for (const p of ['/api/burn/request/9', '/api/burn/run/9', '/api/burn/run/x', '/api/burn/nothing']) expect((await get(p)).status).toBe(404); });
  it('the request goes through the API without touching the cache', async () => {
    const r = await handleApi(post(await signedBody(me)), env, ctx, async () => ({}));
    expect([r.status, r.headers.get('cache-control')]).toEqual([200, 'no-store']);
    expect(await r.json()).toEqual({ id: 1, status: 'queued' });
  });
});
