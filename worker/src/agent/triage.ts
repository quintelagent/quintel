import type { Env } from '../config';
import type { Headline } from '../data/news';
import { safeError } from '../redact';
import { chatJson, parseJsonLoose } from './openrouter';

export interface Triage { id: string; relevant: boolean; score: number; category: string; oneLine: string }

const SYSTEM = `You triage news headlines for a quantitative scenario engine that tracks NVDA (Nvidia stock).
For each headline return {id, relevant, score, category, oneLine}.
- relevant: true only if it could plausibly move NVDA's price or volatility.
- score: 0-1 expected impact on NVDA volatility (0.9+ only for major company-specific events).
- category: one of earnings, guidance, regulatory, legal, export, leadership, product, supply, macro, sector, other.
- oneLine: <= 20 words, neutral, describe legal matters only "as reported" (e.g. "reported SEC probe"), never speculate, never mention anyone's personal life, never give advice.
Return JSON {"items":[...]} only.`;

/** Keyword fallback when the model is unavailable or the cap is reached. */
export function heuristicTriage(h: Headline): Triage {
  const t = h.title.toLowerCase();
  const strong = /(probe|investigat|sec\b|doj|lawsuit|export|ban|restrict|guidance|earnings|downgrade|upgrade|recall|resign|steps down|ceo|cfo|antitrust|tariff)/;
  const mentions = /(nvidia|nvda)/.test(t);
  const score = mentions ? (strong.test(t) ? 0.7 : 0.35) : strong.test(t) ? 0.25 : 0.05;
  return { id: h.id, relevant: score >= 0.3, score, category: 'other', oneLine: h.title.slice(0, 140) };
}

export async function triageHeadlines(env: Env, items: Headline[], log: string[] = []): Promise<Triage[]> {
  if (!items.length) return [];
  try {
    const user = JSON.stringify(items.map((h) => ({ id: h.id, title: h.title, source: h.source })));
    const r = await chatJson(env, 'triage', env.TRIAGE_MODEL, SYSTEM, user, 6000);
    const j = parseJsonLoose<{ items: Triage[] }>(r.text);
    const byId = new Map(j.items.map((x) => [x.id, x]));
    return items.map((h) => {
      const x = byId.get(h.id);
      if (!x) return heuristicTriage(h);
      return {
        id: h.id,
        relevant: !!x.relevant,
        score: Math.max(0, Math.min(1, Number(x.score) || 0)),
        category: String(x.category || 'other').slice(0, 20),
        oneLine: String(x.oneLine || h.title).slice(0, 200),
      };
    });
  } catch (e) {
    log.push(`AI triage failed, used keyword scoring: ${safeError(e, env)}`);
    return items.map(heuristicTriage);
  }
}

/** News intensity 0–1: relevance-weighted headline flow over the last 24h with a 6h half-life. */
export function newsIntensity(rows: { ts: string; score: number; relevant: number }[], now: Date): number {
  let s = 0;
  for (const r of rows) {
    if (!r.relevant) continue;
    const ageH = (now.getTime() - new Date(r.ts).getTime()) / 3.6e6;
    if (ageH < 0 || ageH > 24) continue;
    s += r.score * Math.pow(0.5, ageH / 6);
  }
  return Math.min(1, s / 3);
}
