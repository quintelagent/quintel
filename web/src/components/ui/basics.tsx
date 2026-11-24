import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ElementType, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, Check, Copy, Lock } from 'lucide-react';
import { Link } from '../../lib/router';
import { useReveal } from '../../lib/hooks';
import { addr as shortAddr } from '../../lib/format';
import { useToast } from './Toast';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function Section({ id, eyebrow, title, sub, children, className, as: H = 'h2' }: { id?: string; eyebrow?: ReactNode; title?: ReactNode; sub?: ReactNode; children?: ReactNode; className?: string; as?: 'h1' | 'h2' }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id={id} className={cx('section', className)}>
      <div ref={ref} className="wrap rv">
        {(title || eyebrow) && (
          <div className="section-head">
            {eyebrow && <div className="label">{eyebrow}</div>}
            {title && <H>{title}</H>}
            {sub && <p>{sub}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Card({ as: T = 'div', className, ...p }: HTMLAttributes<HTMLElement> & { as?: ElementType }) { return <T className={cx('card', className)} {...p} />; }
export function Tile({ className, ...p }: HTMLAttributes<HTMLDivElement>) { return <div className={cx('tile', className)} {...p} />; }

type Variant = 'primary' | 'secondary' | 'ghost';
export function Button({ variant = 'primary', href, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; href?: string }) {
  const c = cx('btn', `btn-${variant}`, className);
  if (href) return <Link href={href} className={c}>{children}</Link>;
  return <button type="button" className={c} {...p}>{children}</button>;
}

export type PillTone = 'default' | 'invert' | 'risk' | 'muted';
/** `live` adds the stepped red dot. Up, Down and band pills use a sign or marker as well as tone. */
export function Pill({ tone = 'default', live, children, className }: { tone?: PillTone; live?: boolean; children: ReactNode; className?: string }) {
  return <span className={cx('pill', `pill-${tone}`, className)}>{live && <i className="live-dot" aria-hidden="true" />}{children}</span>;
}
/** A signed change with the right sign and a hollow red marker for falls (small text stays ink). */
export function Change({ value, text }: { value: number | null | undefined; text: string }) {
  return <span className="mono change">{value !== null && value !== undefined && value < 0 && <i className="fall" aria-hidden="true" />}{text}</span>;
}

export function Stat({ label, children, note }: { label: ReactNode; children: ReactNode; note?: ReactNode }) {
  return <div className="stat"><div className="label">{label}</div><div className="stat-v mono">{children}</div>{note && <div className="note">{note}</div>}</div>;
}

export function Input({ label, prefix, error, hint, numeric, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; prefix?: string; error?: string | null; hint?: string; numeric?: boolean }) {
  const id = useId();
  return (
    <div className={cx('field', className)}>
      <label className="label" htmlFor={id}>{label}</label>
      <div className={cx('input', !!error && 'bad', numeric && 'mono')}>
        {prefix && <span aria-hidden="true">{prefix}</span>}
        <input id={id} autoComplete="off" {...(numeric ? { inputMode: 'decimal' as const } : {})} aria-invalid={!!error} aria-describedby={error || hint ? id + 'n' : undefined} {...p} />
      </div>
      {(error || hint) && <div id={id + 'n'} className={error ? 'note field-err' : 'note'}>{error || hint}</div>}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="field">
      <div className="slider-head"><label className="label" htmlFor={id}>{label}</label><span className="mono">{format ? format(value) : value}</span></div>
      <input id={id} className="slider" type="range" min={min} max={max} step={step} value={value} aria-valuetext={format?.(value)} style={{ ['--p' as string]: p + '%' }} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Accordion({ items, defaultOpen = null }: { items: { q: ReactNode; a: ReactNode }[]; defaultOpen?: number | null }) {
  const [open, set] = useState<number | null>(defaultOpen);
  const id = useId();
  return (
    <div className="accordion">
      {items.map((it, i) => (
        <div key={i} className="acc-item">
          <h3><button type="button" aria-expanded={open === i} aria-controls={`${id}${i}`} onClick={() => set(open === i ? null : i)}>{it.q}<ChevronDown size={20} strokeWidth={1.5} className={open === i ? 'flip' : ''} aria-hidden="true" /></button></h3>
          <div id={`${id}${i}`} hidden={open !== i} className="acc-body">{it.a}</div>
        </div>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy', toast = 'Copied' }: { text: string; label?: string; toast?: string }) {
  const [done, set] = useState(false);
  const push = useToast();
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button type="button" className="copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { set(true); push({ text: toast }); clearTimeout(timer.current); timer.current = window.setTimeout(() => set(false), 1500); }, () => push({ text: 'Couldn’t copy. Select the text instead.' })); }}>
      {done ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.5} aria-hidden="true" />}{label}
    </button>
  );
}
export function CodeBlock({ code, copy = true }: { code: string; copy?: boolean }) {
  return <div className="code"><pre className="mono"><code>{code}</code></pre>{copy && <CopyButton text={code} />}</div>;
}
export function AddressChip({ address, empty = 'Posted at launch', toast = 'Address copied' }: { address: string | null | undefined; empty?: string; toast?: string }) {
  const [full, set] = useState(false);
  if (!address) return <span className="chip mono muted">{empty}</span>;
  return (
    <span className="chip-row">
      <button type="button" className="chip mono" aria-expanded={full} aria-label={full ? `Address ${address}, collapse` : `Address ${shortAddr(address)}, show full`} onClick={() => set(!full)}>{full ? address : shortAddr(address)}</button>
      <CopyButton text={address} toast={toast} />
    </span>
  );
}

export function Skeleton({ h, w, className }: { h: number | string; w?: number | string; className?: string }) { return <span className={cx('skeleton', className)} style={{ height: h, width: w ?? '100%' }} aria-hidden="true" />; }
export function EmptyState({ text, action }: { text: ReactNode; action?: ReactNode }) { return <div className="state"><p>{text}</p>{action}</div>; }
export function ErrorState({ text = 'Couldn’t load the latest run. Try again.', onRetry }: { text?: string; onRetry?: () => void }) {
  return <div className="state" role="alert"><p>{text}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}</div>;
}
export function LockedState({ title = 'Pro feature', text, action }: { title?: string; text: ReactNode; action?: ReactNode }) {
  return <div className="state locked"><Lock size={20} strokeWidth={1.5} aria-hidden="true" /><b>{title}</b><p>{text}</p>{action}</div>;
}

export interface Column<T> { key: string; head: string; cell: (row: T) => ReactNode; mono?: boolean; end?: boolean }
/** A table on tablet and up; stacked rows on phone. */
export function DataTable<T>({ columns, rows, rowKey, caption }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string | number; caption: string }) {
  return (
    <table className="dt">
      <caption className="vh">{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.end ? 'end' : undefined}>{c.head}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={rowKey(r)}>{columns.map((c) => <td key={c.key} data-h={c.head} className={cx(c.mono && 'mono', c.end && 'end')}><span>{c.cell(r)}</span></td>)}</tr>)}</tbody>
    </table>
  );
}
