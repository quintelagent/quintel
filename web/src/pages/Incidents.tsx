import { parseIncident } from '../lib/docs';
import { etDate } from '../lib/format';
import { useMeta } from '../lib/meta';
import { Accordion, Button, Card, EmptyState, Pill } from '../components/ui';
import { Markdown } from './Docs';
import './incidents.css';

const files = import.meta.glob<string>('../../../docs/incidents/*.md', { query: '?raw', import: 'default', eager: true });
const INCIDENTS = Object.entries(files).map(([p, md]) => parseIncident(p, md)).sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));

export function Incidents() {
  useMeta('Incidents · Quintel', 'Anything that broke, when, and what we did.');
  return (
    <div className="page wrap">
      <div className="page-head"><h1>Incidents.</h1><p>Anything that broke, when, and what we did.</p></div>
      {INCIDENTS.length === 0 ? <Card><EmptyState text="No incidents so far." action={<Button variant="secondary" href="/status">See status</Button>} /></Card> : (
        <div className="incidents">
          {INCIDENTS.map((x) => (
            <Card key={x.slug} as="article" id={x.slug} className="incidents-card">
              <div className="incidents-top"><time className="label" dateTime={x.date}>{etDate(x.date)} ET</time><Pill tone={x.status === 'Resolved' ? 'default' : 'risk'}>{x.status}</Pill></div>
              <h2>{x.title}</h2>
              {x.summary && <p>{x.summary}</p>}
              <Accordion defaultOpen={location.hash.slice(1) === x.slug ? 0 : null} items={[{ q: 'Full report', a: <Markdown tokens={x.body} file={x.file} shift={2} /> }]} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
