/** The one shared formatter (SYSTEM.md section 8). */
const DASH = '—';
const MINUS = '−';
const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const fixed = (x: number, d: number) => Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const usd = (x: number | null | undefined, d = 2) => (ok(x) ? (x < 0 ? MINUS : '') + '$' + fixed(x, d) : DASH);
/** $1.2M style for large values */
export const usdShort = (x: number | null | undefined) => (ok(x) ? (x < 0 ? MINUS : '') + '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(x)) : DASH);
/** signed dollar change: +$1.42 */
export const usdChange = (x: number | null | undefined, d = 2) => (ok(x) ? sign(x, d) + '$' + fixed(x, d) : DASH);
/** fraction to 61.2% */
export const pct = (x: number | null | undefined, d = 1) => {
  if (!ok(x)) return DASH;
  return (x < 0 && Number((x * 100).toFixed(d)) !== 0 ? MINUS : '') + fixed(x * 100, d) + '%';
};
/** odds: caps the ends so a sample never reads as certainty */
export const odds = (x: number | null | undefined) => {
  if (!ok(x)) return DASH;
  if (x < 0.001) return '<0.1%';
  if (x > 0.999) return '>99.9%';
  return pct(x);
};
/** signed percent change of a fraction: +0.8% */
export const pctChange = (x: number | null | undefined, d = 1) => (ok(x) ? sign(x * 100, d) + fixed(x * 100, d) + '%' : DASH);
/** change in odds, from two fractions' difference: +0.4 pts */
export const pts = (x: number | null | undefined) => (ok(x) ? sign(x * 100, 1) + fixed(x * 100, 1) + ' pts' : DASH);
export const int = (x: number | null | undefined) => (ok(x) ? Math.round(x).toLocaleString('en-US') : DASH);
function sign(x: number, d: number) { const r = Number(x.toFixed(d)); return r < 0 ? MINUS : r > 0 ? '+' : ''; }

const ET = 'America/New_York';
const iso = (d: string | Date) => (typeof d === 'string' ? new Date(d) : d);
/** 10:40am ET */
export const etTime = (d: string | Date | null | undefined) => {
  if (!d) return DASH;
  const t = iso(d);
  if (Number.isNaN(t.getTime())) return DASH;
  return t.toLocaleTimeString('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase() + ' ET';
};
/** Tue, Dec 1 */
export const etDate = (d: string | Date | null | undefined) => {
  if (!d) return DASH;
  // a bare YYYY-MM-DD is an ET calendar date
  const t = typeof d === 'string' && d.length === 10 ? new Date(d + 'T17:00:00Z') : iso(d);
  if (Number.isNaN(t.getTime())) return DASH;
  return t.toLocaleDateString('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' });
};
export const etDateTime = (d: string | Date | null | undefined) => (d ? `${etDate(d)}, ${etTime(d)}` : DASH);
/** Dec 1 */
export const etShortDate = (d: string | Date | null | undefined) => {
  if (!d) return DASH;
  const t = typeof d === 'string' && d.length === 10 ? new Date(d + 'T17:00:00Z') : iso(d);
  return t.toLocaleDateString('en-US', { timeZone: ET, month: 'short', day: 'numeric' });
};
export const etDay = (d: string | Date) => iso(d).toLocaleDateString('en-US', { timeZone: ET, weekday: 'short' });

export function ago(d: string | Date | null | undefined, now = Date.now()): string {
  if (!d) return DASH;
  const m = Math.max(0, Math.floor((now - iso(d).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
/** 1d 14h 22m, 14h 22m, or 42:10 under an hour */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** 0x12…ab (Solana: first 4, last 2) */
export const addr = (a: string | null | undefined) => (!a ? DASH : a.startsWith('0x') ? `${a.slice(0, 4)}…${a.slice(-2)}` : `${a.slice(0, 4)}…${a.slice(-2)}`);
/** short hash for tables */
export const hash = (h: string | null | undefined) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : DASH);
