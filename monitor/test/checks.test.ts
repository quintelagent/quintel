import { describe, expect, it } from 'vitest';
import { check, step, type Snapshot, type State } from '../src/checks';

const at = (s: string) => new Date(s);
const closed = at('2026-11-24T08:00:00Z'), open = at('2026-11-24T16:00:00Z'), justOpen = at('2026-11-24T14:35:00Z');
const ago = (d: Date, min: number) => new Date(d.getTime() - min * 60000).toISOString();
const good = (d: Date): Snapshot => ({
  site: { status: 200, ok: true }, verify: { status: 200, ok: true },
  latest: { run: { id: 9, ts: ago(d, 5), price_source: 'stock' }, prices: { chain: { ts: ago(d, 5) }, stock: { ts: ago(d, 5) } } },
  health: { ai: { spentUsd: 1, capUsd: 4, capped: false, byModel: [{ purpose: 'triage', calls: 10, ok: 9 }] } },
  proof: { pending: 0, fingerprints: [{ status: 'pending', sent_at: null }, { status: 'sent', sent_at: ago(d, 50) }] }, briefings: [{ ts: ago(d, 20) }], gasEth: 0.009,
});
const ids = (f: (s: Snapshot) => void, d = closed) => { const s = good(d); f(s); return check(s, d).map((p) => p.id); };

describe('checks', () => {
  it('is quiet when all is well, open or closed', () => { for (const d of [closed, open, justOpen]) expect(check(good(d), d)).toEqual([]); });
  it('site, api and feeds', () => {
    expect(ids((s) => { s.site = null; })).toEqual(['site']);
    expect(ids((s) => { s.site = { status: 502, ok: false }; s.verify = null; })).toEqual(['site']);
    expect(ids((s) => { s.verify = null; })).toEqual(['verify']);
    expect(ids((s) => { s.latest = null; })).toEqual(['api']);
    expect(ids((s) => { s.latest.prices.chain = null; })).toEqual(['token-feed']);
    expect(ids((s) => { s.latest.prices.stock.ts = ago(closed, 900); })).toEqual([]);
    expect(ids((s) => { s.latest.prices.stock.ts = ago(open, 30); }, open)).toEqual(['stock-feed']);
  });
  it('runs: 25 min open, 45 closed, grace just after the open', () => {
    expect(ids((s) => { s.latest.run.ts = ago(closed, 40); })).toEqual([]);
    expect(ids((s) => { s.latest.run.ts = ago(closed, 46); })).toEqual(['runs']);
    expect(ids((s) => { s.latest.run.ts = ago(open, 26); }, open)).toEqual(['runs']);
    expect(ids((s) => { s.latest.run.ts = ago(justOpen, 35); }, justOpen)).toEqual([]);
    expect(ids((s) => { s.latest.run = null; })).toEqual(['runs']);
  });
  it('wrong price, fingerprints, gas, ai, briefings', () => {
    expect(ids((s) => { s.latest.run.price_source = 'last_close'; })).toEqual(['price']);
    expect(ids((s) => { s.proof.pending = 2; })).toEqual(['fingerprint-queue']);
    expect(ids((s) => { s.proof.fingerprints[1].sent_at = ago(closed, 140); })).toEqual(['fingerprints']);
    expect(ids((s) => { s.gasEth = 0.0005; })).toEqual(['gas']);
    expect(ids((s) => { s.gasEth = null; })).toEqual([]);
    expect(ids((s) => { s.health.ai.spentUsd = 3.3; })).toEqual(['ai-spend']);
    expect(ids((s) => { s.health.ai.capped = true; s.health.ai.spentUsd = 4; })).toEqual(['ai-cap']);
    expect(ids((s) => { s.health.ai.byModel = [{ purpose: 'briefing', calls: 6, ok: 1 }]; })).toEqual(['ai-briefing']);
    expect(ids((s) => { s.briefings = [{ ts: ago(closed, 80) }]; })).toEqual(['briefings']);
  });
});
describe('alerts', () => {
  it('waits for a second failure, reminds hourly, then says fixed', () => {
    const p = [{ id: 'site', title: 'Site is down', text: 'x', urgent: true }];
    let s: State = {}; const log: string[] = [];
    for (let t = 0; t <= 130; t += 5) { const r = step(s, p, new Date(closed.getTime() + t * 60000)); s = r.state; log.push(...r.messages.map((m) => `${t} ${m.title}`)); }
    expect(log).toEqual(['5 Site is down', '65 Still: Site is down', '125 Still: Site is down']);
    const r = step(s, [], new Date(closed.getTime() + 135 * 60000));
    expect(r.messages[0].title).toBe('Fixed: Site is down'); expect(r.state).toEqual({});
  });
  it('a single blip says nothing', () => {
    const a = step({}, [{ id: 'api', title: 'API is down', text: 'x', urgent: true }], closed);
    expect(a.messages).toEqual([]); expect(step(a.state, [], closed).messages).toEqual([]);
  });
});
