/** NYSE trading calendar (regular session 09:30–16:00 ET; early closes 13:00). */

export const HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
export const EARLY_CLOSES = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);

export interface EtParts { date: string; hour: number; minute: number; weekday: number }

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function etParts(d: Date): EtParts {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: WD[p.weekday] };
}

export function isTradingDay(date: string): boolean {
  const wd = new Date(date + 'T12:00:00Z').getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(date);
}

export function closeMinute(date: string): number {
  return EARLY_CLOSES.has(date) ? 13 * 60 : 16 * 60;
}

export type Session = 'open' | 'closed';

export function sessionAt(d: Date): Session {
  const e = etParts(d);
  if (!isTradingDay(e.date)) return 'closed';
  const m = e.hour * 60 + e.minute;
  return m >= 9 * 60 + 30 && m < closeMinute(e.date) ? 'open' : 'closed';
}

export function addDays(date: string, n: number): string {
  const t = new Date(date + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** the trading day n sessions after `date` */
export function addTradingDays(date: string, n: number): string {
  let d = date;
  let k = 0;
  while (k < n) {
    d = addDays(d, 1);
    if (isTradingDay(d)) k++;
  }
  return d;
}

export function prevTradingDay(date: string): string {
  let d = addDays(date, -1);
  while (!isTradingDay(d)) d = addDays(d, -1);
  return d;
}

/** Convert an ET wall-clock time on `date` to a UTC Date (handles DST). */
export function etToUtc(date: string, hour: number, minute: number): Date {
  const [y, mo, da] = date.split('-').map(Number);
  for (const off of [4, 5]) {
    const guess = new Date(Date.UTC(y, mo - 1, da, hour + off, minute));
    const e = etParts(guess);
    if (e.date === date && e.hour === hour && e.minute === minute) return guess;
  }
  return new Date(Date.UTC(y, mo - 1, da, hour + 5, minute));
}

export function nextOpen(d: Date): Date {
  let e = etParts(d);
  let date = e.date;
  const m = e.hour * 60 + e.minute;
  if (!(isTradingDay(date) && m < 9 * 60 + 30)) {
    date = addDays(date, 1);
    while (!isTradingDay(date)) date = addDays(date, 1);
  }
  return etToUtc(date, 9, 30);
}

/** The most recent completed regular-session close date (ET). */
export function lastCloseDate(d: Date): string {
  const e = etParts(d);
  const m = e.hour * 60 + e.minute;
  if (isTradingDay(e.date) && m >= closeMinute(e.date)) return e.date;
  return prevTradingDay(e.date);
}
