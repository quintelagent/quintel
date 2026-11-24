import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { navigate } from '../../lib/router';
import { useLaptop } from '../../lib/hooks';

export interface ToastMsg { text: string; href?: string; action?: string }
const Ctx = createContext<(t: ToastMsg) => void>(() => {});
export const useToast = () => useContext(Ctx);

interface Item extends ToastMsg { id: number; out?: boolean }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, set] = useState<Item[]>([]);
  const seq = useRef(0);
  const laptop = useLaptop();
  const max = laptop ? 3 : 1;
  const push = useCallback((t: ToastMsg) => set((p) => [...p, { ...t, id: ++seq.current }].slice(-max)), [max]);
  const close = useCallback((id: number) => {
    set((p) => p.map((x) => (x.id === id ? { ...x, out: true } : x)));
    setTimeout(() => set((p) => p.filter((x) => x.id !== id)), 150);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Updates">
        {items.slice(-max).map((t) => <ToastCard key={t.id} t={t} close={close} />)}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ t, close }: { t: Item; close: (id: number) => void }) {
  const left = useRef(6000), started = useRef(0), timer = useRef(0), y0 = useRef<number | null>(null);
  const start = useCallback(() => { clearTimeout(timer.current); started.current = Date.now(); timer.current = window.setTimeout(() => close(t.id), left.current); }, [close, t.id]);
  const stop = () => { if (!timer.current) return; clearTimeout(timer.current); timer.current = 0; left.current = Math.max(1500, left.current - (Date.now() - started.current)); };
  useEffect(() => { start(); return () => clearTimeout(timer.current); }, [start]);
  return (
    <div className={t.out ? 'toast out' : 'toast'} onMouseEnter={stop} onMouseLeave={start} onFocus={stop} onBlur={start}
      onTouchStart={(e) => { y0.current = e.touches[0].clientY; }} onTouchEnd={(e) => { if (y0.current !== null && e.changedTouches[0].clientY - y0.current > 24) close(t.id); y0.current = null; }}>
      {t.href ? <button type="button" className="toast-t" onClick={() => { close(t.id); navigate(t.href!); }}>{t.text}{t.action && <u>{t.action}</u>}</button> : <span className="toast-t">{t.text}</span>}
      <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => close(t.id)}><X size={16} strokeWidth={1.5} /></button>
    </div>
  );
}
