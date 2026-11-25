import { useCallback, useEffect, useState } from 'react';
import { DEAD_ADDRESS } from '../../../worker/src/burn/scenario';

/** The browser wallet (EIP-1193). Nothing is asked of it until the visitor presses a button. */
export interface Provider {
  request(a: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, f: (...a: any[]) => void): void;
  removeListener?(event: string, f: (...a: any[]) => void): void;
}
export const injected = (): Provider | null => (globalThis as unknown as { ethereum?: Provider }).ethereum ?? null;

export type WalletProblem = 'none' | 'rejected' | 'busy' | 'failed';
export class WalletError extends Error { constructor(public problem: WalletProblem) { super(problem); } }
export const problemOf = (e: unknown): WalletProblem => {
  if (e instanceof WalletError) return e.problem;
  const code = (e as { code?: unknown } | null)?.code;
  return code === 4001 || code === 'ACTION_REJECTED' ? 'rejected' : code === -32002 ? 'busy' : 'failed';
};
async function ask<T>(method: string, params: unknown[] = []): Promise<T> {
  const p = injected();
  if (!p) throw new WalletError('none');
  try { return (await p.request({ method, params })) as T; } catch (e) { throw new WalletError(problemOf(e)); }
}

const word = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
/** transfer(burn address, amount). Never an approval. */
export const burnCalldata = (raw: bigint) => '0xa9059cbb' + word(DEAD_ADDRESS) + word(raw.toString(16));
export const hexText = (s: string) => '0x' + [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
const readNumber = async (to: string, data: string) => {
  const r = await ask<unknown>('eth_call', [{ to, data }, 'latest']);
  if (typeof r !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(r)) throw new WalletError('failed');
  return BigInt(r);
};
export const readDecimals = async (token: string) => Number(await readNumber(token, '0x313ce567'));
export const readBalance = (token: string, owner: string) => readNumber(token, '0x70a08231' + word(owner));

/** A contract wallet can't make the plain signature step 3 needs. An account with EIP-7702 code (0xef0100…) still can. */
export async function isContractWallet(account: string): Promise<boolean> {
  const code = await ask<unknown>('eth_getCode', [account, 'latest']);
  if (typeof code !== 'string' || !code.startsWith('0x')) throw new WalletError('failed');
  return !/^0x0*$/.test(code) && !/^0xef0100/i.test(code);
}

const chainHex = (id: number) => '0x' + id.toString(16);
export const walletChain = async () => Number(await ask<string>('eth_chainId'));
export async function switchChain(id: number, explorer: string) {
  try { await injected()!.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex(id) }] }); } catch (e) {
    // wallets name an unknown network in different ways: anything but a refusal or an open request tries to add it
    const p = problemOf(e);
    if (p === 'rejected' || p === 'busy') throw new WalletError(p);
    await ask('wallet_addEthereumChain', [{ chainId: chainHex(id), chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'], blockExplorerUrls: [explorer] }]);
  }
}
/** Opens the wallet on one token transfer to the burn address. The chain ID makes a wallet that has just moved to another network refuse. Returns the transaction hash. */
export const sendBurn = (from: string, token: string, raw: bigint, chainId: number) => ask<string>('eth_sendTransaction', [{ from, to: token, value: '0x0', data: burnCalldata(raw), chainId: chainHex(chainId) }]);
/** Opens the wallet on a plain message (EIP-191). Costs nothing. */
export const signText = (message: string, account: string) => ask<string>('personal_sign', [hexText(message), account]);

export interface Wallet { present: boolean; account: string | null; chain: number | null; connect: () => Promise<string>; refresh: () => Promise<void> }
export function useWallet(): Wallet {
  const [s, set] = useState<{ account: string | null; chain: number | null }>({ account: null, chain: null });
  const [present, setPresent] = useState(() => !!injected());
  useEffect(() => { // some wallets arrive after the page
    const on = () => setPresent(!!injected());
    window.addEventListener('ethereum#initialized', on);
    const t = window.setTimeout(on, 1000);
    return () => { window.removeEventListener('ethereum#initialized', on); clearTimeout(t); };
  }, []);
  const refresh = useCallback(async () => { const chain = await walletChain(); set((p) => ({ ...p, chain })); }, []);
  const connect = useCallback(async () => {
    const [account] = await ask<string[]>('eth_requestAccounts');
    if (!account) throw new WalletError('failed');
    set({ account, chain: await walletChain() });
    return account;
  }, []);
  useEffect(() => {
    const p = injected();
    if (!p?.on || !s.account) return;
    const accounts = (a: string[]) => set((x) => ({ ...x, account: a[0] ?? null }));
    const chain = (c: string) => set((x) => ({ ...x, chain: Number(c) }));
    p.on('accountsChanged', accounts); p.on('chainChanged', chain);
    return () => { p.removeListener?.('accountsChanged', accounts); p.removeListener?.('chainChanged', chain); };
  }, [s.account]);
  return { present, ...s, connect, refresh };
}
