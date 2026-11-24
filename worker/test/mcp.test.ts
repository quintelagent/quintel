import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from '../src/api';
import { resetCache } from '../src/cache';
import { badArgs, CALLS_PER_MIN, handleMcp, overLimit } from '../src/mcp';
import { plain } from '../src/mcpTools';
import { inputsLabel, MCP_TOOLS, ODDS_NOTE, type McpTool } from '../../web/src/lib/mcpTools';
import { cdfFromHist } from '../../web/src/lib/cdf';
import { odds } from '../../web/src/lib/format';
import { deriveSeed, runScenarios } from '../../engine/src/index';
import { baseInputs } from '../../engine/test/fixtures';

const inputs = { ...baseInputs(), version: 2 as const, levels: { backAbove: 186.64, giveBack: 145.29 } };
const out = runScenarios(inputs, deriveSeed(inputs), { pathsPerModel: 4000 });
const H = out.combined.horizons, P = out.combined.probs;
const summary = {
  spot: out.spot, priceSource: 'stock', session: 'open', agreement: out.agreement, expMaxDrawdown1m: out.combined.expMaxDrawdown1m, var95_1m: 0.4, touch: out.touch, newsIntensity: 1,
  stress: { level: 77, components: {}, weights: {} }, horizons: H.map((h, i) => ({ days: h.days, p5: h.pct.p5, p25: h.pct.p25, p50: h.pct.p50, p75: h.pct.p75, p95: h.pct.p95, pUp: P[i].pUp, pDown10: P[i].pDown10, pDown20: P[i].pDown20 })),
};
const run = { id: 135, ts: new Date(Date.now() - 60000).toISOString(), session: 'open', seed: 'ab', input_hash: '0xin', output_hash: '0xout', spot: out.spot, price_source: 'stock', stress: 77, summary };
const old = { ...run, id: 24, summary: { ...summary, touch: null } };
const API: Record<string, unknown> = {
  '/api/latest': { run }, '/api/output/135': { id: 135, output: out }, '/api/run/135': run, '/api/run/24': old,
  '/api/fingerprint-for-run?id=135': { hour: run.ts, status: 'not_yet' }, '/api/fingerprint-for-run?id=24': { hour: run.ts, status: 'sent', hash: '0xf', tx: '0xt' },
  '/api/briefings?limit=5': [1, 2, 3, 4].map((n) => ({ id: 90 - n, ts: run.ts, run_id: 135, hash: '0xb' + n, model: 'm', fallback: 0, body: { headline: `Headline ${n}`, whatChanged: ['Crisis level held.'], scenarioSummary: 'pUpPct is 52%.', keyRisks: [], watchNext: [], sources: [{ title: 'T', url: 'https://x.example/a', publishedAt: run.ts }, { title: 'bad', url: 'javascript:1', publishedAt: '' }] } })),
  '/api/proof': { sent: 42, pending: 1, explorer: 'https://ex', chainId: 4663, wallet: '0xw', fingerprints: Array.from({ length: 9 }, (_, i) => ({ hour: run.ts, hash: '0xh' + i, tx: i ? '0xt' + i : null, status: i ? 'sent' : 'pending' })) },
};
let reads: string[] = [];
const get = async (p: string) => { reads.push(p); return (API[p] ?? null) as any; };
const down = async () => { throw new Error('D1_ERROR secret detail'); };
beforeEach(() => { reads = []; });

const post = (body: unknown, headers: Record<string, string> = {}, g: any = get) =>
  handleMcp(new Request('https://q.test/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), g);
const rpc = async (method: string, params?: unknown, g?: any) => (await post({ jsonrpc: '2.0', id: 1, method, params }, {}, g)).json() as any;
const call = async (name: string, args?: unknown, g?: any) => (await rpc('tools/call', { name, arguments: args }, g)).result;
const M = 'io.modelcontextprotocol/';
const modern = (method: string, params: any = {}, h: Record<string, string> = {}, v = '2026-07-28') =>
  post({ jsonrpc: '2.0', id: 7, method, params: { ...params, _meta: { [M + 'protocolVersion']: v, [M + 'clientInfo']: { name: 't', version: '1' }, [M + 'clientCapabilities']: {} } } }, { 'mcp-protocol-version': v, 'mcp-method': method, ...(params.name ? { 'mcp-name': params.name } : {}), ...h });

describe('mcp transport', () => {
  it('initialize agrees on a version', async () => {
    for (const [ask, got] of [['2025-06-18', '2025-06-18'], ['2025-03-26', '2025-03-26'], ['2025-11-25', '2025-11-25'], ['2024-11-05', '2025-11-25'], ['2099-01-01', '2025-11-25']]) {
      const r = (await rpc('initialize', { protocolVersion: ask, capabilities: {}, clientInfo: { name: 't', version: '1' } })).result;
      expect(r).toMatchObject({ protocolVersion: got, capabilities: { tools: {} }, serverInfo: { name: 'quintel' } });
      expect(r.resultType).toBeUndefined();
    }
    expect((await rpc('initialize', {})).error.code).toBe(-32602);
  });
  it('notifications and stray responses get 202 with no body', async () => {
    for (const b of [{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', method: 'notifications/whatever' }, { jsonrpc: '2.0', id: 3, result: {} }]) {
      const r = await post(b); expect(r.status).toBe(202); expect(await r.text()).toBe('');
    }
  });
  it('ping, list, unknown method', async () => {
    expect((await rpc('ping')).result).toEqual({});
    const { tools } = (await rpc('tools/list')).result;
    expect(tools.map((t: any) => t.name)).toEqual(MCP_TOOLS.map((t) => t.name));
    for (const t of tools) { expect(t.inputSchema).toMatchObject({ type: 'object', additionalProperties: false }); expect(t.annotations.readOnlyHint).toBe(true); }
    expect((await rpc('resources/list')).error.code).toBe(-32601);
  });
  it('methods, types, sizes and broken bodies', async () => {
    const g = await handleMcp(new Request('https://q.test/api/mcp'), get);
    expect(g.status).toBe(405); expect(g.headers.get('allow')).toContain('POST');
    expect((await handleMcp(new Request('https://q.test/api/mcp', { method: 'DELETE' }), get)).status).toBe(405);
    const o = await handleMcp(new Request('https://q.test/api/mcp', { method: 'OPTIONS' }), get);
    expect(o.status).toBe(204); expect(o.headers.get('access-control-allow-origin')).toBe('*'); expect(o.headers.get('access-control-allow-headers')).toContain('mcp-protocol-version');
    expect((await post('{}', { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { accept: 'text/html' })).status).toBe(406);
    expect((await post('{oops')).status).toBe(400);
    for (const b of ['null', '"x"', '{}', '{"jsonrpc":"1.0","id":1,"method":"ping"}', '{"jsonrpc":"2.0","id":null,"method":"ping"}', '{"jsonrpc":"2.0","id":{},"method":"ping"}', '{"jsonrpc":"2.0","id":1}']) { const r = await post(b); expect(r.status).toBe(400); expect(((await r.json()) as any).error.code).toBe(-32600); }
    expect((await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { x: 'a'.repeat(66000) } }))).status).toBe(413);
    const r = await post({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(r.headers.get('content-type')).toBe('application/json'); expect(r.headers.get('cache-control')).toBe('no-store'); expect(r.headers.get('mcp-session-id')).toBeNull();
  });
  it('a stream without a length is cut off at the limit', async () => {
    let sent = 0;
    const body = new ReadableStream({ pull(c) { sent += 8192; c.enqueue(new Uint8Array(8192)); if (sent > 4e6) c.close(); } });
    const r = await handleMcp(new Request('https://q.test/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' } as RequestInit), get);
    expect(r.status).toBe(413); expect(sent).toBeLessThan(200_000);
  });
  it('batches only where that version has them', async () => {
    const two = [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'nope' }];
    const r = await (await post(two)).json() as any[];
    expect(r.map((x) => x.id)).toEqual([1, 2]);
    expect((await post(two, { 'mcp-protocol-version': '2025-11-25' })).status).toBe(400);
    expect((await post([])).status).toBe(400);
    expect((await post(Array(11).fill(two[0]))).status).toBe(400);
    expect((await post([two[1]])).status).toBe(202);
  });
});

describe('mcp 2026-07-28', () => {
  it('discover, list and call carry the new result fields', async () => {
    const d = ((await (await modern('server/discover')).json()) as any).result;
    expect(d).toMatchObject({ resultType: 'complete', capabilities: { tools: {} }, cacheScope: 'public' }); expect(d.supportedVersions).toContain('2026-07-28'); expect(d._meta[M + 'serverInfo'].name).toBe('quintel'); expect(d.ttlMs).toBeGreaterThan(0);
    const l = ((await (await modern('tools/list')).json()) as any).result;
    expect(l.tools).toHaveLength(MCP_TOOLS.length); expect(l.ttlMs).toBeGreaterThan(0);
    const c = ((await (await modern('tools/call', { name: 'get_latest_odds', arguments: {} })).json()) as any).result;
    expect(c.resultType).toBe('complete'); expect(c.structuredContent.runId).toBe(135); expect(c.ttlMs).toBeUndefined();
    expect((await modern('tools/call', { name: 'get_latest_odds' }, { 'mcp-name': '=?base64?Z2V0X2xhdGVzdF9vZGRz?=' })).status).toBe(200);
  });
  it('headers must match the body', async () => {
    const code = async (r: Response) => [r.status, ((await r.json()) as any).error.code];
    expect(await code(await modern('tools/list', {}, { 'mcp-method': 'ping' }))).toEqual([400, -32020]);
    expect(await code(await modern('tools/list', {}, { 'mcp-protocol-version': '2025-11-25' }))).toEqual([400, -32020]);
    expect(await code(await modern('tools/call', { name: 'get_proof' }, { 'mcp-name': 'get_run' }))).toEqual([400, -32020]);
    expect(await code(await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list' }))).toEqual([400, -32020]);
    const r = await modern('tools/list', {}, {}, '2099-01-01'); expect(r.status).toBe(400);
    expect(((await r.json()) as any).error).toMatchObject({ code: -32022, data: { requested: '2099-01-01' } });
    expect(await code(await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'mcp-protocol-version': '1999-01-01' }))).toEqual([400, -32022]);
    for (const m of ['ping', 'initialize', 'resources/list']) expect(await code(await modern(m))).toEqual([404, -32601]);
  });
});

describe('mcp tools', () => {
  it('every result has the run, both times and the note', async () => {
    for (const [n, a] of [['get_latest_odds', {}], ['get_odds_at_price', { price: 150, horizon: '1w' }], ['get_run', { id: 135 }], ['get_briefings', {}], ['get_proof', undefined]] as const) {
      const r = await call(n, a);
      expect(r.isError, n).toBe(false);
      expect(r.content[0].text.endsWith(ODDS_NOTE)).toBe(true); expect(r.content[0].text).toContain('Run 135, '); expect(r.content[0].text).toContain(run.ts); expect(r.content[0].text).toMatch(/\d(am|pm) ET/);
      expect(r.structuredContent).toMatchObject({ runId: 135, timeISO: run.ts, note: ODDS_NOTE }); expect(r.structuredContent.timeET).toMatch(/, 20\d\d, .* ET$/);
      const all = JSON.stringify(r); expect(all).not.toMatch(/crisis|NaN|undefined|predict|forecast|\bbuy\b|\bsell\b/i); expect(all).not.toContain('javascript:');
    }
  });
  it('odds at a price match the drag tool', async () => {
    for (const [k, i] of [['1d', 0], ['1w', 1], ['1m', 2]] as const) {
      const r = await call('get_odds_at_price', { price: 151.5, horizon: k }), b = cdfFromHist(H[i], 151.5, out.totalPaths);
      expect(r.structuredContent.endOfHorizon.below.text).toBe(odds(b)); expect(r.structuredContent.endOfHorizon.atOrAbove.text).toBe(odds(1 - b));
      expect(r.structuredContent.anyDailyCloseAbove).toBeNull(); expect(r.content[0].text).toContain('end of the horizon only');
    }
    const level = await call('get_odds_at_price', { price: 186.64, horizon: '1m' });
    expect(level.structuredContent.anyDailyCloseAbove.text).toBe(odds(out.touch!.backAbove.p)); expect(level.content[0].text).toContain('any daily close');
    expect((await call('get_odds_at_price', { price: 186.65, horizon: '1m' })).structuredContent.anyDailyCloseAbove).toBeNull();
    const far = (await call('get_odds_at_price', { price: 90000, horizon: '1d' })).structuredContent.endOfHorizon;
    expect(far).toMatchObject({ atOrAbove: { text: '<0.1%', percent: null }, below: { text: '>99.9%', percent: null } });
  });
  it('bad inputs are refused in plain words, before any read', async () => {
    const cases: [string, unknown][] = [
      ['get_odds_at_price', {}], ['get_odds_at_price', { price: '186.64', horizon: '1m' }], ['get_odds_at_price', { price: 0, horizon: '1m' }], ['get_odds_at_price', { price: -3, horizon: '1m' }], ['get_odds_at_price', { price: 1e9, horizon: '1m' }], ['get_odds_at_price', { price: 150 }], ['get_odds_at_price', { price: 150, horizon: '2m' }], ['get_odds_at_price', { price: 150, horizon: '1m', symbol: 'ZZSECRET' }],
      ['get_run', { id: 1.5 }], ['get_run', { id: 0 }], ['get_run', { id: '135' }], ['get_run', { id: null }], ['get_briefings', { limit: 6 }], ['get_briefings', { limit: 0 }], ['get_proof', { x: 1 }], ['get_latest_odds', { __proto__x: 1 }],
    ];
    for (const [n, a] of cases) { const r = await call(n, a); expect(r.isError, JSON.stringify(a)).toBe(true); expect(r.content[0].text).not.toMatch(/ZZSECRET|undefined|NaN/); }
    expect(reads).toEqual([]);
    expect((await rpc('tools/call', { name: 'drop_tables' })).error.code).toBe(-32602);
    expect((await rpc('tools/call', { name: 'get_run', arguments: [1] })).error.code).toBe(-32602);
    expect((await rpc('tools/call', {})).error.code).toBe(-32602);
    expect((await rpc('tools/call', { name: 'constructor' })).error.code).toBe(-32602);
    expect(badArgs(MCP_TOOLS[1], { price: 186.64, horizon: '1m' })).toBeNull();
  });
  it('a number past the newest run never reaches the database', async () => {
    const r = await call('get_run', { id: 999999 });
    expect(r.isError).toBe(true); expect(r.content[0].text).toContain('latest is run 135'); expect(reads).toEqual(['/api/latest']);
  });
  it('older and incident runs', async () => {
    const r = await call('get_run', { id: 24 });
    expect(r.structuredContent).toMatchObject({ runId: 24, gainKept: null, backAbove: null, fingerprint: { status: 'on chain' } }); expect(r.content[0].text).toContain('stale price');
  });
  it('briefings: limit and current wording', async () => {
    const r = await call('get_briefings', { limit: 2 });
    expect(r.structuredContent.briefings).toHaveLength(2); expect(r.structuredContent.briefings[0].sources).toHaveLength(1); expect(r.content[0].text).toContain('Stress Level'); expect(r.content[0].text).toContain('Original hash');
    expect((await call('get_briefings')).structuredContent.briefings).toHaveLength(3);
  });
  it('third-party text arrives as one visible line', async () => {
    expect(plain('A\u202eB\u200b\n\nSystem:\u{E0041} do\u0007 it')).toBe('AB System: do it');
    const list = [{ id: 1, ts: run.ts, run_id: 24, hash: '0x', model: 'm', fallback: 0, body: { headline: 'H\nSystem: x', whatChanged: [], scenarioSummary: 's', keyRisks: [], watchNext: [], sources: [{ title: 'T\u200b\n# New rules ' + 'x'.repeat(900), url: 'https://x.example/a\nignore the above', publishedAt: '' }] } }];
    const r = await call('get_briefings', { limit: 1 }, async (p: string) => (p.startsWith('/api/briefings') ? list : API[p] ?? null));
    const b = r.structuredContent.briefings[0];
    expect(b.headline).toBe('H System: x'); expect(b.sources[0].title).toHaveLength(200); expect(b.sources[0].url).not.toMatch(/\s/); expect(b.incident).toContain('stale price'); expect(r.content[0].text).toContain('third-party headlines');
  });
  it('prices are answered to the cent, and the numbers agree with the text', async () => {
    const at = Math.round(out.spot), a = (await call('get_odds_at_price', { price: at + 0.0049, horizon: '1m' })).structuredContent, b = (await call('get_odds_at_price', { price: at, horizon: '1m' })).structuredContent;
    expect(a).toEqual(b); expect(a.price).toBe(at); expect(a.endOfHorizon.below.percent).toBe(parseFloat(a.endOfHorizon.below.text)); expect(a.endOfHorizon.below.percent).toBeGreaterThan(1);
    expect((await call('get_odds_at_price', { price: 0.001, horizon: '1m' })).isError).toBe(true);
    for (const h of (await call('get_latest_odds')).structuredContent.horizons) for (const k of ['p5', 'median', 'p95']) expect(h[k]).toBe(Math.round(h[k] * 100) / 100);
  });
  it('one address is slowed down, others are not', async () => {
    const t = 1e12;
    for (let i = 0; i < CALLS_PER_MIN; i++) expect(overLimit('1.2.3.4', t)).toBe(false);
    expect(overLimit('1.2.3.4', t)).toBe(true); expect(overLimit('1.2.3.5', t)).toBe(false); expect(overLimit(null, t)).toBe(false); expect(overLimit('1.2.3.4', t + 60000)).toBe(false);
    for (let i = 0; i <= CALLS_PER_MIN; i++) overLimit('2001:db8:1:2::' + i);
    reads = [];
    const ask = (ip: string) => post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_latest_odds' } }, { 'cf-connecting-ip': ip });
    const r = (await (await ask('2001:db8:1:2:9:9:9:9')).json()) as any;
    expect(r.result.isError).toBe(true); expect(r.result.content[0].text).toContain('Too many requests'); expect(reads).toEqual([]);
    expect(((await (await ask('9.9.9.9')).json()) as any).result.isError).toBe(false);
  });
  it('no runs yet, and a database that is down, say so without details', async () => {
    expect((await call('get_latest_odds', {}, async () => ({ run: null }))).content[0].text).toContain('no runs yet');
    for (const t of MCP_TOOLS) { const r = await call(t.name, t.name === 'get_run' ? { id: 1 } : t.name === 'get_odds_at_price' ? { price: 1, horizon: '1d' } : {}, down); expect(r.isError).toBe(true); expect(r.content[0].text).toContain('Try again'); expect(JSON.stringify(r)).not.toContain('D1'); }
  });
  it('the page reads its inputs from the same list', () => {
    expect((MCP_TOOLS as readonly McpTool[]).map(inputsLabel)).toEqual(['None', 'price, horizon (1d, 1w, 1m)', 'id', 'limit (1–5)', 'None']);
  });
});

describe('mcp route', () => {
  const ctx = { waitUntil() {} } as any, tick = vi.fn();
  const env = (o: object = {}) => ({ DB: { batch: async () => { throw new Error('D1 down'); }, prepare: () => { throw new Error('D1 down'); } }, ...o }) as any;
  const req = (method: string, path = '/api/mcp', body?: string) => new Request('https://q.test' + path, { method, headers: { 'content-type': 'application/json' }, body });
  beforeEach(() => resetCache());
  it('flag off: 404 for every method', async () => { for (const m of ['GET', 'POST', 'OPTIONS', 'DELETE']) expect((await handleApi(req(m, '/api/mcp', m === 'POST' ? '{}' : undefined), env(), ctx, tick)).status).toBe(404); });
  it('flag on: answers, and the rest of the API still refuses other methods', async () => {
    const e = env({ PREVIEW_FLAGS: 'MCP_SERVER', ADMIN_TOKEN: 'k' });
    expect((await handleApi(req('POST', '/api/mcp', '{"jsonrpc":"2.0","id":1,"method":"ping"}'), e, ctx, tick)).status).toBe(200);
    expect((await handleApi(req('GET'), e, ctx, tick)).status).toBe(405);
    expect((await handleApi(req('POST', '/api/latest', '{}'), e, ctx, tick)).status).toBe(405);
    expect((await handleApi(req('POST', '/api/admin/tick', '{}'), e, ctx, tick)).status).toBe(401);
    expect(tick).not.toHaveBeenCalled();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await (await handleApi(req('POST', '/api/mcp', '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_odds_at_price","arguments":{"price":123.45,"horizon":"1m"}}}'), e, ctx, tick)).json() as any;
    expect(r.result.isError).toBe(true); expect(JSON.stringify(r)).not.toContain('D1'); expect(JSON.stringify(err.mock.calls)).not.toContain('123.45');
    err.mockRestore();
  });
});
