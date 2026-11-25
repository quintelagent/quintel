import { afterEach, describe, expect, it, vi } from 'vitest';
import { burnCalldata, hexText, isContractWallet, problemOf, sendBurn, signText, switchChain, WalletError } from '../src/lib/wallet';
import { burnTransfer, DEAD_ADDRESS, errorText, sendRequest, type BurnSummary, shockLine, waitMinutes, waitText, when } from '../src/lib/burn';

const TOKEN = '0x1111111111111111111111111111111111111111', ME = '0x2222222222222222222222222222222222222222';
const stub = (f: (m: string, p?: unknown[]) => unknown) => { const calls: [string, unknown[] | undefined][] = []; vi.stubGlobal('ethereum', { request: async ({ method, params }: { method: string; params?: unknown[] }) => { calls.push([method, params]); return f(method, params); } }); return calls; };
afterEach(() => { vi.unstubAllGlobals(); });

describe('wallet', () => {
  it('a burn is one transfer to the burn address, never an approval', async () => {
    expect(burnCalldata(1000n * 10n ** 18n)).toBe('0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead00000000000000000000000000000000000000000000003635c9adc5dea00000');
    const calls = stub(() => '0xabc');
    await sendBurn(ME, TOKEN, 5n, 4663);
    expect(calls).toEqual([['eth_sendTransaction', [{ from: ME, to: TOKEN, value: '0x0', data: burnCalldata(5n), chainId: '0x1237' }]]]);
  });
  it('knows a contract wallet, which could burn but never sign', async () => {
    for (const [code, is] of [['0x', false], ['0xef0100' + '1'.repeat(40), false], ['0x6080', true]] as const) { stub(() => code); expect(await isContractWallet(ME)).toBe(is); }
    stub(() => null); await expect(isContractWallet(ME)).rejects.toThrow('failed');
  });
  it('adds the network when a wallet does not know it, and never after a refusal', async () => {
    const calls = stub((m) => { if (m === 'wallet_switchEthereumChain') throw { code: -32603 }; return null; });
    await switchChain(4663, 'https://x'); expect(calls.map((c) => c[0])).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain']);
    const no = stub(() => { throw { code: 4001 }; });
    await expect(switchChain(4663, 'https://x')).rejects.toThrow('rejected'); expect(no.length).toBe(1);
  });
  it('signs plain text, unicode included', async () => {
    const calls = stub(() => '0x1');
    await signText('a…', ME);
    expect([calls[0], hexText('a')]).toEqual([['personal_sign', ['0x61e280a6', ME]], '0x61']);
  });
  it('adds the network only when the wallet does not know it', async () => {
    const calls = stub((m) => { if (m === 'wallet_switchEthereumChain') throw { code: 4902 }; return null; });
    await switchChain(4663, 'https://explorer.test');
    expect(calls.map((c) => c[0])).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain']);
    expect((calls[1][1] as any)[0]).toMatchObject({ chainId: '0x1237', chainName: 'Robinhood Chain' });
    const no = stub(() => { throw { code: 4001 }; });
    await expect(switchChain(4663, '')).rejects.toBeInstanceOf(WalletError);
    expect(no).toHaveLength(1);
  });
  it('tells problems apart', async () => {
    expect([{ code: 4001 }, { code: -32002 }, { code: -32000 }, null, new Error('x'), new WalletError('none')].map(problemOf)).toEqual(['rejected', 'busy', 'failed', 'failed', 'failed', 'none']);
    vi.stubGlobal('ethereum', undefined);
    await expect(sendBurn(ME, TOKEN, 1n, 4663)).rejects.toMatchObject({ problem: 'none' });
  });
});

describe('burn page', () => {
  it('sends only what the page shows', () => {
    const s: BurnSummary = { open: true, status: 'Open', domain: 'x', chainId: 4663, explorer: '', burnAddress: DEAD_ADDRESS, confirmations: 2, token: TOKEN, amount: 1000, decimals: 6, amountRaw: '1000000000', fromBlock: 1, burned: 0, requests: 0, queued: 0 };
    const official = { token: TOKEN, chainId: 4663 };
    expect(burnTransfer(s, s, official)).toEqual({ token: TOKEN, raw: 1_000_000_000n, chainId: 4663, decimals: 6 });
    for (const x of [{ open: false }, { token: ME }, { token: null }, { amount: 2000, amountRaw: '2000000000' }, { amountRaw: '1000000001' }, { amountRaw: null }, { decimals: null }, { decimals: 18 }, { chainId: 1 }, { burnAddress: ME }]) expect(burnTransfer(s, { ...s, ...x }, official), JSON.stringify(x)).toBeNull();
    for (const o of [{ token: ME, chainId: 4663 }, { token: null, chainId: 4663 }, { token: TOKEN, chainId: 1 }]) expect(burnTransfer(s, s, o)).toBeNull();
    expect(burnTransfer({ ...s, burnAddress: ME }, s, official)).toBeNull();
  });
  it('a long wait reads in hours', () => { expect([25, 59, 60, 310].map(waitText)).toEqual(['about 25 min', 'about 59 min', 'about 1h', 'about 5h 10m']); });
  it('wait is the next slot, then one slot per run ahead', () => {
    const t = new Date('2026-11-24T15:04:00Z');
    expect([waitMinutes(0, t), waitMinutes(2, t)]).toEqual([7, 27]);
  });
  it('plain lines', () => {
    expect([when(1), when(5), when(21)]).toEqual(['at the next close', 'in 1 week', 'in 1 month']);
    expect([shockLine(null), shockLine({ drift: -0.1, jumpMult: 2, volMult: 1.5 })]).toEqual(['No shock', 'Drift −10%, jumps 2.0×, volatility 1.50×']);
    expect(errorText('too_small', '1,000')).toBe('This burn is below 1,000 $QNTL, so it can’t start a run.');
  });
  it('posts without cookies, and an unreadable answer is a plain retry', async () => {
    const f = vi.fn(async (_u: string, _i: RequestInit) => new Response('{"id":3,"status":"queued"}'));
    vi.stubGlobal('fetch', f);
    const body = { tx: '0x1', scenario: { price: 1, horizon: 1 as const, shock: null }, anonymous: false, signature: '0x2' };
    expect(await sendRequest(body)).toEqual({ id: 3, status: 'queued' });
    expect(f.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'omit' });
    for (const bad of ['<html>', '{"error":"strange"}', '{}']) { vi.stubGlobal('fetch', async () => new Response(bad)); expect(await sendRequest(body)).toEqual({ error: 'unavailable' }); }
    vi.stubGlobal('fetch', async () => { throw new TypeError('offline'); });
    expect(await sendRequest(body)).toEqual({ error: 'unavailable' });
  });
});
