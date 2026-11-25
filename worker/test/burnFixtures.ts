import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { TRANSFER_TOPIC } from '../src/burn/chain';
import { burnMessage, DEAD_ADDRESS, type Scenario } from '../src/burn/scenario';

/** Keys are made fresh for every test run; the token and transactions do not exist. */
export const account = () => privateKeyToAccount(generatePrivateKey());
export const TOKEN = '0x1111111111111111111111111111111111111111', OTHER = '0x2222222222222222222222222222222222222222';
export const TX = '0x' + 'ab'.repeat(32);
export const ONE = 10n ** 18n;
const word = (h: string) => '0x' + h.replace(/^0x/, '').toLowerCase().padStart(64, '0');
export const hex = (n: number) => '0x' + n.toString(16);

export interface LogOver { token?: string; from: string; to?: string; value?: bigint; index?: number; [k: string]: unknown }
export const log = ({ token = TOKEN, from, to = DEAD_ADDRESS, value = 1000n * ONE, index = 0, ...rest }: LogOver) => ({
  address: token, topics: [TRANSFER_TOPIC, word(from), word(to)], data: word(value.toString(16)), logIndex: hex(index), blockNumber: hex(500), removed: false, ...rest,
});
export const receipt = (logs: unknown[], over: Record<string, unknown> = {}) => ({ transactionHash: TX, status: '0x1', blockNumber: hex(500), logs, ...over });

export const SCENARIO: Scenario = { price: 160, horizon: 5, shock: null };
export const DOMAIN = 'quintelagent.com';
export const env = (over: Record<string, unknown> = {}) => ({ CHAIN_ID: '4663', CHAIN_EXPLORER: 'https://explorer.test', SITE_URL: 'https://quintelagent.com', QNTL_TOKEN_PONS: TOKEN, BURN_AMOUNT: '1000', BURN_FROM_BLOCK: '100', PREVIEW_FLAGS: 'BURN_TO_RUN', ...over }) as any;

export async function signedBody(a: ReturnType<typeof account>, over: { scenario?: Scenario; anonymous?: boolean; tx?: string; domain?: string; chainId?: number } = {}) {
  const { scenario = SCENARIO, anonymous = false, tx = TX, domain = DOMAIN, chainId = 4663 } = over;
  return { tx, scenario, anonymous, signature: await a.signMessage({ message: burnMessage({ domain, chainId, tx, scenario, anonymous }) }) };
}
export const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://quintelagent.com/api/burn/request', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

/** A pretend node: only what is set here exists. */
export function fakeRpc(state: { receipts: Record<string, unknown>; head: number; decimals?: number; chainId?: number; down?: boolean; calls?: string[] }) {
  return async (_url: unknown, init?: { body?: unknown }) => {
    if (state.down) throw new Error('node down');
    const { method, params } = JSON.parse(String(init?.body));
    state.calls?.push(method);
    const result = method === 'eth_chainId' ? hex(state.chainId ?? 4663)
      : method === 'eth_blockNumber' ? hex(state.head)
      : method === 'eth_getTransactionReceipt' ? state.receipts[params[0]] ?? null
      : method === 'eth_call' ? word((state.decimals ?? 18).toString(16)) : null;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
  };
}
