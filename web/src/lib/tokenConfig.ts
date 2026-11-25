import { EXPLORER_URL, PONS_URL, PUMP_URL } from './launch';

/** Owner values for the token section. Null until the owner posts them; nothing here is guessed. */
export interface TokenConfig {
  ponsUrl: string | null;
  pumpUrl: string | null;
  /** token page on the explorer; the chain explorer from /api/config is used until it is set */
  explorerUrl: string | null;
}
/** shown until an official address exists */
export const BEFORE_LAUNCH = 'Launching on Pons, Wed Nov 25, 11:00am ET. Any CA you see before launch is fake.';
export const TOKEN_CONFIG: TokenConfig = { ponsUrl: PONS_URL, pumpUrl: PUMP_URL, explorerUrl: EXPLORER_URL };
