import type { RunRow, RunSummary } from './api';

/** Share of futures that keep at least half of the event gain for a week (METHODOLOGY.md, "Gain kept"). */
export const keptOf = (s: RunSummary | null | undefined): number | null => (s?.touch ? 1 - s.touch.giveBack.p : null);
export const backAboveOf = (s: RunSummary | null | undefined): { level: number; p: number } | null => (s?.touch ? { level: s.touch.backAbove.level, p: s.touch.backAbove.p } : null);

/** Runs that started from a stale price (docs/incidents). Kept and verifiable, but left out of sparks and changes. */
export const isIncidentRun = (id: number) => id === 24 || (id >= 64 && id <= 78);

/** Change in kept odds between a run and the one before it. Runs newest first. */
export function keptChange(runs: RunRow[] | null, id: number): number | null {
  if (!runs) return null;
  const ok = runs.filter((r) => !isIncidentRun(r.id) && keptOf(r.summary) !== null);
  const i = ok.findIndex((r) => r.id === id);
  if (i < 0 || i + 1 >= ok.length) return null;
  return keptOf(ok[i].summary)! - keptOf(ok[i + 1].summary)!;
}
