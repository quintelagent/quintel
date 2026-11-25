import { Link } from '../../lib/router';
import { FEATURES, flagOn } from '../../features';
import { SocialLinks } from '../ui';
import { MuteToggle, Wordmark } from './Header';

/** pages of released features link themselves */
const released = FEATURES.filter((f) => f.flag && /^\/(?!changelog)\w/.test(f.route) && flagOn(f.flag)).map((f): [string, string] => [f.route, f.name]);
export function Footer() {
  const groups: { t: string; l: [string, string][] }[] = [
    { t: 'Product', l: [['/briefings', 'Briefings'], ['/verify', 'Verify'], ['/status', 'Status'], ['/changelog', 'Changelog'], ...released] },
    { t: 'Docs', l: [['/docs/readme', 'Readme'], ['/docs/methodology', 'Methodology'], ['/docs/proof', 'Proof'], ['/docs/limits', 'Limits'], ['/docs/security', 'Security'], ['/docs/trust', 'Trust'], ['/docs/deployments', 'Deployments'], ['/incidents', 'Incidents']] },
  ];
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <Wordmark />
          {groups.map((g) => (
            <nav key={g.t} aria-label={g.t}><div className="label">{g.t}</div><ul>{g.l.map(([h, t]) => <li key={h}><Link href={h}>{t}</Link></li>)}</ul></nav>
          ))}
          <nav aria-label="Elsewhere"><div className="label">Elsewhere</div><SocialLinks /></nav>
        </div>
        <MuteToggle />
        <p className="note">Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.</p>
        <p className="note">© 2026 Quintel</p>
      </div>
    </footer>
  );
}
