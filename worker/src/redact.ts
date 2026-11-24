import type { Env } from './config';

const SECRET_KEYS = ['RPC_URL', 'OPENROUTER_API_KEY', 'ALPACA_KEY_ID', 'ALPACA_SECRET_KEY', 'FINNHUB_API_KEY', 'FINGERPRINT_KEY', 'ADMIN_TOKEN'] as const;

/** Logs and errors are public (/api/health, /api/proof): drop URLs (RPC URLs embed API keys) and any secret value. */
export function redact(text: string, env?: Partial<Env>): string {
  let s = text;
  for (const k of SECRET_KEYS) {
    const v = env?.[k];
    if (v && v.length >= 6) s = s.split(v).join('[redacted]').split(v.replace(/^0x/, '')).join('[redacted]');
  }
  return s.replace(/\b(?:https?|wss?):\/\/[^\s"')]+/gi, '[url]');
}

/** First meaningful line of an error, redacted. */
export function safeError(e: unknown, env?: Partial<Env>): string {
  const x = e as { details?: string; shortMessage?: string; message?: string };
  const head = x?.shortMessage || x?.message || String(e);
  const text = x?.details ? `${head.split('\n')[0]} (${x.details})` : head.split('\n')[0];
  return redact(text, env).slice(0, 200);
}
