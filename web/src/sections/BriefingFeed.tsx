import { useMemo, useRef } from 'react';
import { type Briefing } from '../lib/api';
import { changeLabel, checkLabel, displayBriefing, incidentNote, triggerLabel } from '../lib/briefing';
import { useData } from '../lib/data';
import { feedTime, useFeed, useLiveStatus, useRunsSettled, withLatestRun, type FeedEvent } from '../lib/feed';
import { etDateTime, hash, pts } from '../lib/format';
import { keptChange } from '../lib/metrics';
import { Link } from '../lib/router';
import { Button, Card, Change, CopyButton, Countdown, EmptyState, ErrorState, Pill, Section, Skeleton } from '../components/ui';
import './briefingfeed.css';

/** change in kept odds against the run before (undefined while it loads), plus how the briefing was made */
export function BriefingPills({ b, change }: { b: Briefing; change: number | null | undefined }) {
  const trigger = triggerLabel(b);
  if (change === undefined) return <Skeleton h={28} w="70%" />;
  return (
    <div className="bf-pills">
      {change !== null && <Pill tone={change < 0 && pts(change).startsWith('−') ? 'risk' : 'default'}>{changeLabel(change)}</Pill>}
      <Pill tone="muted">{checkLabel(b)}</Pill>
      {trigger && <Pill tone="muted">{trigger}</Pill>}
    </div>
  );
}

export function IncidentNote({ b }: { b: Briefing }) {
  const text = incidentNote(b);
  return text && <p className="bf-incident note">{text} <Link href="/incidents">See incidents</Link></p>;
}

export function BriefingCard({ b, change, as: H = 'h3' }: { b: Briefing; change: number | null; as?: 'h2' | 'h3' }) {
  const d = useMemo(() => displayBriefing(b), [b]);
  return (
    <Card as="article" className="bf-card">
      <div className="label">{etDateTime(b.ts)}</div>
      <H className="bf-headline">{d.headline}</H>
      <p className="bf-summary">{d.summary}</p>
      <BriefingPills b={b} change={change} />
      <IncidentNote b={b} />
      {d.cardChanged && (
        <div className="bf-hash">
          <p className="note">Shown with current wording. Original hash below.</p>
          <div className="bf-hash-row"><span className="mono">{hash(b.hash)}</span><CopyButton text={b.hash} label="Copy hash" toast="Hash copied" /></div>
        </div>
      )}
      <Button href={`/briefings/${b.id}`} variant="secondary" className="bf-read">Read briefing<span className="vh">: {d.headline}</span></Button>
    </Card>
  );
}

function FeedRow({ e, isNew }: { e: FeedEvent; isNew: boolean }) {
  return (
    <li className={isNew ? 'bf-row bf-new' : 'bf-row'}>
      <Link href={e.href}>
        <span className="bf-meta label"><span>{e.label}</span>{e.change !== null && <Change value={pts(e.change).startsWith('−') ? e.change : 0} text={pts(e.change)} />}<time dateTime={e.ts}>{feedTime(e.ts)}</time></span>
        <span className="bf-text">{e.text}</span>
      </Link>
    </li>
  );
}

const ROWS = 6;
function FeedList() {
  const { reload, reloadBriefings, reloadProof, reloadDesk } = useData();
  const retryAll = () => { reload(); reloadBriefings(); reloadProof(); reloadDesk(); };
  const { events, settled, failed } = useFeed();
  const status = useLiveStatus();
  const base = useRef<Set<string> | null>(null);
  if (settled && !base.current) base.current = new Set(events.map((e) => e.key));
  return (
    <div className="bf-feed">
      <div className="bf-feed-head">
        <h3>Live updates</h3>
        {status === 'offline' && <Pill>Offline · updates paused</Pill>}
        {status === 'reconnecting' && <Pill>Reconnecting…</Pill>}
      </div>
      {!settled ? <ul className="bf-list" aria-hidden="true">{Array.from({ length: ROWS }, (_, i) => <li key={i} className="bf-row bf-ghost"><Skeleton h={16} w="50%" /><Skeleton h={20} w="85%" /></li>)}</ul>
        : failed ? <ErrorState text="Couldn’t load live updates. Try again." onRetry={retryAll} />
        : events.length === 0 ? <EmptyState text="Updates show up here as runs finish." />
        : <ul className="bf-list">{events.slice(0, ROWS).map((e) => <FeedRow key={e.key} e={e} isNew={!base.current?.has(e.key)} />)}</ul>}
    </div>
  );
}

function LatestBriefing() {
  const { latest, runs, briefings: items, briefingsError, reloadBriefings } = useData();
  const settled = useRunsSettled();
  if (items?.length) {
    const b = items[0];
    // wait for the run list so the change pill does not push the card around
    return settled ? <BriefingCard b={b} change={keptChange(withLatestRun(latest, runs), b.run_id)} /> : <CardGhost />;
  }
  if (items) return <Card className="bf-card"><EmptyState text="The first briefing posts after the next run." /></Card>;
  if (briefingsError) return <Card className="bf-card"><ErrorState text="Couldn’t load the latest briefing. Try again." onRetry={reloadBriefings} /></Card>;
  return <CardGhost />;
}
export function CardGhost() {
  return <Card className="bf-card bf-card-ghost"><Skeleton h={16} w="50%" /><Skeleton h={48} /><Skeleton h={76} /><Skeleton h={28} w="70%" /><Skeleton h={48} w={160} /></Card>;
}

export function BriefingFeed() {
  const next = useData().latest?.nextBriefingAt;
  // a time long past says the agent is late, so it is not shown as about to post
  const due = !!next && Date.parse(next) > Date.now() - 900000;
  return (
    <Section id="briefing" title="What changed, in plain English." sub="A research agent reads the news and compares each run with the one before. Code checks that every number comes from the runs or the news, and blocks advice wording, before a briefing posts.">
      <div className="bf-grid">
        <LatestBriefing />
        <FeedList />
      </div>
      <div className="bf-foot">
        <Button href="/briefings" variant="ghost" className="bf-all">All briefings</Button>
        <span className="label">{due ? <>Next briefing in <Countdown to={next} done="a moment" /></> : ' '}</span>
      </div>
    </Section>
  );
}
