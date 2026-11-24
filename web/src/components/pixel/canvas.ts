import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface Palette { ink: string; ink2: string; line: string; risk: string; card: string; paper: string }
let cached: Palette | null = null;
export function palette(): Palette {
  if (cached) return cached;
  const s = getComputedStyle(document.documentElement);
  const g = (n: string) => s.getPropertyValue(n).trim();
  return (cached = { ink: g('--ink'), ink2: g('--ink-2'), line: g('--line'), risk: g('--risk'), card: g('--card'), paper: g('--paper') });
}
/** one solid cell */
export function cell(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, s, s);
}
/** Small deterministic generator so a run always draws the same grid. */
export function seeded(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Size of a fixed box in device pixels; redraws when it changes. */
export function useBox(ref: RefObject<HTMLElement | null>) {
  const [box, set] = useState({ w: 0, h: 0, dpr: 1 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => {
      const r = el.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      set((p) => { const n = { w: Math.floor(r.width * dpr), h: Math.floor(r.height * dpr), dpr }; return p.w === n.w && p.h === n.h && p.dpr === n.dpr ? p : n; });
    };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}
export function usePrev<T>(v: T) { const r = useRef<T>(v); const p = r.current; useEffect(() => { r.current = v; }); return p; }
