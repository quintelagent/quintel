import type { ReactNode } from 'react';
import { FEATURES, type Feature, type FeatureStatus } from '../features';
import type { Latest, Proof } from '../lib/api';
import { useData } from '../lib/data';
import { ago, etDateTime, etShortDate, etTime, int } from '../lib/format';
import { useNow } from '../lib/hooks';
import { isDelayed, marketState } from '../lib/marketState';
import { useMeta } from '../lib/meta';
import { Button, Card, ErrorState, Pill, Skeleton } from '../components/ui';
import './status.css';

type Health = 'OK' | 'Delayed' | 'Down';
interface Row { value: ReactNode; health: Health | null; note: string }
const MIN = 60000, HOUR = 60 * MIN;
const ageOf = (ts: string, now: Date) => now.getTime() - new Date(ts).getTime();
/** the date is added once the time alone could mean another day */
const when = (ts: string, now: Date) => (ageOf(ts, now) > 12 * HOUR ? etDateTime(ts) : etTime(ts));

function runRow({ run }: Latest, now: Date): Row {
  if (!run) return { value: 'No runs yet', health: null, note: 'The first run shows here.' };
  const health = ageOf(run.ts, now) > 3 * HOUR ? 'Down' : isDelayed(run.ts, now) ? 'Delayed' : 'OK';
  return { value: when(run.ts, now), health, note: `Run ${run.id}, ${ago(run.ts, now.getTime())}` };
}

function proofRow(proof: Proof, now: Date): Row {
  const sent = proof.fingerprints.filter((f) => f.status === 'sent' && f.sent_at).map((f) => f.sent_at!).sort().pop();
  const waiting = proof.pending ? `${int(proof.pending)} ${proof.pending === 1 ? 'fingerprint' : 'fingerprints'} waiting` : 'Nothing waiting';
  if (!sent) return { value: 'None posted yet', health: proof.pending ? 'Delayed' : null, note: waiting };
  return { value: when(sent, now), health: ageOf(sent, now) > 2 * HOUR ? 'Delayed' : 'OK', note: waiting };
}

/** The exchange is judged only while it is open. A run that had to skip a source counts against that source. */
function priceRow({ run, prices }: Latest, now: Date): Row {
  const open = marketState(now).open;
  const fresh = (p: { ts: string } | null, min: number) => !!p && ageOf(p.ts, now) <= min * MIN;
  const exchange = !open ? 'Closed' : fresh(prices.stock, 20) && !(run?.session === 'open' && run.price_source !== 'stock') ? 'OK' : 'Delayed';
  const token = fresh(prices.chain, 30) && !(run?.session === 'closed' && run.price_source === 'last_close') ? 'OK' : 'Delayed';
  const word = (w: string) => (w === 'OK' ? w : w.toLowerCase());
  const at = (p: { ts: string } | null) => (p ? when(p.ts, now) : 'none yet');
  const s = at(prices.stock), c = at(prices.chain);
  return { value: <div className="status-feeds"><span>Exchange {word(exchange)}</span><span>Token {word(token)}</span></div>, health: exchange === 'Delayed' || token === 'Delayed' ? 'Delayed' : 'OK', note: s === c ? `Last quotes: ${s}` : `Last quotes: exchange ${s} and token ${c}` };
}

function HealthRow({ label, row }: { label: string; row: Row | null }) {
  return (
    <div className="status-health-row">
      <dt className="label">{label}</dt>
      <dd>
        {row ? <><div className="status-health-v mono">{row.value}</div><p className="note">{row.note}</p></> : <Skeleton h={48} />}
        {row?.health && <div className="status-health-p"><Pill tone={row.health === 'Down' ? 'risk' : 'default'}>{row.health}</Pill></div>}
      </dd>
    </div>
  );
}

/** A feature's registry status as a pill. No date until the registry has one. */
function FeaturePill({ feature: f }: { feature: Feature }) {
  if (f.status === 'live') return <span className="paused"><Pill tone="invert" live>Live</Pill></span>;
  if (f.status === 'planned') return <Pill tone="muted">Planned</Pill>;
  return <Pill>{f.releaseAt ? `Soon · ${etShortDate(f.releaseAt)}, ${etTime(f.releaseAt)}` : 'Soon'}</Pill>;
}

const GROUPS: { status: FeatureStatus; title: string }[] = [{ status: 'live', title: 'Live' }, { status: 'soon', title: 'Soon' }, { status: 'planned', title: 'Planned' }];

export function Status() {
  useMeta('Status · Quintel', 'What’s live, what’s next, and how the system is running.');
  const { latest, latestError, reload, proof, proofError } = useData();
  const now = useNow(30000);
  const proofLoaded: Row | null = proof ? proofRow(proof, now) : proofError ? { value: 'Unavailable', health: null, note: 'Couldn’t load fingerprints. Checking again within a minute.' } : null;
  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head"><h1>Status.</h1><p>What’s live, what’s next, and how the system is running.</p></header>
        <Card as="section" aria-label="Health" className="status-health">
          {!latest && latestError ? <ErrorState text="Status is unavailable right now. Try again." onRetry={reload} /> : (
            <dl>
              <HealthRow label="Last run" row={latest && runRow(latest, now)} />
              <HealthRow label="Last fingerprint" row={latest && proofLoaded} />
              <HealthRow label="Price feeds" row={latest && priceRow(latest, now)} />
            </dl>
          )}
        </Card>
        <div className="status-groups">
          {GROUPS.map((g) => {
            const list = FEATURES.filter((f) => f.status === g.status);
            return list.length > 0 && (
              <section key={g.status} aria-labelledby={`status-${g.status}`}>
                <h2 id={`status-${g.status}`}>{g.title}</h2>
                <ul>
                  {list.map((f) => (
                    <li key={f.id} className="status-row">
                      <div>
                        <h3>{f.name}</h3>
                        <p>{f.oneLine}</p>
                      </div>
                      <FeaturePill feature={f} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="row"><Button variant="secondary" href="/changelog">Changelog</Button><Button variant="secondary" href="/incidents">Incidents</Button></div>
      </div>
    </div>
  );
}
