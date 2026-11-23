import { useEffect, useRef, useState } from 'react';
import type { Histogram, HorizonStats } from '@engine/types';
import { MODEL_COLORS } from '../lib/format';

/** Canvas that resizes with its container and redraws with DPR scaling. */
function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = size.w * dpr;
    el.height = size.h * dpr;
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    draw(ctx, size.w, size.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, ...deps]);
  return ref;
}

const ICE = '#7CCBFF';
const RED = '#FF4D5E';

/** Histogram with a draggable price line. */
export function DistDrag({ hist, spot, value, onChange, height = 260 }: { hist: Histogram; spot: number; value: number; onChange: (v: number) => void; height?: number }) {
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const ref = useCanvas((ctx, w, h) => {
    const n = hist.counts.length;
    const max = Math.max(...hist.counts);
    const bw = (w - pad.l - pad.r) / n;
    const x = (p: number) => pad.l + ((p - hist.lo) / (hist.hi - hist.lo)) * (w - pad.l - pad.r);
    hist.counts.forEach((c, i) => {
      const mid = hist.lo + ((i + 0.5) / n) * (hist.hi - hist.lo);
      const bh = (c / max) * (h - pad.t - pad.b);
      ctx.fillStyle = mid < value ? 'rgba(255,77,94,0.55)' : 'rgba(124,203,255,0.5)';
      ctx.fillRect(pad.l + i * bw + 1, h - pad.b - bh, Math.max(1, bw - 2), bh);
    });
    // spot marker
    ctx.strokeStyle = 'rgba(234,242,248,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x(spot), pad.t); ctx.lineTo(x(spot), h - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    // drag line
    const vx = Math.max(pad.l, Math.min(w - pad.r, x(value)));
    ctx.strokeStyle = '#EAF2F8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(vx, 4); ctx.lineTo(vx, h - pad.b); ctx.stroke();
    ctx.fillStyle = '#EAF2F8';
    ctx.beginPath(); ctx.arc(vx, h - pad.b, 6, 0, Math.PI * 2); ctx.fill();
    // axis labels
    ctx.fillStyle = '#8A99A8';
    ctx.font = '11px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('$' + hist.lo.toFixed(0), pad.l, h - 8);
    ctx.textAlign = 'right';
    ctx.fillText('$' + hist.hi.toFixed(0), w - pad.r, h - 8);
    ctx.textAlign = 'center';
    ctx.fillText('today $' + spot.toFixed(2), x(spot), h - 8);
  }, [hist, spot, value]);

  const fromEvent = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const k = (e.clientX - r.left - pad.l) / (r.width - pad.l - pad.r);
    onChange(hist.lo + Math.max(0, Math.min(1, k)) * (hist.hi - hist.lo));
  };
  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height, touchAction: 'none', cursor: 'ew-resize', display: 'block' }}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); fromEvent(e); }}
      onPointerMove={(e) => { if (e.buttons) fromEvent(e); }}
      role="slider"
      aria-label="Drag to choose a price"
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = (hist.hi - hist.lo) / 120;
        if (e.key === 'ArrowLeft') onChange(Math.max(hist.lo, value - step));
        if (e.key === 'ArrowRight') onChange(Math.min(hist.hi, value + step));
      }}
    />
  );
}

/** Fan chart: percentile bands across 0/1/5/21 days plus optional sample paths. */
export function Fan({ spot, horizons, paths, height = 280, compare }: {
  spot: number;
  horizons: HorizonStats[];
  paths?: { id: string; paths: number[][] }[];
  height?: number;
  compare?: HorizonStats[];
}) {
  const ref = useCanvas((ctx, w, h) => {
    const pad = { l: 8, r: 64, t: 12, b: 24 };
    const all = [spot, ...horizons.flatMap((x) => [x.pct.p1, x.pct.p99]), ...(compare ? compare.flatMap((x) => [x.pct.p1, x.pct.p99]) : [])];
    let lo = Math.min(...all), hi = Math.max(...all);
    const m = (hi - lo) * 0.06; lo -= m; hi += m;
    const X = (d: number) => pad.l + (d / 21) * (w - pad.l - pad.r);
    const Y = (p: number) => pad.t + (1 - (p - lo) / (hi - lo)) * (h - pad.t - pad.b);
    // grid
    ctx.strokeStyle = 'rgba(124,203,255,0.06)';
    for (let i = 0; i <= 4; i++) { const y = pad.t + (i / 4) * (h - pad.t - pad.b); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); }
    // sample paths
    if (paths) {
      ctx.lineWidth = 1;
      for (const m of paths) {
        for (const p of m.paths) {
          const down = p[p.length - 1] < spot * 0.85;
          ctx.strokeStyle = down ? 'rgba(255,77,94,0.28)' : (MODEL_COLORS[m.id] || ICE) + '30';
          ctx.beginPath();
          p.forEach((v, d) => (d ? ctx.lineTo(X(d), Y(v)) : ctx.moveTo(X(d), Y(v))));
          ctx.stroke();
        }
      }
    }
    const band = (hs: HorizonStats[], a: 'p5' | 'p25', b: 'p95' | 'p75', fill: string) => {
      const pts = [{ d: 0, lo: spot, hi: spot }, ...hs.map((x) => ({ d: x.days, lo: x.pct[a], hi: x.pct[b] }))];
      ctx.fillStyle = fill;
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(X(q.d), Y(q.hi)) : ctx.moveTo(X(q.d), Y(q.hi))));
      [...pts].reverse().forEach((q) => ctx.lineTo(X(q.d), Y(q.lo)));
      ctx.closePath();
      ctx.fill();
    };
    const line = (hs: HorizonStats[], k: 'p50' | 'p5', color: string, dash: number[] = []) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(X(0), Y(spot));
      hs.forEach((x) => ctx.lineTo(X(x.days), Y(x.pct[k])));
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (compare) { band(compare, 'p5', 'p95', 'rgba(138,153,168,0.08)'); line(compare, 'p50', 'rgba(138,153,168,0.6)', [4, 4]); }
    band(horizons, 'p5', 'p95', 'rgba(124,203,255,0.10)');
    band(horizons, 'p25', 'p75', 'rgba(124,203,255,0.18)');
    line(horizons, 'p50', ICE);
    line(horizons, 'p5', RED, [3, 3]);
    // labels on the right
    const last = horizons[horizons.length - 1];
    ctx.font = '11px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ([['p95', '#8A99A8'], ['p50', ICE], ['p5', RED]] as const).forEach(([k, c]) => {
      ctx.fillStyle = c;
      ctx.fillText(`${k} $${last.pct[k].toFixed(0)}`, w - pad.r + 6, Y(last.pct[k]) + 4);
    });
    ctx.fillStyle = '#5A6878';
    ['now', '1d', '1w', '', '', '1m'].forEach(() => 0);
    [[0, 'now'], [1, '1d'], [5, '1w'], [21, '1m']].forEach(([d, t]) => { ctx.textAlign = 'center'; ctx.fillText(String(t), X(Number(d)), h - 6); });
  }, [spot, horizons, paths, compare]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}

export function MiniDist({ hist, spot, color = ICE, height = 64 }: { hist: Histogram; spot: number; color?: string; height?: number }) {
  const ref = useCanvas((ctx, w, h) => {
    const max = Math.max(...hist.counts);
    const n = hist.counts.length;
    const bw = w / n;
    hist.counts.forEach((c, i) => {
      const mid = hist.lo + ((i + 0.5) / n) * (hist.hi - hist.lo);
      const bh = (c / max) * (h - 4);
      ctx.fillStyle = mid < spot * 0.85 ? 'rgba(255,77,94,0.7)' : color + 'aa';
      ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 1), bh);
    });
    const sx = ((spot - hist.lo) / (hist.hi - hist.lo)) * w;
    ctx.strokeStyle = 'rgba(234,242,248,0.5)';
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
  }, [hist, spot, color]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}

export function LineChart({ points, height = 200, baseline }: { points: { t: number; v: number }[]; height?: number; baseline?: number }) {
  const ref = useCanvas((ctx, w, h) => {
    if (points.length < 2) return;
    const vs = points.map((p) => p.v).concat(baseline !== undefined ? [baseline] : []);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const X = (t: number) => 4 + ((t - t0) / (t1 - t0 || 1)) * (w - 8);
    const Y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (h - 16);
    if (baseline !== undefined) {
      ctx.strokeStyle = 'rgba(138,153,168,0.4)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, Y(baseline)); ctx.lineTo(w, Y(baseline)); ctx.stroke(); ctx.setLineDash([]);
    }
    const lastV = points[points.length - 1].v;
    const col = baseline !== undefined && lastV < baseline ? RED : ICE;
    ctx.strokeStyle = col; ctx.lineWidth = 1.6;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.v)) : ctx.moveTo(X(p.t), Y(p.v))));
    ctx.stroke();
  }, [points, baseline]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
