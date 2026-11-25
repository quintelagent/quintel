import { describe, expect, it } from 'vitest';
import type { Desk, Latest, Proof, RunRow } from '../src/lib/api';
import { composeFeed, feedTime, withLatestRun } from '../src/lib/feed';

const none = { latest: null, runs: null, briefings: null, proof: null, desk: null };
const run = (id: number) => ({ id, ts: '2026-11-25T16:00:00Z' }) as unknown as RunRow;
const latest = (id: number) => ({ run: run(id) }) as unknown as Latest;
const sent = (...times: string[]) => ({ fingerprints: times.map((sent_at) => ({ status: 'sent', sent_at })) }) as unknown as Proof;

describe('live feed', () => {
  it('leads with the latest run when the list trails it, and never repeats it', () => {
    expect(withLatestRun(latest(2), [run(1)])?.map((r) => r.id)).toEqual([2, 1]);
    expect(withLatestRun(latest(2), [run(2), run(1)])?.map((r) => r.id)).toEqual([2, 1]);
    expect(withLatestRun(latest(2), null)?.map((r) => r.id)).toEqual([2]);
    expect(withLatestRun(null, null)).toBe(null);
  });
  it('joins fingerprints posted within two minutes into one event, newest first', () => {
    const events = composeFeed({ ...none, proof: sent('2026-11-25T16:10:00Z', '2026-11-25T16:01:00Z', '2026-11-25T16:00:00Z') });
    expect(events.map((e) => e.text)).toEqual(['Fingerprint posted on Robinhood Chain', '2 fingerprints posted on Robinhood Chain']);
    expect(events[1].key).toBe('fp-2026-11-25T16:00:00Z');
    expect(events[1].ts).toBe('2026-11-25T16:01:00Z');
  });
  it('leaves out fingerprints that are still waiting', () => {
    const proof = { fingerprints: [{ status: 'queued', sent_at: null }] } as unknown as Proof;
    expect(composeFeed({ ...none, proof })).toEqual([]);
  });
  it('shows paper desk entries and exits only, labeled as paper trading', () => {
    const trades = ['enter', 'hold', 'exit'].map((action, id) => ({ id, action, ts: `2026-11-25T16:0${id}:00Z` }));
    const events = composeFeed({ ...none, desk: { trades } as unknown as Desk });
    expect(events.map((e) => e.text)).toEqual(['Paper desk closed a position', 'Paper desk opened a position']);
    for (const e of events) expect(e.label).toBe('Paper trading. No real money.');
  });
  it('shows the time today and adds the date on other Eastern days', () => {
    const now = new Date('2026-11-25T16:00:00Z');
    expect(feedTime('2026-11-25T06:00:00Z', now)).toBe('1:00am ET');
    expect(feedTime('2026-11-25T04:59:00Z', now)).toBe('Nov 24, 11:59pm ET');
  });
});
