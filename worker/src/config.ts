/** All tunables live here (and in wrangler vars). Changing desk rules after launch requires a CHANGELOG entry. */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // vars
  SYMBOL: string;
  CHAIN_ID: string;
  CHAIN_EXPLORER: string;
  NVDA_TOKEN_ADDRESS: string;
  NVDA_POOL_ADDRESS?: string;
  PRE_CRISIS_LEVEL?: string;
  TRIAGE_MODEL: string;
  BRIEFING_MODEL: string;
  AI_DAILY_CAP_USD: string;
  QNTL_TOKEN_PONS?: string;
  QNTL_TOKEN_SOLANA?: string;
  FINGERPRINT_ADDRESS?: string;
  SITE_URL?: string;
  // secrets
  /** primary Robinhood Chain RPC (e.g. Alchemy); falls back to the public RPC */
  RPC_URL?: string;
  OPENROUTER_API_KEY?: string;
  ALPACA_KEY_ID?: string;
  ALPACA_SECRET_KEY?: string;
  FINNHUB_API_KEY?: string;
  FINGERPRINT_KEY?: string;
  ADMIN_TOKEN?: string;
}

export const MODEL_PRICES_PER_TOKEN: Record<string, { in: number; out: number }> = {
  'anthropic/claude-haiku-5.5': { in: 0.0000001, out: 0.0000005 },
  'google/gemini-3.8-flash': { in: 0.000000825, out: 0.000004125 },
};

export const DESK_RULES = {
  startingCash: 100_000,
  maxLeverage: 1,
  allowShort: false,
  /** enter long when P(up, 1w) ≥ this AND Stress Level is falling vs the previous run */
  enterLongPUp1w: 0.58,
  /** exit when P(up, 1w) < this */
  exitPUp1w: 0.5,
  /** stop-loss on the open position */
  stopLoss: -0.08,
  /** only fills while the stock market is open, at the stock price */
  tradeOnlyWhenOpen: true,
} as const;

export const SCHEDULE = {
  closedRunEveryTicks: 3,
  briefingEveryMin: 30,
  bigMovePct: 0.03,
  bigNewsScore: 0.85,
  pathsPerModel: 200_000,
  samplePerModel: 60,
} as const;

export const BANNED_PATTERNS: RegExp[] = [
  /\bfraud\w*/i,
  /\bpredict(ion|ions|s|ed|ing)?\b/i,
  /\bforecasts? that will\b/i,
  /\bwill (definitely|certainly)\b/i,
  /\bguarantee(d|s)?\b/i,
  /\b(buy|sell|buying|selling|buys|sells)\b/i,
  /\bprice target\b/i,
  /\b(strong )?(buy|sell) (signal|rating)\b/i,
  /\bcan'?t lose\b/i,
  /\brisk[- ]free\b/i,
  /\b(divorce|wife|husband|girlfriend|boyfriend|affair|personal life|family life)\b/i,
];
