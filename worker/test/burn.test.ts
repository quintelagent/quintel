import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workerFlag } from '../src/flags';
import { baseInputs } from '../../engine/test/fixtures';
import { deriveSeed, hashObject, outputHash, runScenarios } from '../../engine/src/index';
import { handleApi } from '../src/api';
import { resetCache } from '../src/cache';
import { burnConfig, checkBurn, fetchBurn, rawAmount, readReceipt, resetChain, rpc, tokenDecimals, TRANSFER_TOPIC, type Receipt } from '../src/burn/chain';
import { customRun, skipReason } from '../src/burn/queue';
import { burnDomain, limiter, parseBody, signerOf, tokensOf, visitorKey } from '../src/burn/request';
import { burnMessage, customInputs, parseScenario, priceInSpan, shockText } from '../src/burn/scenario';
import { account, DOMAIN, env, fakeRpc, log, ONE, OTHER, post, receipt, SCENARIO, signedBody, TOKEN, TX } from './burnFixtures';

const me = account(), you = account();
const read = (r: unknown) => readReceipt(r, TX, TOKEN) as Receipt;
const check = (r: unknown, o: { head?: number; signer?: string; min?: bigint; from?: number } = {}) => checkBurn(read(r), o.head ?? 501, o.signer ?? me.address, o.min ?? 1000n * ONE, o.from ?? 100);

describe('burn scenario bounds', () => {
  const shock = { drift: -0.1, jumpMult: 2, volMult: 1.5 };
  it('accepts what the engine has', () => {
    for (const horizon of [1, 5, 21]) expect(parseScenario({ price: 160.25, horizon, shock: null })).toEqual({ price: 160.25, horizon, shock: null });
    expect(parseScenario({ price: 160, horizon: 21, shock })).toEqual({ price: 160, horizon: 21, shock });
    for (const s of [{ drift: -0.3, jumpMult: 5, volMult: 0.5 }, { drift: 0.2, jumpMult: 1, volMult: 3 }, { drift: 0.07, jumpMult: 1.1, volMult: 0.55 }]) expect(parseScenario({ price: 1, horizon: 1, shock: s })?.shock).toEqual(s);
  });
  it('every slider step is clean', () => {
    for (let i = 0; i <= 50; i++) expect(parseScenario({ price: 100, horizon: 1, shock: { drift: -0.3 + i * 0.01, jumpMult: 2, volMult: 1 } })?.shock?.drift).toBe(Math.round(-30 + i) / 100 + 0);
    for (let i = 0; i <= 50; i++) expect(parseScenario({ price: 100, horizon: 1, shock: { drift: -0.1, jumpMult: 1, volMult: 0.5 + i * 0.05 } })?.shock?.volMult).toBe(Math.round(50 + i * 5) / 100);
  });
  it('a shock that changes nothing is no shock', () => {
    expect(parseScenario({ price: 160, horizon: 5, shock: { drift: 0, jumpMult: 1, volMult: 1 } })).toEqual(SCENARIO);
    expect(Object.is(parseScenario({ price: 160, horizon: 5, shock: { drift: -0, jumpMult: 2, volMult: 1 } })!.shock!.drift, 0)).toBe(true);
  });
  it('refuses everything else', () => {
    const bad: unknown[] = [null, [], 'x', {}, { price: 160, horizon: 5 }, { price: 160, horizon: 5, shock: null, extra: 1 }, { price: '160', horizon: 5, shock: null }, { price: 0, horizon: 5, shock: null }, { price: -5, horizon: 5, shock: null },
      { price: NaN, horizon: 5, shock: null }, { price: Infinity, horizon: 5, shock: null }, { price: 160.123, horizon: 5, shock: null }, { price: 2_000_000, horizon: 5, shock: null },
      { price: 160, horizon: 2, shock: null }, { price: 160, horizon: '5', shock: null }, { price: 160, horizon: 5, shock: {} }, { price: 160, horizon: 5, shock: [] },
      { price: 160, horizon: 5, shock: { ...shock, more: 1 } }, { price: 160, horizon: 5, shock: { ...shock, drift: -0.31 } }, { price: 160, horizon: 5, shock: { ...shock, drift: 0.21 } }, { price: 160, horizon: 5, shock: { ...shock, drift: -0.105 } },
      { price: 160, horizon: 5, shock: { ...shock, jumpMult: 0.9 } }, { price: 160, horizon: 5, shock: { ...shock, jumpMult: 5.1 } }, { price: 160, horizon: 5, shock: { ...shock, volMult: 0.45 } }, { price: 160, horizon: 5, shock: { ...shock, volMult: 3.05 } }, { price: 160, horizon: 5, shock: { ...shock, volMult: null } }];
    for (const b of bad) expect(parseScenario(b), JSON.stringify(b)).toBeNull();
  });
  it('keeps the price within ten times the latest price', () => { expect([priceInSpan(18, 180), priceInSpan(1800, 180), priceInSpan(17.99, 180), priceInSpan(1800.01, 180)]).toEqual([true, true, false, false]); });
});

describe('burn message and signer', () => {
  const base = { domain: DOMAIN, chainId: 4663, tx: TX, scenario: SCENARIO, anonymous: false };
  it('is plain text with everything that matters', () => {
    const m = burnMessage({ ...base, scenario: { price: 160.5, horizon: 21, shock: { drift: -0.1, jumpMult: 2, volMult: 1.5 } }, anonymous: true });
    for (const t of [DOMAIN, 'Chain ID: 4663', TX, '$160.50', '1 month', 'drift -10% over 1 month, jumps 2.0x, volatility 1.50x', 'Anonymous', 'Signing is free and moves no tokens.']) expect(m).toContain(t);
    expect(shockText({ drift: 0.2, jumpMult: 1, volMult: 1 })).toContain('drift +20%');
    expect(m).toBe(burnMessage({ ...base, tx: TX.toUpperCase().replace('0X', '0x'), scenario: { price: 160.5, horizon: 21, shock: { drift: -0.1, jumpMult: 2, volMult: 1.5 } }, anonymous: true }));
  });
  it('recovers the signer', async () => { const b = await signedBody(me); expect(await signerOf(burnMessage(base), b.signature)).toBe(me.address.toLowerCase()); });
  it('any change to what was signed is another signer', async () => {
    const { signature } = await signedBody(me);
    const changed = [{ ...base, domain: 'quintelagent.example' }, { ...base, chainId: 1 }, { ...base, tx: '0x' + 'cd'.repeat(32) }, { ...base, anonymous: true }, { ...base, scenario: { ...SCENARIO, price: 160.01 } }, { ...base, scenario: { ...SCENARIO, horizon: 21 as const } }, { ...base, scenario: { ...SCENARIO, shock: { drift: 0.01, jumpMult: 1, volMult: 1 } } }];
    for (const c of changed) expect(await signerOf(burnMessage(c), signature)).not.toBe(me.address.toLowerCase());
  });
  it('a broken signature is nobody', async () => { for (const s of ['0x' + '00'.repeat(65), '0x' + 'ff'.repeat(65)]) expect(await signerOf(burnMessage(base), s as `0x${string}`)).toBeNull(); });
  it('reads the domain from the site address', () => { expect([burnDomain({ SITE_URL: 'https://quintelagent.com' }), burnDomain({})]).toEqual([DOMAIN, DOMAIN]); });
  it('the body is strict JSON', async () => {
    const b = await signedBody(me), j = (x: unknown) => JSON.stringify(x);
    expect(parseBody(j(b))).toEqual(b);
    const { tx: _t, ...noTx } = b;
    for (const x of ['', '{', 'null', '[]', j(noTx), j({ ...b, more: 1 }), j({ ...b, tx: '0x12' }), j({ ...b, tx: 5 }), j({ ...b, anonymous: 'yes' }), j({ ...b, signature: b.signature.slice(0, -2) }), j({ ...b, scenario: { ...b.scenario, price: 'x' } }), j({ ...b, message: 'mine' })]) expect(parseBody(x), x.slice(0, 40)).toBeNull();
  });
});

describe('burn receipts', () => {
  it('a good burn', () => { expect(check(receipt([log({ from: me.address })]))).toEqual({ kind: 'ok', block: 500, burns: [{ logIndex: 0, from: me.address.toLowerCase(), to: '0x000000000000000000000000000000000000dead', value: 1000n * ONE }] }); });
  it('more than the amount is fine, one unit less is not', () => {
    expect(check(receipt([log({ from: me.address, value: 1000n * ONE + 1n })])).kind).toBe('ok');
    expect(check(receipt([log({ from: me.address, value: 1000n * ONE - 1n })])).kind).toBe('too_small');
  });
  it('wrong token', () => { expect(check(receipt([log({ from: me.address, token: OTHER })])).kind).toBe('wrong_token'); expect(check(receipt([])).kind).toBe('wrong_token'); });
  it('wrong recipient', () => { expect(check(receipt([log({ from: me.address, to: you.address }), log({ from: me.address, to: '0x0000000000000000000000000000000000000000', index: 1 })])).kind).toBe('wrong_recipient'); });
  it('reverted', () => { expect(check(receipt([log({ from: me.address })], { status: '0x0' })).kind).toBe('reverted'); expect(check(receipt([log({ from: me.address })], { status: undefined })).kind).toBe('reverted'); });
  it('an old block', () => { expect(check(receipt([log({ from: me.address })]), { from: 501 }).kind).toBe('too_old'); expect(check(receipt([log({ from: me.address })]), { from: 500 }).kind).toBe('ok'); });
  it('someone else signed', () => { expect(check(receipt([log({ from: you.address })])).kind).toBe('wrong_signer'); });
  it('two confirmations', () => {
    const r = receipt([log({ from: me.address })]);
    expect([499, 500].map((head) => check(r, { head }))).toEqual([{ kind: 'waiting', confirmations: 0 }, { kind: 'waiting', confirmations: 1 }]);
    expect(check(r, { head: 501 }).kind).toBe('ok');
    expect(check(receipt([log({ from: me.address })], { blockNumber: null }))).toEqual({ kind: 'waiting', confirmations: 0 });
  });
  it('two burns in one transaction are two burns, in order; small parts are not added up', () => {
    const c = check(receipt([log({ from: me.address, index: 9 }), log({ from: you.address, index: 4 }), log({ from: me.address, index: 3 })]));
    expect(c.kind === 'ok' && c.burns.map((b) => b.logIndex)).toEqual([3, 9]);
    expect(check(receipt([log({ from: me.address, value: 500n * ONE }), log({ from: me.address, value: 500n * ONE, index: 1 })])).kind).toBe('too_small');
  });
  it('other decimals', () => {
    expect([rawAmount(1000, 18), rawAmount(1000, 6), rawAmount(1000, 0)]).toEqual([1000n * ONE, 1_000_000_000n, 1000n]);
    const r = receipt([log({ from: me.address, value: 1_000_000_000n })]);
    expect(check(r, { min: rawAmount(1000, 6) }).kind).toBe('ok');
    expect(check(r, { min: rawAmount(1000, 18) }).kind).toBe('too_small');
    expect([tokensOf(1500n * ONE, 18), tokensOf(1_500_000_000n, 6), tokensOf(15n * ONE / 10n, 18)]).toEqual([1500, 1500, 1.5]);
  });
  it('odd logs are ignored, never trusted', () => {
    const good = log({ from: me.address, index: 7 }), bad = [null, 5, 'x', {}, { address: TOKEN }, log({ from: me.address, removed: true }), log({ from: me.address, topics: [TRANSFER_TOPIC] }), log({ from: me.address, topics: ['0x' + '00'.repeat(32), good.topics[1], good.topics[2]] }),
      log({ from: me.address, topics: [...good.topics, good.topics[1]] }), log({ from: me.address, topics: [TRANSFER_TOPIC, '0x' + 'ff'.repeat(32), good.topics[2]] }), log({ from: me.address, data: '0x' }), log({ from: me.address, data: good.data + '00' }), log({ from: me.address, logIndex: '7' }), log({ from: me.address, logIndex: null })];
    const c = check(receipt([...bad, good]));
    expect(c.kind === 'ok' && c.burns.map((b) => b.logIndex)).toEqual([7]);
    for (const r of [null, 5, 'x', {}, receipt([good], { transactionHash: '0x' + 'cd'.repeat(32) })]) expect(readReceipt(r, TX, TOKEN)).toBeNull();
    for (const logs of [undefined, null, 'x', {}]) expect(check(receipt([], { logs })).kind).toBe('wrong_token');
    expect(read(receipt([good], { blockNumber: 'soon' })).block).toBeNull();
  });
});

describe('burn chain reads', () => {
  beforeEach(resetChain);
  afterEach(() => { vi.unstubAllGlobals(); });
  const meta = () => { const m = new Map<string, string>(); return { m, DB: { prepare: () => ({ bind: (...a: string[]) => ({ first: async () => (m.has(a[0]) ? { value: m.get(a[0]) } : null), run: async () => { m.set(a[0], a[1]); } }) }) } }; };
  it('unknown transactions and nodes that are down are told apart', async () => {
    const s = { receipts: {} as Record<string, unknown>, head: 501, down: false };
    vi.stubGlobal('fetch', fakeRpc(s));
    expect(await fetchBurn(env(), TX, TOKEN)).toBeNull();
    s.receipts[TX] = receipt([log({ from: me.address })]);
    expect((await fetchBurn(env(), TX, TOKEN))?.head).toBe(501);
    s.down = true;
    await expect(fetchBurn(env(), TX, TOKEN)).rejects.toThrow();
  });
  it('a busy node is asked again, three times at most', async () => {
    let n = 0; const busy = (until: number) => vi.stubGlobal('fetch', async () => (++n <= until ? new Response('', { status: 429 }) : new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1237' }))));
    vi.useFakeTimers();
    try {
      resetChain(); busy(2); const a = rpc(env(), 'eth_chainId', []); await vi.advanceTimersByTimeAsync(5000); expect(await a).toBe('0x1237');
      resetChain(); n = 0; busy(99); const b = rpc(env(), 'eth_chainId', []).catch((e) => e.message); await vi.advanceTimersByTimeAsync(5000); expect(await b).toBe('RPC HTTP 429'); expect(n).toBe(3);
    } finally { vi.useRealTimers(); }
  });
  it('falls back to the public node, and skips a node on another chain', async () => {
    const urls: string[] = [], good = fakeRpc({ receipts: {}, head: 7 }), wrong = fakeRpc({ receipts: {}, head: 9, chainId: 1 });
    vi.stubGlobal('fetch', async (u: string, i: any) => { urls.push(u); return u.includes('first') ? wrong(u, i) : good(u, i); });
    expect(await rpc(env({ RPC_URL: 'https://first.test' }), 'eth_blockNumber', [])).toBe('0x7');
    expect(urls[0]).toBe('https://first.test');
  });
  it('decimals are read once and kept', async () => {
    const s = { receipts: {}, head: 1, decimals: 6, calls: [] as string[] }, db = meta(), e = env(db);
    vi.stubGlobal('fetch', fakeRpc(s));
    expect([await tokenDecimals(e, TOKEN), await tokenDecimals(e, TOKEN)]).toEqual([6, 6]);
    resetChain();
    expect(await tokenDecimals(e, TOKEN)).toBe(6);
    expect(s.calls.filter((c) => c === 'eth_call')).toHaveLength(1);
    s.decimals = 77;
    await expect(tokenDecimals(e, OTHER)).rejects.toThrow('decimals');
  });
});

describe('burn settings', () => {
  it('open only when every value is set and well formed', () => {
    expect(burnConfig(env())).toEqual({ token: TOKEN, amount: 1000, fromBlock: 100, chainId: 4663 });
    for (const o of [{ QNTL_TOKEN_PONS: '' }, { QNTL_TOKEN_PONS: undefined }, { QNTL_TOKEN_PONS: '0x12' }, { BURN_AMOUNT: '' }, { BURN_AMOUNT: undefined }, { BURN_AMOUNT: '0' }, { BURN_AMOUNT: '-5' }, { BURN_AMOUNT: '1.5' }, { BURN_AMOUNT: '1e6' }, { BURN_FROM_BLOCK: undefined }, { BURN_FROM_BLOCK: '' }, { BURN_FROM_BLOCK: 'latest' }]) expect(burnConfig(env(o)), JSON.stringify(o)).toBeNull();
  });
  it('counts an IPv6 visitor by its /64', () => {
    expect([visitorKey('1.2.3.4'), visitorKey(null), visitorKey('2001:db8:1:2:3:4:5:6'), visitorKey('2001:0DB8:1:2::9'), visitorKey('2001:db8::1')]).toEqual(['1.2.3.4', 'none', '2001:db8:1:2', '2001:db8:1:2', '2001:db8:0:0']);
  });
  it('a crowd cannot lock everyone else out', () => {
    const ok = limiter(1, 1000);
    for (let i = 0; i < 6000; i++) expect(ok('v' + i, 0)).toBe(true);
    expect([ok('v5999', 1), ok('new', 1)]).toEqual([false, true]);
  });
  it('limits requests without storing anything', () => {
    const ok = limiter(3, 1000);
    expect([ok('a', 0), ok('a', 1), ok('a', 2), ok('a', 3), ok('b', 3), ok('a', 1000)]).toEqual([true, true, true, false, true, true]);
  });
});

describe('custom runs', () => {
  const base = baseInputs(), shocked = { ...SCENARIO, price: 90, shock: { drift: -0.1, jumpMult: 2, volMult: 1.5 } };
  it('same inputs, same hash', () => {
    const a = customRun(base, shocked, 4000), b = customRun(JSON.parse(JSON.stringify(base)), { ...shocked }, 4000);
    expect([b.seed, b.inputHash, b.outputHash]).toEqual([a.seed, a.inputHash, a.outputHash]);
    const again = runScenarios(a.inputs, deriveSeed(a.inputs), { pathsPerModel: 4000 });
    expect([hashObject(a.inputs), outputHash(again)]).toEqual([a.inputHash, a.outputHash]);
  });
  it('only the price level and the shock differ from the official inputs', () => {
    const { preCrisisLevel, shock, ...rest } = customInputs(base, shocked), { preCrisisLevel: _p, ...official } = base;
    expect(rest).toEqual(official);
    expect([preCrisisLevel, shock]).toEqual([90, shocked.shock]);
    expect('shock' in customInputs(base, SCENARIO)).toBe(false);
    expect(customRun(base, shocked, 2000).seed).not.toBe(deriveSeed(base));
  });
  it('gives both sides at all three horizons', () => {
    const { result, out } = customRun(base, { price: 100, horizon: 21, shock: null }, 4000);
    expect(result.horizons.map((h) => h.days)).toEqual([1, 5, 21]);
    for (const h of result.horizons) expect(h.above + h.atOrBelow).toBeCloseTo(1, 6);
    expect(result.above).toBe(out.combined.probs[2].pAbovePreCrisis);
    expect(result.hist).toEqual(out.combined.horizons[2].hist);
  });
  it('leaves the official inputs alone', () => { const before = hashObject(base); customRun(base, shocked, 1000); expect(hashObject(base)).toBe(before); });
  it('full size', () => { const t = Date.now(), r = customRun(base, shocked); expect(r.out.totalPaths).toBe(1_000_000); expect(Date.now() - t).toBeLessThan(60_000); });
  it('waits when the tick is late, slow or failed', () => {
    const slot = Date.UTC(2026, 10, 24, 15, 0), t = (o = {}) => ({ startedMs: slot, officialFailed: false, officialMs: 4000, ...o });
    expect(skipReason(t(), slot + 20_000)).toBeNull();
    expect(skipReason(t({ officialFailed: true }), slot + 20_000)).toContain('failed');
    expect(skipReason(t(), slot + 301_000)).toContain('late');
    expect(skipReason(t({ startedMs: slot + 360_000 }), slot + 370_000)).toContain('late');
    expect(skipReason(t(), slot + 610_000)).toContain('late');
    expect(skipReason(t({ officialMs: 25_000 }), slot + 40_000)).toContain('slow');
  });
});

describe.skipIf(workerFlag({}, 'BURN_TO_RUN'))('burn flag off', () => {
  const ctx = { waitUntil: () => {} } as any, none = async () => ({});
  beforeEach(resetCache);
  it('every endpoint is 404 and nothing is read', async () => {
    const e = env({ PREVIEW_FLAGS: '', DB: new Proxy({}, { get() { throw new Error('read'); } }) });
    for (const p of ['/api/burn', '/api/burn/', '/api/burn/gallery', '/api/burn/request/1', '/api/burn/run/1']) expect((await handleApi(new Request('https://x.test' + p), e, ctx, none)).status).toBe(404);
    expect((await handleApi(post({}), e, ctx, none)).status).toBe(404);
  });
  it('on or off, admin and other methods behave as before', async () => {
    for (const PREVIEW_FLAGS of ['', 'BURN_TO_RUN']) {
      const e = env({ PREVIEW_FLAGS, ADMIN_TOKEN: undefined });
      const at = async (p: string, method: string) => (await handleApi(new Request('https://x.test' + p, { method }), e, ctx, none)).status;
      expect([await at('/api/admin/tick', 'POST'), await at('/api/latest', 'POST'), await at('/api/latest', 'DELETE')]).toEqual([401, 405, 405]);
    }
    const e = env();
    for (const method of ['PUT', 'DELETE', 'PATCH']) expect((await handleApi(new Request('https://x.test/api/burn/request', { method }), e, ctx, none)).status).toBe(405);
    expect((await handleApi(new Request('https://x.test/api/burn', { method: 'POST' }), e, ctx, none)).status).toBe(405);
  });
});
