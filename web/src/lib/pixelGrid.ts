/** PixelField state: 0 empty, 1 kept, 2 lost. Counts are exact at every step except while a new split is being reached. */
export type Cells = Uint8Array;
export type Rnd = () => number;

export const EMPTY_SHARE = 0.15; // texture only
export const TICK_MS = 140;
export const SWAP_SHARE = 0.044; // pairs swapped per tick, as a share of all cells
export const MOVE_TICKS = 11; // ~1.5s to reach a new split

export const filledCells = (n: number) => n * n - Math.round(n * n * EMPTY_SHARE);
/** futures each filled pixel stands for */
export const futuresPerPixel = (n: number) => Math.round(1_000_000 / filledCells(n));
export const keptCells = (n: number, kept: number) => Math.round(kept * filledCells(n));
export const count = (cells: Cells, v: number) => { let k = 0; for (const c of cells) if (c === v) k++; return k; };

export function createCells(n: number, kept: number, rnd: Rnd): Cells {
  const cells = new Uint8Array(n * n), filled = filledCells(n), k = keptCells(n, kept);
  cells.fill(1, 0, k);
  cells.fill(2, k, filled);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)), t = cells[i];
    cells[i] = cells[j]; cells[j] = t;
  }
  return cells;
}

/** One shimmer step: swap random pairs. Calls `draw` for each cell whose content changed. */
export function shimmer(cells: Cells, rnd: Rnd, draw: (i: number) => void) {
  const total = cells.length;
  for (let p = Math.round(total * SWAP_SHARE); p > 0; p--) {
    const a = Math.floor(rnd() * total), b = Math.floor(rnd() * total);
    if (cells[a] === cells[b]) continue;
    const t = cells[a];
    cells[a] = cells[b]; cells[b] = t;
    draw(a); draw(b);
  }
}

/** Convert a share of the cells still needed to reach `target` kept cells; all of them when `ticksLeft` is 1. */
export function moveToward(cells: Cells, target: number, ticksLeft: number, rnd: Rnd, draw: (i: number) => void) {
  const diff = target - count(cells, 1);
  if (!diff) return;
  const from = diff > 0 ? 2 : 1, to = diff > 0 ? 1 : 2;
  const pool: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === from) pool.push(i);
  for (let left = Math.min(pool.length, Math.ceil(Math.abs(diff) / Math.max(1, ticksLeft))); left > 0; left--) {
    const j = Math.floor(rnd() * pool.length), i = pool[j];
    pool[j] = pool[pool.length - 1]; pool.pop();
    cells[i] = to;
    draw(i);
  }
}
