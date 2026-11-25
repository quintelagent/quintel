/** Burn-to-run rules shared by the worker and the page: what a scenario may be, and the exact message the burner signs. */
import type { EngineInputs, Shock } from '../../../engine/src/types';

export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
export const CONFIRMATIONS = 2;
export const BURN_PATHS_PER_MODEL = 200_000;
export const NOT_OPEN = 'Not open yet';
/** The engine's three horizons, in trading days. */
export const BURN_HORIZONS = { 1: 'Next close', 5: '1 week', 21: '1 month' } as const;
export type BurnHorizon = keyof typeof BURN_HORIZONS;
export interface Scenario { price: number; horizon: BurnHorizon; shock: Shock | null }

export const SHOCK_BOUNDS = {
  drift: { min: -0.3, max: 0.2, step: 0.01 },
  jumpMult: { min: 1, max: 5, step: 0.1 },
  volMult: { min: 0.5, max: 3, step: 0.05 },
} as const;
const SHOCK_KEYS = ['drift', 'jumpMult', 'volMult'] as const;
/** The price may sit between a tenth and ten times the latest run's price. */
export const PRICE_SPAN = 10;
export const priceInSpan = (price: number, spot: number) => price >= spot / PRICE_SPAN && price <= spot * PRICE_SPAN;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const exactKeys = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => isObj(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));

/** A whole number of steps inside the bounds, cleaned of float noise; null when it is not. */
function onStep(v: unknown, b: { min: number; max: number; step: number }): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v / b.step);
  if (Math.abs(v / b.step - n) > 1e-6) return null;
  const clean = Math.round(n * b.step * 100) / 100;
  return clean >= b.min && clean <= b.max ? clean + 0 : null;
}

/** Strict: exact keys, real numbers, in bounds. A shock that changes nothing becomes null. */
export function parseScenario(v: unknown): Scenario | null {
  if (!exactKeys(v, ['price', 'horizon', 'shock'])) return null;
  const { price: p, horizon: h } = v;
  if (typeof p !== 'number' || !(p >= 1 && p <= 1_000_000) || Math.abs(p * 100 - Math.round(p * 100)) > 1e-6) return null;
  if (h !== 1 && h !== 5 && h !== 21) return null;
  const price = Math.round(p * 100) / 100;
  if (v.shock === null) return { price, horizon: h, shock: null };
  if (!exactKeys(v.shock, SHOCK_KEYS)) return null;
  const [drift, jumpMult, volMult] = SHOCK_KEYS.map((k) => onStep((v.shock as Record<string, unknown>)[k], SHOCK_BOUNDS[k]));
  if (drift === null || jumpMult === null || volMult === null) return null;
  const none = drift === 0 && jumpMult === 1 && volMult === 1;
  return { price, horizon: h, shock: none ? null : { drift: drift === 0 ? 0 : drift, jumpMult, volMult } };
}

const signed = (x: number) => (x > 0 ? '+' : '') + Math.round(x * 100) + '%';
export const shockText = (s: Shock | null) => (s ? `drift ${signed(s.drift)} over 1 month, jumps ${s.jumpMult.toFixed(1)}x, volatility ${s.volMult.toFixed(2)}x` : 'none');

export interface SignedRequest { domain: string; chainId: number; tx: string; scenario: Scenario; anonymous: boolean }
/** Plain text, signed with EIP-191. Anything that changes the run or how it is shown is in here. */
export function burnMessage({ domain, chainId, tx, scenario: s, anonymous }: SignedRequest): string {
  return [
    `Burn-to-run request on ${domain}`,
    '',
    'This asks for one public custom scenario run for the burn below. Signing is free and moves no tokens.',
    '',
    `Chain ID: ${chainId}`,
    `Burn transaction: ${tx.toLowerCase()}`,
    `Price: $${s.price.toFixed(2)}`,
    `Horizon: ${BURN_HORIZONS[s.horizon]}`,
    `Shock: ${shockText(s.shock)}`,
    `Shown in the gallery as: ${anonymous ? 'Anonymous' : 'short address'}`,
  ].join('\n');
}

/** An official run's stored inputs with two changes: the price level, and the shock if there is one. */
export function customInputs(base: EngineInputs, s: Scenario): EngineInputs {
  const { shock: _none, ...rest } = base;
  return { ...rest, preCrisisLevel: s.price, ...(s.shock ? { shock: s.shock } : {}) };
}

export const shortAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-2)}`;
export const isTxHash = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-fA-F]{64}$/.test(s);
export const isAddress = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s);

/* ---- what /api/burn takes and answers ---- */

export interface BurnBodyJson { tx: string; scenario: Scenario; anonymous: boolean; signature: string }

export interface BurnSummary {
  open: boolean; status: 'Open' | typeof NOT_OPEN;
  domain: string; chainId: number; explorer: string; burnAddress: string; confirmations: number;
  token: string | null; amount: number | null; decimals: number | null; amountRaw: string | null; fromBlock: number | null;
  burned: number; requests: number;
  /** runs waiting or running now: a new burn waits behind these */
  queued: number;
}
export type BurnStatus = 'queued' | 'running' | 'done' | 'failed';
export interface HorizonOdds { days: number; above: number; atOrBelow: number }
export interface BurnResult {
  spot: number; above: number; atOrBelow: number; horizons: HorizonOdds[];
  pct: { p1: number; p5: number; p50: number; p95: number; p99: number };
  mean: number; hist: { lo: number; hi: number; counts: number[] };
}
export interface BurnRunRow { ts: string; baseRunId: number; seed: string; inputHash: string; outputHash: string; pathsPerModel: number; result: BurnResult }
/** `by` is a short address, or null when the burner chose Anonymous (then `tx` is null too). */
export interface BurnRequestView { id: number; status: BurnStatus; by: string | null; tx: string | null; createdAt: string; scenario: Scenario; ahead: number; run: BurnRunRow | null }
export interface BurnRunView extends BurnRunRow { id: number; label: string; by: string | null; tx: string | null; scenario: Scenario; inputs: EngineInputs; verify: string }
export interface GalleryItem { id: number; ts: string; by: string | null; scenario: Scenario; spot: number; above: number; atOrBelow: number; shape: number[] }
export type BurnErrorCode = 'bad_request' | 'too_large' | 'slow_down' | 'not_open' | 'not_found' | 'reverted' | 'wrong_token' | 'wrong_recipient' | 'too_small' | 'too_old' | 'wrong_signer' | 'used' | 'out_of_range' | 'unavailable';
export type BurnReply = { id: number; status: BurnStatus } | { waiting: true; confirmations: number; needed: number } | { error: BurnErrorCode };
