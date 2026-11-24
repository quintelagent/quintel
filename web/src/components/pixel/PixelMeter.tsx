import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../../lib/hooks';

/** 10 blocks. `riskFrom` is the value (0-1) at which blocks turn red; null keeps them ink. */
export function PixelMeter({ value, riskFrom = null, label }: { value: number | null; riskFrom?: number | null; label: string }) {
  const target = value === null ? 0 : Math.max(0, Math.min(10, Math.round(value * 10)));
  const [n, set] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reducedMotion() || document.hidden) { cur.current = target; set(target); return; }
    const t = window.setInterval(() => {
      if (cur.current === target) { clearInterval(t); return; }
      cur.current += cur.current < target ? 1 : -1;
      set(cur.current);
    }, 100);
    return () => clearInterval(t);
  }, [target]);
  return (
    <div className="pixel-meter" role="img" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? (riskFrom !== null && i / 10 >= riskFrom - 0.001 ? 'risk' : 'on') : ''} />)}
    </div>
  );
}
