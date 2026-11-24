import { useEffect, useMemo, useRef } from 'react';
import { reducedMotion, useInView, useLaptop } from '../../lib/hooks';
import { cell, palette, seeded, useBox } from './canvas';

/** 0 = kept (ink), 1 = lost (risk). Exactly round(lost × cells) cells are lost. */
function arrange(n: number, lost: number, seed: number): Uint8Array {
  const total = n * n, k = Math.round(lost * total), rnd = seeded(seed);
  const score = new Float32Array(total);
  for (let i = 0; i < total; i++) { const x = (i % n) / (n - 1), y = Math.floor(i / n) / (n - 1); score[i] = 0.62 * y + 0.18 * x + 0.62 * rnd(); }
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => score[b] - score[a]);
  const out = new Uint8Array(total);
  for (let j = 0; j < k; j++) out[order[j]] = 1;
  return out;
}

/**
 * The scenario grid: kept futures in ink, lost ones as hollow red cells, in exact proportion.
 * `kept` null draws the empty (loading) grid.
 */
export function PixelField({ kept, seed = 1, n: fixedN, label, animate = true }: { kept: number | null; seed?: number; n?: number; label?: string; animate?: boolean }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const laptop = useLaptop();
  const n = fixedN ?? (laptop ? 100 : 64);
  const { w, dpr } = useBox(box);
  const inView = useInView(box);
  const grid = useMemo(() => (kept === null ? null : arrange(n, 1 - kept, seed)), [kept, seed, n]);
  const shown = useRef<{ n: number; grid: Uint8Array | null } | null>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c || !w) return;
    const ctx = c.getContext('2d')!;
    const pitch = Math.max(2, Math.floor(w / n)), s = pitch - 1, px = pitch * n - 1;
    if (c.width !== px) { c.width = px; c.height = px; }
    c.style.width = c.style.height = px / dpr + 'px';
    const p = palette();
    const col = (x: number, g: Uint8Array | null, flash = false) => {
      ctx.clearRect(x * pitch, 0, pitch, px);
      for (let y = 0; y < n; y++) {
        const v = flash || !g ? 2 : g[y * n + x];
        cell(ctx, x * pitch, y * pitch, s, v === 2 ? p.line : v === 1 ? p.risk : p.ink, v === 1);
      }
    };
    const all = (g: Uint8Array | null) => { for (let x = 0; x < n; x++) col(x, g); };
    const from = shown.current;
    shown.current = { n, grid };
    if (!animate || !grid || !from || from.n !== n || from.grid === grid || !inView || reducedMotion() || document.hidden) { all(grid); return; }
    // stepped wipe: 8 steps at ~10 fps
    all(from.grid);
    let step = 0;
    const t = window.setInterval(() => {
      const a = Math.floor((step * n) / 8), b = Math.floor(((step + 1) * n) / 8);
      for (let x = a; x < b; x++) col(x, grid);
      if (step < 7) { const e = Math.min(n, b + Math.max(1, Math.round(n / 24))); for (let x = b; x < e; x++) col(x, null, true); }
      if (++step >= 8) clearInterval(t);
    }, 100);
    return () => { clearInterval(t); all(grid); };
  }, [grid, w, dpr, n, animate]); // eslint-disable-line

  const per = Math.round(1_000_000 / (n * n)).toLocaleString('en-US');
  const aria = label ?? (kept === null ? 'Scenario grid, loading' : `${(kept * 100).toFixed(1)}% of futures kept, ${((1 - kept) * 100).toFixed(1)}% lost. Each pixel stands for about ${per} futures.`);
  return <div ref={box} className="pixel-field"><canvas ref={cv} role="img" aria-label={aria} /></div>;
}
export const futuresPerPixel = (laptop: boolean) => (laptop ? 100 : 244);
