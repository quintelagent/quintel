import type { Env } from '../config';
import { getJson } from './http';
import { alpacaHeaders } from './stockPrice';

export interface Headline { id: string; ts: string; title: string; url: string; source: string }

export interface NewsAdapter { name: string; latest(symbol: string): Promise<Headline[]> }

export function alpacaNews(env: Env): NewsAdapter {
  return {
    name: 'alpaca',
    async latest(symbol) {
      if (!env.ALPACA_KEY_ID) return [];
      const j = await getJson<any>(`https://data.alpaca.markets/v1beta1/news?symbols=${symbol}&limit=30&sort=desc`, { headers: alpacaHeaders(env) });
      return (j.news || []).map((n: any) => ({ id: 'a:' + n.id, ts: n.created_at, title: n.headline, url: n.url, source: n.source || 'benzinga' }));
    },
  };
}

export function finnhubNews(env: Env): NewsAdapter {
  return {
    name: 'finnhub',
    async latest(symbol) {
      if (!env.FINNHUB_API_KEY) return [];
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      const j = await getJson<any[]>(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${env.FINNHUB_API_KEY}`);
      return (j || []).slice(0, 40).map((n: any) => ({ id: 'f:' + n.id, ts: new Date(n.datetime * 1000).toISOString(), title: n.headline, url: n.url, source: n.source }));
    },
  };
}

/** Merge all adapters, dedupe by normalised title. */
export async function getNews(env: Env, symbol: string): Promise<{ items: Headline[]; errors: string[] }> {
  const errors: string[] = [];
  const all: Headline[] = [];
  for (const a of [alpacaNews(env), finnhubNews(env)]) {
    try { all.push(...(await a.latest(symbol))); } catch (e) { errors.push(`${a.name}: ${(e as Error).message}`); }
  }
  const seen = new Set<string>();
  const items = all
    .filter((h) => h.title && h.url)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .filter((h) => {
      const k = h.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return { items, errors };
}
