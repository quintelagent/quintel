import { useEffect, useRef, useState, type RefObject } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Clock that stops while the tab is hidden. */
export function useNow(ms = 1000): Date {
  const [now, set] = useState(() => new Date());
  useEffect(() => {
    let t = 0;
    const start = () => { clearInterval(t); set(new Date()); t = window.setInterval(() => set(new Date()), ms); };
    const vis = () => (document.hidden ? clearInterval(t) : start());
    start();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ms]);
  return now;
}

export function useOnline(): boolean {
  const [on, set] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const u = () => set(navigator.onLine !== false);
    window.addEventListener('online', u); window.addEventListener('offline', u);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u); };
  }, []);
  return on;
}

/** true while the element is on screen (and the tab visible), for pausing loops */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '0px'): boolean {
  const [v, set] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { set(true); return; }
    const io = new IntersectionObserver((e) => set(e[e.length - 1].isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return v;
}

export function useMedia(q: string): boolean {
  const [m, set] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => set(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
export const useLaptop = () => useMedia('(min-width: 1100px)');

/** state remembered in localStorage (falls back to memory) */
export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, set] = useState<T>(() => { try { const s = localStorage.getItem(key); return s === null ? initial : (JSON.parse(s) as T); } catch { return initial; } });
  const r = useRef(key);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (d.key === r.current) set(d.value); };
    window.addEventListener('q-store', on);
    return () => window.removeEventListener('q-store', on);
  }, []);
  return [v, (n: T) => { set(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* private mode */ } window.dispatchEvent(new CustomEvent('q-store', { detail: { key, value: n } })); }];
}

/** fade + rise once when it enters view */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || !('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { el.classList.add('in'); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
