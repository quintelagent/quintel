import { useEffect, useMemo, useRef, useState } from 'react';
import type { Briefing, Desk, Latest, Proof, RunRow } from './api';
import { displayText } from './briefing';
import { useData } from './data';
import { etShortDate, etTime, odds, pts } from './format';
import { isIncidentRun, keptChange, keptOf } from './metrics';
import { DEFAULT_SYMBOL, symbolConfig } from './symbols';

export type FeedKind = 'run' | 'briefing' | 'fingerprint' | 'desk';
export interface FeedEvent { key: string; kind: FeedKind; ts: string; label: string; text: string; toast: string; change: number | null; href: string; action?: string }
interface Sources { latest: Latest | null; runs: RunRow[] | null; briefings: Briefing[] | null; proof: Proof | null; desk: Desk | null }

/** The run list can trail the latest run by one, so the latest run leads when it is missing. */
export function withLatestRun(latest: Latest | null, runs: RunRow[] | null): RunRow[] | null {
  const run = latest?.run;
  if (!run) return runs;
  if (!runs) return [run];
  return runs.some((r) => r.id === run.id) ? runs : [run, ...runs];
}

function runEvent(r: RunRow, runs: RunRow[], symbol: string): FeedEvent {
  const base = { key: `run-${r.id}`, kind: 'run' as const, ts: r.ts, label: 'New run', href: '/#hero' };
  const kept = keptOf(r.summary);
  if (isIncidentRun(r.id)) { const text = `Run ${r.id} is listed in incidents`; return { ...base, text, toast: `New run · ${text}`, change: null, href: '/incidents' }; }
  if (kept === null) { const text = `Run ${r.id} finished`; return { ...base, text, toast: `New run · ${text}`, change: null }; }
  const text = `${odds(kept)} keep half of ${symbolConfig(symbol).gainName}`;
  const change = keptChange(runs, r.id);
  return { ...base, text, change, toast: `New run · ${text}${change === null ? '' : ` (${pts(change)})`}` };
}

/** Waiting fingerprints go out in batches. One batch is one event, keyed by its first post so it stays put while the rest land. */
function postings(proof: Proof | null): { first: string; last: string; n: number }[] {
  const sent = (proof?.fingerprints ?? []).flatMap((f) => (f.status === 'sent' && f.sent_at ? [f.sent_at] : [])).sort((a, b) => Date.parse(a) - Date.parse(b));
  const out: { first: string; last: string; n: number }[] = [];
  for (const t of sent) {
    const g = out[out.length - 1];
    if (g && Date.parse(t) - Date.parse(g.last) < 120000) { g.last = t; g.n++; } else out.push({ first: t, last: t, n: 1 });
  }
  return out;
}

/** Every public event, newest first. The feed list and the toasts read this one list. */
export function composeFeed({ latest, runs, briefings, proof, desk }: Sources, symbol = DEFAULT_SYMBOL): FeedEvent[] {
  const all = withLatestRun(latest, runs) ?? [];
  const out: FeedEvent[] = all.map((r) => runEvent(r, all, symbol));
  for (const b of briefings ?? []) {
    const text = displayText(b.body.headline).text;
    out.push({ key: `briefing-${b.id}`, kind: 'briefing', ts: b.ts, label: 'New briefing', text, toast: `New briefing · ${text}`, change: null, href: `/briefings/${b.id}` });
  }
  for (const g of postings(proof)) {
    const toast = 'Fingerprint posted on Robinhood Chain';
    out.push({ key: `fp-${g.first}`, kind: 'fingerprint', ts: g.last, label: 'Proof', text: g.n === 1 ? toast : `${g.n} fingerprints posted on Robinhood Chain`, toast, change: null, href: '/verify', action: 'View' });
  }
  for (const t of desk?.trades ?? []) {
    if (t.action !== 'enter' && t.action !== 'exit') continue;
    const text = `Paper desk ${t.action === 'enter' ? 'opened' : 'closed'} a position`;
    out.push({ key: `desk-${t.id}`, kind: 'desk', ts: t.ts, label: 'Paper trading. No real money.', text, toast: text, change: null, href: '/#desk' });
  }
  return out.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

export interface Feed { events: FeedEvent[]; ready: Record<FeedKind, boolean>; settled: boolean; failed: boolean }

// a source that never arrives must not hold everything back
function useWaited(): boolean {
  const [waited, set] = useState(false);
  useEffect(() => { const t = setTimeout(() => set(true), 8000); return () => clearTimeout(t); }, []);
  return waited;
}
/** True once the run list, which every odds change needs, is in or is not coming. */
export function useRunsSettled(): boolean {
  const { latest, latestError, runs } = useData();
  const waited = useWaited();
  return !!runs || waited || latestError || !!(latest && !latest.run);
}

export function useFeed(symbol = DEFAULT_SYMBOL): Feed {
  const { latest, latestError, runs, briefings, briefingsError, proof, proofError, desk, deskError } = useData();
  const events = useMemo(() => composeFeed({ latest, runs, briefings, proof, desk }, symbol), [latest, runs, briefings, proof, desk, symbol]);
  const waited = useWaited(), runsSettled = useRunsSettled();
  const rest = (!!briefings || briefingsError) && (!!proof || proofError) && (!!desk || deskError) && (!!latest || latestError);
  const settled = rest ? runsSettled : waited && events.length > 0;
  const ready = useMemo(() => ({ run: !!(latest || runs), briefing: !!briefings, fingerprint: !!proof, desk: !!desk, shipped: true }), [latest, runs, briefings, proof, desk]);
  return { events, ready, settled, failed: settled && !events.length && (latestError || briefingsError || proofError || deskError) };
}

export type LiveStatus = 'live' | 'offline' | 'reconnecting';
/** After a drop, the feed is reconnecting until fresh data lands. */
export function useLiveStatus(): LiveStatus {
  const { online, latest, latestError, reload } = useData();
  const was = useRef(online);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (online && !was.current) { setWaiting(true); reload(); }
    was.current = online;
  }, [online, reload]);
  useEffect(() => setWaiting(false), [latest]);
  if (!online) return 'offline';
  return waiting || (latestError && !!latest) ? 'reconnecting' : 'live';
}

/** 1:00am ET today, Nov 23, 4:00pm ET on other days */
export function feedTime(ts: string, now = new Date()): string {
  return etShortDate(ts) === etShortDate(now) ? etTime(ts) : `${etShortDate(ts)}, ${etTime(ts)}`;
}
