/** Owner values for the token section. Null until the owner posts them; nothing here is guessed. */
export interface TokenConfig {
  ponsUrl: string | null;
  pumpUrl: string | null;
  /** token page on the explorer; the chain explorer from /api/config is used until it is set */
  explorerUrl: string | null;
}
export const TOKEN_CONFIG: TokenConfig = { ponsUrl: null, pumpUrl: null, explorerUrl: null };
