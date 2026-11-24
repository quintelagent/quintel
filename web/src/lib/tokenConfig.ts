/** Owner values for the token section. Null until the owner posts them; nothing here is guessed. */
export interface HoldTier { name: string; amount: number; features?: string[] }
export interface TokenConfig {
  tiers: HoldTier[] | null;
  ponsUrl: string | null;
  pumpUrl: string | null;
  /** token page on the explorer; the chain explorer from /api/config is used until it is set */
  explorerUrl: string | null;
  burn: { amount: number; docsUrl: string | null } | null;
}
export const TOKEN_CONFIG: TokenConfig = { tiers: null, ponsUrl: null, pumpUrl: null, explorerUrl: null, burn: null };
/** What holding unlocks (docs/design/features/07). */
export const PRO_FEATURES = ['Custom runs', 'Alerts', 'Pro share cards', 'Early briefings'];
