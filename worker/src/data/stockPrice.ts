import type { Env } from '../config';
import { getJson, firstOk } from './http';

export interface StockQuote {
  price: number;
  /** previous regular-session close */
  prevClose: number | null;
  ts: string;
}

export interface StockPriceAdapter {
  name: string;
  quote(symbol: string): Promise<StockQuote>;
}

export const alpacaHeaders = (env: Env) => ({
  'APCA-API-KEY-ID': env.ALPACA_KEY_ID || '',
  'APCA-API-SECRET-KEY': env.ALPACA_SECRET_KEY || '',
});

export function alpacaQuote(env: Env): StockPriceAdapter {
  return {
    name: 'alpaca',
    async quote(symbol) {
      if (!env.ALPACA_KEY_ID) throw new Error('no ALPACA_KEY_ID');
      const s = await getJson<any>(`https://data.alpaca.markets/v2/stocks/${symbol}/snapshot?feed=iex`, { headers: alpacaHeaders(env) });
      const price = s?.latestTrade?.p ?? s?.minuteBar?.c ?? s?.dailyBar?.c;
      if (!(price > 0)) throw new Error('alpaca: no price');
      return { price, prevClose: s?.prevDailyBar?.c ?? null, ts: s?.latestTrade?.t ?? new Date().toISOString() };
    },
  };
}

export function finnhubQuote(env: Env): StockPriceAdapter {
  return {
    name: 'finnhub',
    async quote(symbol) {
      if (!env.FINNHUB_API_KEY) throw new Error('no FINNHUB_API_KEY');
      const q = await getJson<any>(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${env.FINNHUB_API_KEY}`);
      if (!(q?.c > 0)) throw new Error('finnhub: no price');
      return { price: q.c, prevClose: q.pc ?? null, ts: new Date((q.t || Date.now() / 1000) * 1000).toISOString() };
    },
  };
}

export function yahooQuote(): StockPriceAdapter {
  return {
    name: 'yahoo',
    async quote(symbol) {
      const j = await getJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`);
      const m = j?.chart?.result?.[0]?.meta;
      if (!(m?.regularMarketPrice > 0)) throw new Error('yahoo: no price');
      return { price: m.regularMarketPrice, prevClose: m.chartPreviousClose ?? null, ts: new Date(m.regularMarketTime * 1000).toISOString() };
    },
  };
}

export async function getStockQuote(env: Env, symbol: string) {
  const adapters = [alpacaQuote(env), finnhubQuote(env), yahooQuote()];
  return firstOk(adapters.map((a) => [a.name, () => a.quote(symbol)] as [string, () => Promise<StockQuote>]));
}
