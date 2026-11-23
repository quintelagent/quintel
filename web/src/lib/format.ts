export const usd = (x: number | null | undefined, d = 2) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : '$' + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (x: number | null | undefined, d = 1, sign = false) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const v = (x * 100).toFixed(d);
  return (sign && x > 0 ? '+' : '') + v + '%';
};

export const int = (x: number) => Math.round(x).toLocaleString('en-US');

export const short = (h: string | null | undefined, n = 6) => (h ? `${h.slice(0, n + 2)}…${h.slice(-4)}` : '—');

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(2, '0');
  const sss = String(ss).padStart(2, '0');
  return h ? `${h}:${mm}:${sss}` : `${mm}:${sss}`;
}

export const etTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';

export const MODEL_COLORS: Record<string, string> = {
  gbm: '#7CCBFF',
  jump: '#B8E6FF',
  bootstrap: '#4FA3D9',
  garch: '#9AD8FF',
  meanrev: '#2B7FB8',
};
