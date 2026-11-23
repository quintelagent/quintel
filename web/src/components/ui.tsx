import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clock } from '../lib/format';
import { reducedMotion } from '../lib/motion';

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <g fill="none" strokeWidth="4" strokeLinecap="round">
          <path d="M8 40 C22 40 30 20 56 12" stroke="#7CCBFF" />
          <path d="M8 40 C24 40 34 31 56 28" stroke="#7CCBFF" opacity=".65" />
          <path d="M8 40 C24 41 36 45 56 50" stroke="#FF4D5E" opacity=".9" />
        </g>
        <circle cx="8" cy="40" r="5" fill="#B8E6FF" />
      </svg>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 500, letterSpacing: '0.22em', fontSize: 14 }}>QUINTEL</span>
    </span>
  );
}

/** Animated number that counts toward `value`. */
export function CountUp({ value, format = (x: number) => Math.round(x).toLocaleString('en-US'), duration = 1200, start }: { value: number; format?: (x: number) => string; duration?: number; start?: number }) {
  const [shown, setShown] = useState(start ?? value);
  const from = useRef(start ?? value);
  useEffect(() => {
    if (reducedMotion()) { setShown(value); from.current = value; return; }
    const t0 = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (value - a) * e;
      from.current = v; // an interrupted animation resumes from where it is
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

export function Countdown({ to, prefix = '' }: { to: string | null | undefined; prefix?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!to) return <>—</>;
  const ms = new Date(to).getTime() - now;
  return <>{prefix}{ms > 0 ? clock(ms) : 'running…'}</>;
}

/** Crisis Level arc gauge 0–100; colour shifts ice → red. */
/** Eased tween toward `target` (starts from 0). */
export function useTween(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (reducedMotion()) { cur.current = target; setV(target); return; }
    const a = cur.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      cur.current = a + (target - a) * (1 - Math.pow(1 - k, 3));
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export function Gauge({ value, size = 168, label = 'Crisis Level' }: { value: number | null; size?: number; label?: string }) {
  const v = useTween(value ?? 0, 1400);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const start = Math.PI * 0.8;
  const end = Math.PI * 2.2;
  const ang = start + ((end - start) * v) / 100;
  const pt = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const mix = (t: number) => {
    const a = [124, 203, 255], b = [255, 77, 94];
    return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(',')})`;
  };
  const col = mix(Math.min(1, Math.max(0, (v - 20) / 60)));
  const ticks = Array.from({ length: 11 }, (_, i) => start + ((end - start) * i) / 10);
  return (
    <div style={{ width: size, textAlign: 'center' }}>
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} role="img" aria-label={`${label} ${value ?? 'unknown'} of 100`}>
        <path d={arc(start, end)} stroke="var(--border-2)" strokeWidth="6" fill="none" strokeLinecap="round" />
        {value !== null && <path d={arc(start, Math.max(start + 0.001, ang))} stroke={col} strokeWidth="6" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${col})` }} />}
        {ticks.map((a, i) => {
          const [x0, y0] = [cx + (r - 14) * Math.cos(a), cy + (r - 14) * Math.sin(a)];
          const [x1, y1] = [cx + (r - 19) * Math.cos(a), cy + (r - 19) * Math.sin(a)];
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--dim)" strokeWidth="1" />;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--mono)" fontSize={size * 0.24} fill="var(--text)">{value === null ? '—' : Math.round(v)}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontFamily="var(--mono)" fontSize="10" letterSpacing="2" fill="var(--muted)">/ 100</text>
      </svg>
      <div className="label" style={{ marginTop: -4 }}>{label}</div>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn sm"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }); }}
      aria-label={`Copy ${text}`}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function SectionHead({ eyebrow, title, lede, id }: { eyebrow: string; title: ReactNode; lede?: ReactNode; id?: string }) {
  return (
    <div id={id} style={{ marginBottom: 48 }}>
      <div className="eyebrow reveal">{eyebrow}</div>
      <h2 className="title reveal" data-delay="0.05">{title}</h2>
      {lede && <p className="lede reveal" data-delay="0.1">{lede}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'green' | 'ice' }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mono ${tone ?? ''}`} style={{ fontSize: 26, marginTop: 6, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Reserved-height placeholder shown while data loads, so the page never jumps. */
export function Skeleton({ h, panel = true, label }: { h: number; panel?: boolean; label?: string }) {
  const inner = (
    <div role="status" aria-busy="true" aria-label={label ?? 'Loading'}>
      <div className="skel" style={{ height: 14, width: '28%', marginBottom: 16 }} />
      <div className="skel" style={{ height: Math.max(20, h - 30) }} />
    </div>
  );
  return panel ? <div className="panel">{inner}</div> : inner;
}

/** Number that counts up from 0 the first time, then eases between values. */
export function Num({ value, fmt, duration = 1100 }: { value: number | null | undefined; fmt: (x: number) => string; duration?: number }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <>—</>;
  return <CountUp value={value} format={fmt} duration={duration} start={0} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="muted mono" style={{ fontSize: 13, padding: '28px 0', textAlign: 'center' }}>{children}</div>;
}
