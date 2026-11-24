import { useEffect, useLayoutEffect, useRef } from 'react';
import { odds } from '../../lib/format';
import { useInView, useLaptop, useMedia } from '../../lib/hooks';
import { createCells, futuresPerPixel, keptCells, moveToward, MOVE_TICKS, shimmer, type Cells } from '../../lib/pixelGrid';
import { palette, seeded, useBox } from './canvas';
import { onTick } from './ticker';

/**
 * The scenario grid: kept futures in ink, lost ones in red, scattered, in exact proportion, over 15% empty texture.
 * It shimmers by swapping cells, so the counts never change. `kept` null draws the empty (loading) grid.
 */
export function PixelField({ kept, seed = 1, n: fixedN, label, animate = true, paused = false }: { kept: number | null; seed?: number; n?: number; label?: string; animate?: boolean; paused?: boolean }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const laptop = useLaptop();
  const n = fixedN ?? (laptop ? 100 : 64);
  const { w, dpr } = useBox(box);
  const inView = useInView(box);
  const still = useMedia('(prefers-reduced-motion: reduce)');
  const running = animate && !still && !paused && inView && kept !== null;
  const st = useRef<{ cells: Cells | null; n: number; target: number; left: number }>({ cells: null, n: 0, target: 0, left: 0 });
  const draw = useRef<(i: number) => void>(() => {});
  const drawAll = () => { for (let i = 0; i < n * n; i++) draw.current(i); };

  // what the grid holds: a first split appears at once, a later one is reached by the ticks (or at once when still)
  useLayoutEffect(() => {
    const s = st.current;
    if (kept === null) { s.cells = null; return; }
    const target = keptCells(n, kept);
    if (!s.cells || s.n !== n) { st.current = { cells: createCells(n, kept, seeded(seed)), n, target, left: 0 }; return; }
    if (s.target === target) return;
    s.target = target;
    if (running && !document.hidden) s.left = MOVE_TICKS;
    else { s.left = 0; moveToward(s.cells, target, 1, Math.random, () => {}); }
  }, [kept, n]); // eslint-disable-line react-hooks/exhaustive-deps

  // geometry, then one full draw
  useLayoutEffect(() => {
    const c = cv.current;
    if (!c || !w) return;
    const gap = Math.max(1, Math.round(dpr)), pitch = Math.max(gap + 1, Math.floor((w + gap) / n)), size = pitch - gap, px = pitch * n - gap;
    if (c.width !== px) { c.width = px; c.height = px; }
    c.style.width = c.style.height = px / dpr + 'px';
    c.style.margin = Math.max(0, Math.floor((w - px) / 2)) / dpr + 'px'; // centered on whole device pixels
    const ctx = c.getContext('2d')!, p = palette(), colors = [p.line, p.ink, p.risk];
    draw.current = (i) => {
      ctx.fillStyle = colors[st.current.cells ? st.current.cells[i] : 0];
      ctx.fillRect((i % n) * pitch, Math.floor(i / n) * pitch, size, size);
    };
    drawAll();
  }, [w, dpr, n]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (w && !st.current.left) drawAll(); }, [kept]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    return onTick(() => {
      const s = st.current;
      if (!s.cells) return;
      if (s.left > 0) { moveToward(s.cells, s.target, s.left, Math.random, draw.current); s.left--; }
      shimmer(s.cells, Math.random, draw.current);
    });
  }, [running, n]);

  const aria = label ?? (kept === null ? 'Scenario grid, loading' : `${odds(kept)} of futures kept, ${odds(1 - kept)} lost. Each filled pixel stands for about ${futuresPerPixel(n)} futures.`);
  return <div ref={box} className="pixel-field"><canvas ref={cv} role="img" aria-label={aria} /></div>;
}
