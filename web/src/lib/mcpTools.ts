/** The MCP tools. The worker serves this list and /mcp shows it, so the two can never drift. */
export const MCP_URL = 'https://quintelagent.com/api/mcp';
export const ODDS_NOTE = 'Scenario odds, not advice.';
export const MCP_HORIZONS = ['1d', '1w', '1m'] as const;

export interface McpInput { type: 'number' | 'integer' | 'string'; description: string; enum?: readonly string[]; minimum?: number; maximum?: number; default?: number }
export interface McpTool { name: string; title: string; oneLine: string; description: string; inputs: Record<string, McpInput>; required: readonly string[] }

const tool = <N extends string>(name: N, title: string, oneLine: string, more = '', inputs: Record<string, McpInput> = {}, required: string[] = []) =>
  ({ name, title, oneLine, description: `${oneLine}${more && ' ' + more} ${ODDS_NOTE}`, inputs, required });

export const MCP_TOOLS = [
  tool('get_latest_odds', 'Latest scenario odds', 'The newest run: odds of a rise or a fall over a day, a week and a month.', 'Also the gain kept odds, the Stress Level and the price the run started from.'),
  tool('get_odds_at_price', 'Odds at a price', 'Odds of ending below, or at or above, a price.', 'End of horizon only: where the price ends, not whether it gets there on the way. When the price is the level each run tracks, the odds of any daily close above it within a month are included and labeled.', {
    price: { type: 'number', description: 'Price in US dollars, to the cent, for example 186.64', minimum: 0.01, maximum: 100_000 },
    horizon: { type: 'string', description: '1 day, 1 week (5 trading days) or 1 month (21 trading days)', enum: MCP_HORIZONS },
  }, ['price', 'horizon']),
  tool('get_run', 'One run', 'Any run by its number, with its hashes and fingerprint.', '', { id: { type: 'integer', description: 'Run number, for example 85', minimum: 1, maximum: 999_999_999 } }, ['id']),
  tool('get_briefings', 'Latest briefings', 'The latest briefings: what changed in the odds, and why.', 'Sources are third-party headlines.', { limit: { type: 'integer', description: 'How many, 1 to 5', minimum: 1, maximum: 5, default: 3 } }),
  tool('get_proof', 'Proof', 'The latest fingerprints on Robinhood Chain, and how to verify a run.'),
] as const satisfies readonly McpTool[];
export type McpToolName = (typeof MCP_TOOLS)[number]['name'];

/** "price, horizon (1d, 1w, 1m)", read from the same inputs the server checks */
export function inputsLabel(t: McpTool): string {
  const list = Object.entries(t.inputs).map(([k, i]) => `${k}${i.enum ? ` (${i.enum.join(', ')})` : i.type === 'integer' && i.maximum! < 100 ? ` (${i.minimum}–${i.maximum})` : ''}`);
  return list.join(', ') || 'None';
}
