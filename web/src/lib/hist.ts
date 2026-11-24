import type { HorizonStats } from '@engine/types';

/** P(price < v) from a histogram, interpolating linearly inside a bucket. */
export function cdfFromHist(h: HorizonStats, v: number, total: number): number {
  const { lo, hi, counts } = h.hist;
  if (v <= lo) return 0;
  if (v >= hi) return 1;
  const w = (hi - lo) / counts.length;
  const k = Math.min(counts.length - 1, Math.floor((v - lo) / w));
  let s = 0;
  for (let i = 0; i < k; i++) s += counts[i];
  s += counts[k] * ((v - lo - k * w) / w);
  return s / total;
}
