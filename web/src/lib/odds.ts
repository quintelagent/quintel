import { useEffect, useState } from 'react';
import type { EngineInputs, HorizonStats, RunOutput, Shock } from '@engine/types';
import { api, type RunFull } from './api';
import { cdfFromHist } from './cdf';
import { useData } from './data';
import { runInBrowser } from './engineClient';
import { etShortDate } from './format';
import { etParts, horizonDate } from './marketState';

export { cdfFromHist };
export interface Axis { lo: number; hi: number }
/** Chart range: the middle 98% of futures, rounded out to whole dollars. */
export function axisOf(h: HorizonStats, step = 1): Axis {
  return { lo: Math.floor(h.pct.p1 / step) * step, hi: Math.ceil(h.pct.p99 / step) * step };
}
/** The histogram redrawn on an axis, as `n` equal columns. */
export function barsOn(h: HorizonStats, total: number, a: Axis, n: number): number[] {
  const at = Array.from({ length: n + 1 }, (_, i) => cdfFromHist(h, a.lo + ((a.hi - a.lo) * i) / n, total));
  return Array.from({ length: n }, (_, i) => Math.max(0, at[i + 1] - at[i]));
}

/** Horizon index (0, 1, 2) → wording. Order matches RunOutput.combined.horizons. */
export const HORIZON_NAMES = ['1 day', '1 week', '1 month'] as const;
export type HorizonKey = '0' | '1' | '2';
export const HORIZON_TABS: { id: HorizonKey; label: string }[] = HORIZON_NAMES.map((label, i) => ({ id: String(i) as HorizonKey, label }));
/** Dec 1: the trading day a horizon lands on (same rule as the scorecard). */
export const landsOn = (runTs: string, days: number) => etShortDate(horizonDate(etParts(new Date(runTs)).date, days));

/** A neutral shock must be left out, so the inputs hash matches the run. */
export const NO_SHOCK: Shock = { drift: 0, jumpMult: 1, volMult: 1 };
export const sameShock = (a: Shock, b: Shock) => a.drift === b.drift && a.jumpMult === b.jumpMult && a.volMult === b.volMult;
export function withShock(inputs: EngineInputs, shock: Shock): EngineInputs {
  const out = { ...inputs, shock };
  if (sameShock(shock, NO_SHOCK)) delete (out as Partial<EngineInputs>).shock;
  return out;
}

/** "163.94", "$1,204.50" or "163,94" → number; null when empty, NaN when unreadable. */
export function parseAmount(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const plain = t.includes('.') ? t.replace(/,/g, '') : /^\d+,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  return Number(plain);
}

export interface RunBase { id: number; ts: string; inputs: EngineInputs; seed: string }
const bases = new Map<number, Promise<RunBase>>();
function loadBase(id: number): Promise<RunBase> {
  let p = bases.get(id);
  if (!p) {
    p = api<RunFull>(`/api/run/${id}`).then((r) => ({ id: r.id, ts: r.ts, inputs: r.inputs, seed: r.seed }));
    bases.set(id, p);
    p.catch(() => bases.delete(id));
    for (const k of bases.keys()) if (bases.size > 2) bases.delete(k);
  }
  return p;
}
/** Inputs and seed of the latest run. Fetched only once `active`; keeps the last good one while a newer run loads. */
export function useRunBase(active: boolean): { base: RunBase | null; error: boolean; retry: () => void } {
  const { latest } = useData();
  const id = latest?.run?.id ?? null;
  const [s, set] = useState<{ base: RunBase | null; error: boolean }>({ base: null, error: false });
  const [n, again] = useState(0);
  useEffect(() => {
    if (!active || id === null) return;
    let alive = true;
    loadBase(id).then((base) => { if (alive) set({ base, error: false }); }).catch(() => { if (alive) set((p) => ({ ...p, error: true })); });
    return () => { alive = false; };
  }, [active, id, n]);
  return { ...s, retry: () => { set((p) => ({ ...p, error: false })); again((x) => x + 1); } };
}

export const POSITION_PATHS = 20_000; // per model, 100,000 in all
export const WHATIF_PATHS = 100_000; // per model, 500,000 in all

const cache = new Map<string, Promise<RunOutput>>();
/** Odds of ending above an entry price: counted exactly over every path, on this device. */
export function positionRun(base: RunBase, entry: number): Promise<RunOutput> {
  const key = `${base.id}:${entry}`;
  let p = cache.get(key);
  if (!p) {
    p = runInBrowser({ ...base.inputs, preCrisisLevel: entry }, base.seed, POSITION_PATHS).then((r) => r.output);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    for (const k of cache.keys()) if (cache.size > 16) cache.delete(k);
  }
  return p;
}
export const profitOdds = (o: RunOutput): number[] => o.combined.probs.map((p) => p.pAbovePreCrisis);
