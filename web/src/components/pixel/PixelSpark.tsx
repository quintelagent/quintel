import { useEffect, useRef } from 'react';
import { palette, useBox } from './canvas';

/** Tiny pixel sparkline. */
export function PixelSpark({ values, label, height = 32 }: { values: number[] | null; label: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useBox(box);
  useEffect(() => {
    const c = cv.current;
    if (!c || !w || !h) return;
    c.width = w; c.height = h; c.style.width = w / dpr + 'px'; c.style.height = h / dpr + 'px';
    const ctx = c.getContext('2d')!, p = palette();
    const pitch = Math.max(3, Math.round(4 * dpr)), s = pitch - Math.max(1, Math.round(dpr / 2));
    const cols = Math.floor(w / pitch), rows = Math.floor(h / pitch);
    const v = values && values.length > 1 ? values : null;
    const lo = v ? Math.min(...v) : 0, hi = v ? Math.max(...v) : 1;
    for (let x = 0; x < cols; x++) {
      const val = v ? v[Math.round((x / Math.max(1, cols - 1)) * (v.length - 1))] : 0;
      const y = v ? (hi > lo ? Math.round(((val - lo) / (hi - lo)) * (rows - 1)) : Math.floor(rows / 2)) : 0;
      ctx.fillStyle = v ? p.ink : p.line;
      ctx.fillRect(x * pitch, h - (y + 1) * pitch, s, s);
    }
  }, [values, w, h, dpr]);
  return <div ref={box} className="pixel-spark" style={{ height }}><canvas ref={cv} role="img" aria-label={label} /></div>;
}
