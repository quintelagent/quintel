import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunOutput, EngineInputs } from '@engine/types';

export interface HorizonSummary { days: number; p5: number; p25: number; p50: number; p75: number; p95: number; pUp: number; pDown10: number; pDown20: number }
export interface StressBlock { level: number; components: Record<string, number>; weights: Record<string, number> }
export interface RunSummary {
  spot: number; priceSource: 'stock' | 'chain' | 'last_close'; session: 'open' | 'closed';
  stockPrice: number | null; lastClose: number; chainPrice: number | null; gap: number | null;
  event?: { date: string; prevClose: number; close: number; pct: number; halfBack: number } | null;
  touch?: RunOutput['touch'] | null;
  stress: StressBlock; agreement: number; newsIntensity: number;
  horizons: HorizonSummary[]; expMaxDrawdown1m: number; var95_1m: number;
}
export interface RunRow { id: number; ts: string; session: string; seed: string; input_hash: string; output_hash: string; spot: number; price_source: string; stress: number; summary: RunSummary }
export interface Latest {
  now: string; session: 'open' | 'closed'; nextRunAt: string; nextOpen: string; nextBriefingAt: string | null;
  scenariosToday: number; runsToday: number; scenariosTotal: number;
  prices: { stock: { ts: string; price: number } | null; chain: { ts: string; price: number } | null };
  tokenVolume?: { ts: string; usd24h: number; scope: 'pool'; source: string } | null;
  prevStress: number | null;
  run: RunRow | null;
}
export interface Briefing {
  id: number; ts: string; run_id: number; hash: string; model: string; fallback: number;
  body: { headline: string; whatChanged: string[]; scenarioSummary: string; keyRisks: string[]; watchNext: string[]; sources: { title: string; url: string; publishedAt: string }[]; trigger?: string };
}
export interface Fingerprint { hour: string; hash: string; tx: string | null; status: string; attempts: number; created_at: string; sent_at: string | null; error: string | null; payload?: any }
export interface Proof { sent: number; pending: number; lockedFromDayOne: boolean; explorer: string; chainId: number; wallet: string | null; fingerprints: Fingerprint[] }
export interface DeskTrade { id: number; ts: string; action: string; side: string; price: number; qty: number; pnl: number | null; reason: string; note: string }
export interface Desk {
  rules: Record<string, number | boolean>;
  state: { cash: number; position: null | { side: string; qty: number; entryPrice: number; entryTs: string }; equity: number; peakEquity: number; maxDrawdown: number; wins: number; losses: number; lastPrice: number; updatedAt: string };
  returnPct: number; winRate: number | null;
  trades: DeskTrade[];
  equity: { ts: string; equity: number; price: number }[];
}
export interface Scorecard { status: 'live' | 'collecting'; note: string | null; horizons: { horizon: number; n: number; rate50: number; rate90: number; brier: number }[]; recent: any[] }
export interface SiteConfig {
  symbol: string; chainId: number; explorer: string; nvdaToken: string; fingerprintWallet: string | null;
  hearing?: { date: string; label: string; url: string | null } | null;
  tokens: { pons: string | null; solana: string | null };
  deskRules: Record<string, number | boolean>;
  stressWeights: Record<string, number>;
  models: Record<string, { name: string; oneLiner: string }>;
}
export interface Health { ok: boolean; lastTick: { ts: string; session: string; log: string[] } | null; lastRun: { id: number; ts: string } | null }
export interface RunFull extends RunRow { inputs: EngineInputs; output: RunOutput }

export class ApiError extends Error {
  constructor(public status: number) { super('Request failed'); }
}

/** `no-store`: the zone rewrites browser cache lifetimes to hours; the edge cache still absorbs the load. */
export async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!r.ok) throw new ApiError(r.status);
  return r.json() as Promise<T>;
}

export interface Loaded<T> { data: T | null; error: boolean; status: number | null; reload: () => void }

/** Fetch, then poll while the tab is visible. Keeps the last good data on error. */
export function useApi<T>(path: string | null, pollMs = 0): Loaded<T> {
  const [s, set] = useState<{ path: string | null; data: T | null; error: boolean; status: number | null }>({ path, data: null, error: false, status: null });
  const gen = useRef(0);
  const load = useCallback(() => {
    if (!path) return;
    const g = ++gen.current;
    api<T>(path)
      .then((data) => { if (g === gen.current) set({ path, data, error: false, status: 200 }); })
      .catch((e) => { if (g === gen.current) set((p) => ({ path, data: p.path === path ? p.data : null, error: true, status: e instanceof ApiError ? e.status : null })); });
  }, [path]);
  useEffect(() => {
    load();
    let t = 0;
    const start = () => { if (pollMs && !t) t = window.setInterval(load, pollMs); };
    const stop = () => { clearInterval(t); t = 0; };
    const vis = () => { if (document.hidden) stop(); else { if (pollMs) load(); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', vis);
    return () => { gen.current++; stop(); document.removeEventListener('visibilitychange', vis); };
  }, [load, pollMs]);
  const fresh = s.path === path;
  return { data: fresh ? s.data : null, error: fresh && s.error, status: fresh ? s.status : null, reload: load };
}
