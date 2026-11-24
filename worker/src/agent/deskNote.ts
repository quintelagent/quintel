import type { Env } from '../config';
import type { TradeEvent } from '../desk/desk';
import { chatJson, parseJsonLoose, capReached } from './openrouter';
import { allowedNumbers, guardText } from './guards';

const SYSTEM = `You write one- or two-sentence desk notes for a PAPER trading desk (not advice) that follows published rules.
Explain plainly why the rule fired, using only numbers from TRADE and RUN. Never use the words buy, sell, guaranteed, prediction.
Return JSON {"note": string}.`;

export async function writeDeskNote(env: Env, t: TradeEvent, summary: unknown): Promise<string> {
  const fallback = `Paper ${t.action === 'enter' ? 'entry' : 'exit'} (${t.side}) at $${t.price.toFixed(2)} — rule: ${t.reason}.`;
  if (!env.OPENROUTER_API_KEY || (await capReached(env))) return fallback;
  try {
    const r = await chatJson(env, 'desk_note', env.BRIEFING_MODEL, SYSTEM, `TRADE: ${JSON.stringify(t)}\nRUN: ${JSON.stringify(summary)}`, 1500);
    const note = String(parseJsonLoose<{ note: string }>(r.text).note || '').slice(0, 400);
    const g = guardText(note, allowedNumbers(t, summary));
    return note && g.ok ? note : fallback;
  } catch {
    return fallback;
  }
}
