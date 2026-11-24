/** Owner values for the token section. Null until the owner posts them; nothing here is guessed. */
export interface TokenConfig {
  ponsUrl: string | null;
  pumpUrl: string | null;
  /** token page on the explorer; the chain explorer from /api/config is used until it is set */
  explorerUrl: string | null;
}
/** shown until an official address exists */
export const BEFORE_LAUNCH = 'Launching on Pons, Wed Nov 25, 8:30am ET. Any CA you see before launch is fake.';
export const TOKEN_CONFIG: TokenConfig = { ponsUrl: null, pumpUrl: null, explorerUrl: null };
