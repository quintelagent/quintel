/** The big daily move the site is framed around, computed from stored closes (never typed into copy). */
export interface MarketEvent { date: string; prevClose: number; close: number; pct: number; halfBack: number }

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

export function marketEvent(history: { date: string; close: number }[], date: string | undefined): MarketEvent | null {
  const i = date ? history.findIndex((h) => h.date === date) : -1;
  if (i < 1) return null;
  const prevClose = history[i - 1].close, close = history[i].close;
  return { date: date!, prevClose: r6(prevClose), close: r6(close), pct: r6(close / prevClose - 1), halfBack: r6((prevClose + close) / 2) };
}
