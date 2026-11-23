import { MODEL_PRICES_PER_TOKEN, type Env } from '../config';
import { etParts } from '../session';

export interface ChatResult { text: string; tokensIn: number; tokensOut: number; cost: number }

export async function spentToday(env: Env): Promise<number> {
  const day = etParts(new Date()).date;
  const r = await env.DB.prepare('SELECT COALESCE(SUM(cost_usd),0) AS s FROM ai_usage WHERE day = ?').bind(day).first<{ s: number }>();
  return r?.s ?? 0;
}

export async function capReached(env: Env): Promise<boolean> {
  return (await spentToday(env)) >= Number(env.AI_DAILY_CAP_USD || '4');
}

/** One OpenRouter chat call returning JSON text. Logs tokens and cost. Throws if capped or failed. */
export async function chatJson(env: Env, purpose: string, model: string, system: string, user: string, maxTokens = 1200): Promise<ChatResult> {
  if (!env.OPENROUTER_API_KEY) throw new Error('no OPENROUTER_API_KEY');
  if (await capReached(env)) throw new Error('daily AI spend cap reached');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  let ok = 0, tokensIn = 0, tokensOut = 0, cost = 0;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'Quintel',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        usage: { include: true },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const j: any = await res.json();
    tokensIn = j?.usage?.prompt_tokens ?? 0;
    tokensOut = j?.usage?.completion_tokens ?? 0;
    const price = MODEL_PRICES_PER_TOKEN[model] ?? { in: 0.000002, out: 0.00001 };
    cost = typeof j?.usage?.cost === 'number' ? j.usage.cost : tokensIn * price.in + tokensOut * price.out;
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${j?.error?.message ?? ''}`);
    const text: string = j?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('empty completion');
    ok = 1;
    return { text, tokensIn, tokensOut, cost };
  } finally {
    clearTimeout(t);
    const now = new Date();
    await env.DB.prepare('INSERT INTO ai_usage (ts, day, purpose, model, tokens_in, tokens_out, cost_usd, ok) VALUES (?,?,?,?,?,?,?,?)')
      .bind(now.toISOString(), etParts(now).date, purpose, model, tokensIn, tokensOut, cost, ok).run();
  }
}

export function parseJsonLoose<T>(text: string): T {
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  return JSON.parse(a >= 0 ? s.slice(a, b + 1) : s) as T;
}
