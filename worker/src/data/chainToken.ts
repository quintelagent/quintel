import type { Env } from '../config';

/**
 * On-chain NVDA stock-token price on Robinhood Chain.
 * Primary: Uniswap V3 NVDA/USDG pool slot0 (token0 = USDG 6dp, token1 = NVDA 18dp).
 * Fallback: Chainlink "Robinhood NVDA (24/7)" feed (8 decimals).
 * Raw JSON-RPC eth_call — no ABI decoding of the full slot0 tuple (pools differ in word count).
 */

export const DEFAULT_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const DEFAULT_POOL = '0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3';
export const CHAINLINK_NVDA_247 = '0x321A36e441DfBadA01Aa6f9884F14a344E133D1F';

export interface ChainPrice { price: number; source: 'pool' | 'chainlink'; ts: string; poolPrice?: number; oraclePrice?: number }

async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    });
    const j: any = await res.json();
    if (j.error) throw new Error(j.error.message);
    if (typeof j.result !== 'string' || j.result.length < 66) throw new Error('short eth_call result');
    return j.result;
  } finally {
    clearTimeout(t);
  }
}

/** USD per NVDA token from a sqrtPriceX96 where token0 = USDG(6) and token1 = NVDA(18). */
export function priceFromSqrtX96(sqrtPriceX96: bigint): number {
  // USD per NVDA = 1e12 * 2^192 / sqrtP^2 ; compute with 1e8 extra precision in BigInt
  const num = (10n ** 20n) << 192n;
  const den = sqrtPriceX96 * sqrtPriceX96;
  return Number(num / den) / 1e8;
}

export async function poolPrice(rpc: string, pool: string): Promise<number> {
  const r = await ethCall(rpc, pool, '0x3850c7bd'); // slot0()
  const sqrt = BigInt('0x' + r.slice(2, 66));
  if (sqrt === 0n) throw new Error('pool not initialised');
  return priceFromSqrtX96(sqrt);
}

export async function chainlinkPrice(rpc: string, feed: string): Promise<{ price: number; updatedAt: number }> {
  const r = await ethCall(rpc, feed, '0xfeaf968c'); // latestRoundData()
  const word = (i: number) => BigInt('0x' + r.slice(2 + 64 * i, 66 + 64 * i));
  return { price: Number(word(1)) / 1e8, updatedAt: Number(word(3)) };
}

export async function getChainPrice(env: Env): Promise<ChainPrice> {
  const rpc = env.CHAIN_RPC_URL || DEFAULT_RPC;
  const pool = env.NVDA_POOL_ADDRESS || DEFAULT_POOL;
  const [p, o] = await Promise.allSettled([poolPrice(rpc, pool), chainlinkPrice(rpc, CHAINLINK_NVDA_247)]);
  const pp = p.status === 'fulfilled' && p.value > 0 ? p.value : undefined;
  const op = o.status === 'fulfilled' && o.value.price > 0 ? o.value.price : undefined;
  const ts = new Date().toISOString();
  // Prefer the traded pool price, unless it disagrees wildly with the oracle (thin-liquidity spike).
  if (pp && (!op || Math.abs(pp / op - 1) < 0.05)) return { price: pp, source: 'pool', ts, poolPrice: pp, oraclePrice: op };
  if (op) return { price: op, source: 'chainlink', ts, poolPrice: pp, oraclePrice: op };
  throw new Error('chain price unavailable: ' + [p, o].map((x) => (x.status === 'rejected' ? String(x.reason) : 'ok')).join('; '));
}
