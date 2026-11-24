import source from '../../../CHANGELOG.md?raw';
import { parseChangelog, type Entry } from '../lib/docs';
import { useMeta } from '../lib/meta';
import { Button, Card, EmptyState } from '../components/ui';
import { Inline, Markdown } from './Docs';
import './changelog.css';

const FILE = 'CHANGELOG.md';
const LOG = parseChangelog(source);

/** Ship log, flag-off version (feature 14): CHANGELOG.md as a plain list. */
export function Changelog() {
  useMeta('Changelog · Quintel', 'Everything we’ve shipped, newest first.');
  return (
    <div className="page wrap">
      <div className="page-head"><h1>Changelog.</h1><p>Everything we’ve shipped, newest first.</p></div>
      {LOG.releases.length === 0 ? <Card><EmptyState text="The first release notes post at launch." action={<Button variant="secondary" href="/status">See status</Button>} /></Card> : (
        <div className="changelog">
          {LOG.releases.map((r, i) => (
            <section key={i} className="changelog-release" aria-labelledby={`changelog-${i}`}>
              <h2 id={`changelog-${i}`} className="label">{r.title}</h2>
              <div className="changelog-list">
                {r.sections.map((s, j) => s.entries.length > 0 && (
                  <div key={j} className="changelog-sec">
                    {s.title && <h3>{s.title}</h3>}
                    <ul>{s.entries.map((e, k) => <li key={k}><Row e={e} /></li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {LOG.intro.length > 0 && <div className="changelog-intro"><Markdown tokens={LOG.intro} file={FILE} /></div>}
    </div>
  );
}

function Row({ e }: { e: Entry }) {
  if (e.ship) return <><div className="changelog-ship"><b>{e.ship.title}</b><span className="label">{e.ship.time}</span></div>{e.ship.line && <p>{e.ship.line}</p>}</>;
  return <p><Inline tokens={e.tokens} file={FILE} /></p>;
}
