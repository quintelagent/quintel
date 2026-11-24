import type { HorizonStats, RunOutput } from '@engine/types';

/** 0 empty, 1 above the halfway price, 2 at or below it. Row 0 is the highest price. */
export interface Fan { cols: number; rows: number; cells: Uint8Array }

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const N = 3000; // slices of the run, by rank
const TAIL = 0.025; // the most extreme 2.5% of prices on each side falls outside the picture

/** Prices at N evenly spaced ranks, read from a stored spread of all futures. */
function ranks({ hist: { lo, hi, counts } }: HorizonStats): number[] {
  const w = (hi - lo) / counts.length, total = counts.reduce((a, b) => a + b, 0), out: number[] = [];
  let k = 0, below = 0;
  for (let u = 0; u < N; u++) {
    const t = ((u + 0.5) / N) * total;
    while (below + counts[k] < t && k < counts.length - 1) below += counts[k++];
    out.push(lo + w * (k + (t - below) / Math.max(1, counts[k])));
  }
  return out;
}

/**
 * The futures fanning out over one week: the 1-day and 1-week spreads are the run's own (all futures),
 * the days between join them by rank. Density becomes an ordered pixel pattern.
 */
export function fanOf(out: RunOutput, cols: number, rows: number): Fan | null {
  const day = out.combined.horizons.find((h) => h.days === 1), week = out.combined.horizons.find((h) => h.days === 5);
  if (!day || !week) return null;
  const q1 = ranks(day), q5 = ranks(week), spot = out.spot;
  const lo = Math.min(q5[Math.floor(N * TAIL)], spot), hi = Math.max(q5[Math.floor(N * (1 - TAIL))], spot);
  const y = (v: number) => ((hi - v) / (hi - lo)) * (rows - 1);
  const halfway = out.touch?.giveBack.level;
  const split = halfway === undefined ? Infinity : y(halfway);
  const cells = new Uint8Array(cols * rows), col = new Float64Array(rows);
  for (let c = 0; c < cols; c++) {
    const r = Math.sqrt((c / (cols - 1)) * 5);
    col.fill(0);
    for (let u = 0; u < N; u++) {
      const a = q1[u] - spot, b = q5[u] - spot;
      const p = y(spot + (r <= 1 ? a * r : a + ((b - a) * (r - 1)) / (Math.sqrt(5) - 1)));
      const j = Math.floor(p), f = p - j;
      if (j >= 0 && j < rows) col[j] += 1 - f;
      if (j + 1 >= 0 && j + 1 < rows) col[j + 1] += f;
    }
    const even = N / rows;
    for (let j = 0; j < rows; j++) {
      const d = Math.sqrt(Math.min(1, col[j] / (even * 1.35)));
      if (d < 0.97 && (d < 0.3 || d <= (BAYER[j % 4][c % 4] + 0.5) / 16)) continue;
      cells[j * cols + c] = j >= split ? 2 : 1;
    }
  }
  return { cols, rows, cells };
}
