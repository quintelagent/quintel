import { useEffect, useState } from 'react';
import type { RunOutput, EngineInputs } from '@engine/types';

export interface HorizonSummary { days: number; p5: number; p25: number; p50: number; p75: number; p95: number; pUp: number; pDown10: number; pDown20: number }
export interface RunSummary {
  spot: number; priceSource: 'stock' | 'chain' | 'last_close'; session: 'open' | 'closed';
  stockPrice: number | null; lastClose: number; chainPrice: number | null; gap: number | null;
  event?: { date: string; prevClose: number; close: number; pct: number; halfBack: number } | null;
  touch?: RunOutput['touch'] | null;
  crisis: RunOutput['crisis']; agreement: number; newsIntensity: number;
  horizons: HorizonSummary[]; expMaxDrawdown1m: number; var95_1m: number; preCrisisLevel: number; pAbovePreCrisis1m: number;
}
export interface RunRow { id: number; ts: string; session: string; seed: string; input_hash: string; output_hash: string; spot: number; price_source: string; crisis: number; cpu_ms?: number; summary: RunSummary }
export interface Latest {
  now: string; session: 'open' | 'closed'; nextRunAt: string; nextOpen: string; nextBriefingAt: string | null;
  scenariosToday: number; runsToday: number; scenariosTotal: number;
  prices: { stock: { ts: string; price: number } | null; chain: { ts: string; price: number } | null };
  prevCrisis: number | null;
  run: RunRow | null;
}
export interface Briefing {
  id: number; ts: string; run_id: number; hash: string; model: string; fallback: number;
  body: { headline: string; whatChanged: string[]; scenarioSummary: string; keyRisks: string[]; watchNext: string[]; sources: { title: string; url: string; publishedAt: string }[]; trigger?: string };
}
export interface Fingerprint { hour: string; hash: string; tx: string | null; status: string; attempts: number; created_at: string; sent_at: string | null; error: string | null; payload?: any }
export interface Proof { explorer: string; chainId: number; wallet: string | null; fingerprints: Fingerprint[] }
export interface Desk {
  rules: Record<string, number | boolean>;
  state: { cash: number; position: null | { side: string; qty: number; entryPrice: number; entryTs: string }; equity: number; peakEquity: number; maxDrawdown: number; wins: number; losses: number; lastPrice: number; updatedAt: string };
  returnPct: number; winRate: number | null;
  trades: { id: number; ts: string; action: string; side: string; price: number; qty: number; pnl: number | null; reason: string; note: string }[];
  equity: { ts: string; equity: number; price: number }[];
}
export interface Scorecard { status: 'live' | 'collecting'; note: string | null; horizons: { horizon: number; n: number; rate50: number; rate90: number; brier: number }[]; recent: any[] }
export interface SiteConfig {
  symbol: string; chainId: number; explorer: string; nvdaToken: string; fingerprintWallet: string | null;
  tokens: { pons: string | null; solana: string | null };
  deskRules: Record<string, number | boolean>;
  crisisWeights: Record<string, number>;
  models: Record<string, { name: string; oneLiner: string }>;
}
export interface RunFull extends RunRow { inputs: EngineInputs; output: RunOutput }

export async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
}

/** Fetch + poll. Returns [data, error]. */
export function useApi<T>(path: string | null, pollMs = 0): [T | null, string | null] {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () => api<T>(path).then((d) => alive && (setData(d), setErr(null))).catch((e) => alive && setErr(String(e.message || e)));
    load();
    const t = pollMs ? setInterval(load, pollMs) : 0;
    return () => { alive = false; if (t) clearInterval(t); };
  }, [path, pollMs]);
  return [data, err];
}
