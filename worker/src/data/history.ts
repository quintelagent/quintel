import type { Env } from '../config';
import { getJson, firstOk } from './http';
import { alpacaHeaders } from './stockPrice';

export interface DailyClose { date: string; close: number }

export interface HistoryAdapter {
  name: string;
  daily(symbol: string, startDate: string): Promise<DailyClose[]>;
}

/** Alpaca daily bars, split-adjusted. SIP feed is allowed for data older than 15 minutes on the free plan. */
export function alpacaHistory(env: Env): HistoryAdapter {
  return {
    name: 'alpaca',
    async daily(symbol, startDate) {
      if (!env.ALPACA_KEY_ID) throw new Error('no ALPACA_KEY_ID');
      const out: DailyClose[] = [];
      let token = '';
      const end = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      for (let page = 0; page < 10; page++) {
        const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${startDate}&end=${end}&adjustment=all&feed=sip&limit=10000${token ? `&page_token=${token}` : ''}`;
        const j = await getJson<any>(url, { headers: alpacaHeaders(env) }, 15000);
        for (const b of j.bars || []) out.push({ date: toEtDate(b.t), close: b.c });
        if (!j.next_page_token) break;
        token = j.next_page_token;
      }
      if (out.length < 120) throw new Error(`alpaca: only ${out.length} bars`);
      return out;
    },
  };
}

export function yahooHistory(): HistoryAdapter {
  return {
    name: 'yahoo',
    async daily(symbol) {
      const j = await getJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5y&interval=1d`, {}, 15000);
      const r = j?.chart?.result?.[0];
      const ts: number[] = r?.timestamp || [];
      const adj: number[] = r?.indicators?.adjclose?.[0]?.adjclose || r?.indicators?.quote?.[0]?.close || [];
      const out: DailyClose[] = [];
      ts.forEach((t, i) => { if (adj[i] > 0) out.push({ date: toEtDate(new Date(t * 1000).toISOString()), close: adj[i] }); });
      if (out.length < 120) throw new Error('yahoo: too few bars');
      return out;
    },
  };
}

function toEtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export async function getDailyHistory(env: Env, symbol: string, startDate: string) {
  const adapters = [alpacaHistory(env), yahooHistory()];
  return firstOk(adapters.map((a) => [a.name, () => a.daily(symbol, startDate)] as [string, () => Promise<DailyClose[]>]));
}

/** Annualised realised vol from today's 5-minute bars (Alpaca IEX). Returns null if unavailable. */
export async function intradayVol(env: Env, symbol: string): Promise<number | null> {
  try {
    if (!env.ALPACA_KEY_ID) return null;
    const start = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
    const j = await getJson<any>(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=5Min&start=${start}&feed=iex&limit=200`, { headers: alpacaHeaders(env) });
    const c: number[] = (j.bars || []).map((b: any) => b.c);
    if (c.length < 12) return null;
    let s = 0, s2 = 0;
    for (let i = 1; i < c.length; i++) { const r = Math.log(c[i] / c[i - 1]); s += r; s2 += r * r; }
    const n = c.length - 1;
    const v = s2 / n - (s / n) ** 2;
    return Math.sqrt(v * 78 * 252); // 78 five-minute bars per session
  } catch {
    return null;
  }
}
