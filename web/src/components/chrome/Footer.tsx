import { Link } from '../../lib/router';
import { LINKS } from '../../lib/links';
import { flagOn } from '../../features';
import { MuteToggle, Wordmark } from './Header';

const on = (flag: string, href: string, t: string): [string, string][] => (flagOn(flag) ? [[href, t]] : []);
export function Footer() {
  const groups: { t: string; l: [string, string][] }[] = [
    { t: 'Product', l: [['/briefings', 'Briefings'], ['/verify', 'Verify'], ['/status', 'Status'], ['/changelog', 'Changelog'], ...on('PRO_TIERS', '/pro', 'Pro'), ...on('HOLDERS_BOARD', '/board', 'Holders Board'), ...on('DAILY_SCORECARD_PUBLIC', '/scorecard', 'Scorecard'), ...on('MCP_SERVER', '/mcp', 'Use from your AI'), ...on('BURN_TO_RUN', '/burn', 'Burn-to-run'), ...on('REPLAY', '/replay', 'Replay')] },
    { t: 'Docs', l: [['/docs/readme', 'Readme'], ['/docs/methodology', 'Methodology'], ['/docs/proof', 'Proof'], ['/docs/limits', 'Limits'], ['/docs/deployments', 'Deployments'], ['/incidents', 'Incidents']] },
    { t: 'Elsewhere', l: [[LINKS.x, 'X @quintelagent'], [LINKS.github, 'GitHub']] },
  ];
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <Wordmark />
          {groups.map((g) => (
            <nav key={g.t} aria-label={g.t}><div className="label">{g.t}</div><ul>{g.l.map(([h, t]) => <li key={h}><Link href={h}>{t}</Link></li>)}</ul></nav>
          ))}
        </div>
        <MuteToggle />
        <p className="note">Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.</p>
        <p className="note">© 2026 Quintel</p>
      </div>
    </footer>
  );
}
