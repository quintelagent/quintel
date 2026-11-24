/** Per-symbol copy and reference values. */
export interface SymbolConfig { symbol: string; headline: (movePct: number | null) => string; gainName: string }
export const DEFAULT_SYMBOL = 'NVDA';
const move = (p: number) => `${p < 0 ? '−' : '+'}${Math.abs(Math.round(p * 100))}%`;
export const SYMBOLS: Record<string, SymbolConfig> = {
  NVDA: {
    symbol: 'NVDA',
    // the size of the move comes from the run, so it can never drift from the data
    headline: (p) => `NVDA ${move(p ?? 0.31)} in a day. Does it hold?`,
    gainName: 'Monday’s gain',
  },
};
export const symbolConfig = (s = DEFAULT_SYMBOL) => SYMBOLS[s] ?? SYMBOLS[DEFAULT_SYMBOL];
