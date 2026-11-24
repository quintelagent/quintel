import { useEffect, useMemo, useRef } from 'react';
import type { RunOutput } from '@engine/types';
import { fanOf, type Fan } from '../../lib/fan';
import { reducedMotion, useInView, useLaptop } from '../../lib/hooks';
import { cell, palette, useBox } from './canvas';

/** The run's futures spreading out over one week. Draws itself in once, then again for each new run. */
export function PixelFan({ output, label }: { output: RunOutput | null; label: string }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const laptop = useLaptop();
  const cols = laptop ? 100 : 64, rows = laptop ? 100 : 48;
  const { w, dpr } = useBox(box);
  const inView = useInView(box);
  const fan = useMemo(() => (output ? fanOf(output, cols, rows) : null), [output, cols, rows]);
  const shown = useRef<Fan | null>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c || !w) return;
    const ctx = c.getContext('2d')!, p = palette();
    const pitch = Math.max(2, Math.floor(w / cols)), s = pitch - 1;
    c.width = pitch * cols - 1; c.height = pitch * rows - 1;
    c.style.width = c.width / dpr + 'px'; c.style.height = c.height / dpr + 'px';
    const draw = (f: Fan | null, a: number, b: number) => {
      ctx.clearRect(a * pitch, 0, (b - a) * pitch, c.height);
      for (let x = a; x < b; x++) for (let y = 0; y < rows; y++) {
        const v = f ? f.cells[y * cols + x] : x % 2 || y % 2 ? 0 : 3; // loading: a light dot grid
        if (v) cell(ctx, x * pitch, y * pitch, s, v === 1 ? p.ink : v === 2 ? p.risk : p.line, v === 2);
      }
    };
    const prev = shown.current && shown.current.cols === cols ? shown.current : null;
    if (!fan || fan === prev || !inView || reducedMotion() || document.hidden) { draw(fan, 0, cols); if (inView || !fan) shown.current = fan; return; }
    shown.current = fan;
    draw(prev, 0, cols);
    let i = 0;
    const t = window.setInterval(() => {
      draw(fan, Math.floor((i * cols) / 10), Math.floor(((i + 1) * cols) / 10));
      if (++i >= 10) clearInterval(t);
    }, 100);
    return () => { clearInterval(t); draw(fan, 0, cols); };
  }, [fan, w, dpr, cols, rows]); // eslint-disable-line

  return <div ref={box} className="pixel-fan"><canvas ref={cv} role="img" aria-label={label} /></div>;
}
