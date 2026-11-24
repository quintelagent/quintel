import { useEffect, useRef } from 'react';
import { cell, palette, useBox } from './canvas';

/** Distributions as stacked pixel columns. `risk(i)` marks a column as downside (red). `marker` is a 0-1 x position. */
export function PixelBars({ values, risk, marker, label, height = 160 }: { values: number[] | null; risk?: (i: number) => boolean; marker?: number | null; label: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useBox(box);
  useEffect(() => {
    const c = cv.current;
    if (!c || !w || !h) return;
    c.width = w; c.height = h;
    c.style.width = w / dpr + 'px'; c.style.height = h / dpr + 'px';
    const ctx = c.getContext('2d')!, p = palette();
    ctx.clearRect(0, 0, w, h);
    const n = values?.length ?? 60;
    const colW = w / n;
    const pitch = Math.max(3, Math.floor(colW)), s = pitch - Math.max(1, Math.round(dpr / 2));
    const rows = Math.floor(h / pitch), max = values ? Math.max(...values, 1e-12) : 1;
    for (let i = 0; i < n; i++) {
      const filled = values ? Math.max(values[i] > 0 ? 1 : 0, Math.round((values[i] / max) * rows)) : 1;
      const r = risk?.(i) ?? false;
      for (let y = 0; y < rows; y++) {
        const on = y < filled && !!values;
        if (!on && y > 0) continue;
        cell(ctx, Math.round((i * w) / n), h - (y + 1) * pitch, s, !on ? p.line : r ? p.risk : p.ink);
      }
    }
    if (marker !== null && marker !== undefined) {
      // sits on the nearest column edge, so it never cuts a pixel in half
      const x = Math.round((Math.round(marker * n) * w) / n) - Math.round(dpr / 2);
      ctx.clearRect(x - Math.round(1.5 * dpr), 0, Math.round(3 * dpr), h);
      ctx.fillStyle = p.ink2;
      for (let y = 0; y < h; y += pitch) ctx.fillRect(x - Math.ceil(dpr), y, Math.max(2, Math.round(dpr * 2)), Math.max(1, Math.floor(pitch / 2)));
    }
  }, [values, w, h, dpr, marker, risk]);
  return <div ref={box} className="pixel-bars" style={{ height }}><canvas ref={cv} role="img" aria-label={label} /></div>;
}
