import { useEffect, useLayoutEffect, useRef } from 'react';
import { odds } from '../../lib/format';
import { useInView, useLaptop, useMedia } from '../../lib/hooks';
import { createCells, futuresPerPixel, keptCells, moveToward, MOVE_TICKS, shimmer, type Cells } from '../../lib/pixelGrid';
import { palette, seeded, useBox } from './canvas';
import { onTick } from './ticker';

/**
 * The scenario grid: kept futures in ink, lost ones in red, scattered, in exact proportion, over 15% empty texture.
 * It shimmers by swapping cells, so the counts never change. `kept` null draws the empty (loading) grid.
 * `onSettled` reports the split on screen: at once, or when a move to a new split has finished.
 */
export function PixelField({ kept, seed = 1, n: fixedN, label, animate = true, paused = false, onSettled }: { kept: number | null; seed?: number; n?: number; label?: string; animate?: boolean; paused?: boolean; onSettled?: (kept: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const laptop = useLaptop();
  const n = fixedN ?? (laptop ? 100 : 64);
  const { w, dpr } = useBox(box);
  const inView = useInView(box);
  const still = useMedia('(prefers-reduced-motion: reduce)');
  const running = animate && !still && !paused && inView && kept !== null;
  const st = useRef<{ cells: Cells | null; n: number; target: number; left: number }>({ cells: null, n: 0, target: 0, left: 0 });
  const draw = useRef<(i: number) => void>(() => {});
  const report = useRef<() => void>(() => {});
  report.current = () => onSettled?.(kept);
  const drawAll = () => { for (let i = 0; i < n * n; i++) draw.current(i); };

  // what the grid holds: a first split appears at once, a later one is reached by the ticks (or at once when not running)
  useLayoutEffect(() => {
    const s = st.current;
    if (kept === null) st.current = { cells: null, n, target: 0, left: 0 };
    else if (!s.cells || s.n !== n) st.current = { cells: createCells(n, kept, seeded(seed)), n, target: keptCells(n, kept), left: 0 };
    else {
      s.target = keptCells(n, kept);
      if (running && !document.hidden) { s.left = MOVE_TICKS; return; }
      moveToward(s.cells, s.target, 1, Math.random, () => {});
      s.left = 0;
    }
    drawAll();
    report.current();
  }, [kept, n]); // eslint-disable-line react-hooks/exhaustive-deps

  // geometry. The canvas has a whole CSS size that is also whole device pixels, so the browser never resamples it.
  useLayoutEffect(() => {
    const c = cv.current;
    if (!c || !w) return;
    let css = Math.floor(w / dpr + 0.01);
    for (let k = 0; k < 8; k++) if (Math.abs((css - k) * dpr - Math.round((css - k) * dpr)) < 0.01) { css -= k; break; }
    const px = Math.round(css * dpr), gap = Math.max(1, Math.round(dpr));
    const pitch = Math.max(gap + 1, Math.floor((px + gap) / n)), size = pitch - gap, off = Math.max(0, Math.floor((px - pitch * n + gap) / 2));
    c.width = px; c.height = px;
    c.style.width = c.style.height = css + 'px';
    const ctx = c.getContext('2d')!, p = palette(), colors = [p.line, p.ink, p.risk];
    draw.current = (i) => {
      ctx.fillStyle = colors[st.current.cells ? st.current.cells[i] : 0];
      ctx.fillRect(off + (i % n) * pitch, off + Math.floor(i / n) * pitch, size, size);
    };
    drawAll();
  }, [w, dpr, n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const stop = onTick(() => {
      const s = st.current;
      if (!s.cells) return;
      if (s.left > 0) { moveToward(s.cells, s.target, s.left, Math.random, draw.current); if (--s.left === 0) report.current(); }
      shimmer(s.cells, Math.random, draw.current);
    });
    return () => {
      stop();
      // paused, off screen or reduced motion in the middle of a move: land on the exact split, then hold still
      const s = st.current;
      if (s.cells && s.left > 0) { moveToward(s.cells, s.target, 1, Math.random, draw.current); s.left = 0; report.current(); }
    };
  }, [running, n]);

  const aria = label ?? (kept === null ? 'Scenario grid, loading' : `${odds(kept)} of futures kept, ${odds(1 - kept)} lost. Each filled pixel stands for about ${futuresPerPixel(n)} futures.`);
  return <div ref={box} className="pixel-field"><canvas ref={cv} role="img" aria-label={aria} /></div>;
}
