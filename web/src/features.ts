/** Features registry: the only place a feature's status lives. `npm run release <feature>` edits this file (one feature per line). */
export type FeatureStatus = 'live' | 'soon' | 'planned';
export interface Feature { id: string; flag: string | null; on: boolean; name: string; oneLine: string; status: FeatureStatus; releaseAt: string | null; shippedAt: string | null; route: string; doc: string | null }

export const FEATURES: Feature[] = [
  { id: 'hero', flag: null, on: true, name: 'Scenario odds', oneLine: '1,000,000 futures and the odds that the gain holds.', status: 'live', releaseAt: null, shippedAt: null, route: '/', doc: '01-hero' },
  { id: 'wall-street-vs-chain', flag: null, on: true, name: 'Wall Street vs Chain', oneLine: 'The exchange price next to the on-chain token price.', status: 'live', releaseAt: null, shippedAt: null, route: '/#chain', doc: '02-wall-street-vs-chain' },
  { id: 'position', flag: null, on: true, name: 'Check my position', oneLine: 'Your odds of profit from the latest run, on your device.', status: 'live', releaseAt: null, shippedAt: null, route: '/#position', doc: '03-check-my-position' },
  { id: 'events', flag: null, on: true, name: 'Event countdowns', oneLine: 'The dates ahead, each with a what-if.', status: 'live', releaseAt: null, shippedAt: null, route: '/#events', doc: '04-event-countdowns' },
  { id: 'feed', flag: null, on: true, name: 'Live activity feed', oneLine: 'Runs, briefings, fingerprints and desk trades as they happen.', status: 'live', releaseAt: null, shippedAt: null, route: '/#briefing', doc: '05-live-activity-feed' },
  { id: 'status', flag: null, on: true, name: 'Status', oneLine: 'What is live, what is next and how the system is running.', status: 'live', releaseAt: null, shippedAt: null, route: '/status', doc: '06-status-page' },
  { id: 'token', flag: null, on: true, name: 'Token section', oneLine: 'What $QNTL does and the official addresses.', status: 'live', releaseAt: null, shippedAt: null, route: '/#token', doc: '07-token-section' },
  { id: 'docs', flag: null, on: true, name: 'Docs', oneLine: 'How Quintel works, how to check it and its limits.', status: 'live', releaseAt: null, shippedAt: null, route: '/docs', doc: '08-docs-hub' },
  { id: 'board', flag: 'HOLDERS_BOARD', on: false, name: 'Holders Board', oneLine: 'An opt-in, anonymous board of codenames and percentages.', status: 'planned', releaseAt: null, shippedAt: null, route: '/board', doc: '10-holders-board' },
  { id: 'mcp', flag: 'MCP_SERVER', on: true, name: 'Use Quintel from your AI', oneLine: 'Scenario odds, briefings and proofs in Claude or Cursor.', status: 'live', releaseAt: null, shippedAt: '2026-11-25T16:43:14.954Z', route: '/mcp', doc: '11-mcp-page' },
  { id: 'scorecard', flag: 'DAILY_SCORECARD_PUBLIC', on: false, name: 'Daily scorecard', oneLine: 'How the odds bands did against each close, misses included.', status: 'planned', releaseAt: null, shippedAt: null, route: '/scorecard', doc: '13-daily-scorecard' },
  { id: 'ship-log', flag: 'SHIP_LOG', on: false, name: 'Ship log', oneLine: 'Every release with its time.', status: 'planned', releaseAt: null, shippedAt: null, route: '/changelog', doc: '14-ship-log' },
  { id: 'burn', flag: 'BURN_TO_RUN', on: false, name: 'Burn-to-run', oneLine: 'Burn $QNTL to request a public custom run.', status: 'planned', releaseAt: null, shippedAt: null, route: '/burn', doc: '15-burn-to-run' },
  { id: 'chain-mode', flag: 'CHAIN_MODE_SPOTLIGHT', on: false, name: '24/7 chain mode spotlight', oneLine: 'The site follows the token while Wall Street is closed.', status: 'planned', releaseAt: null, shippedAt: null, route: '/', doc: '16-chain-mode-spotlight' },
];

/** On previews and local builds only, `?flags=A,B` turns flags on for this tab. Never on the live domain. */
function previewFlags(): string[] {
  try {
    if (typeof location === 'undefined' || /(^|\.)quintelagent\.com$/.test(location.hostname)) return [];
    const q = new URLSearchParams(location.search).get('flags');
    if (q !== null) sessionStorage.setItem('q-flags', q);
    return (sessionStorage.getItem('q-flags') || '').split(',').filter(Boolean);
  } catch { return []; }
}
const preview = previewFlags();
export const flagOn = (flag: string) => preview.includes(flag) || FEATURES.some((f) => f.flag === flag && f.on);
export const featureByFlag = (flag: string) => FEATURES.find((f) => f.flag === flag);
