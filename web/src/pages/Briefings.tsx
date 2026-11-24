import { useCallback, useMemo, useState } from 'react';
import type { RunOutput } from '@engine/types';
import { useApi, type Briefing, type Loaded } from '../lib/api';
import { checkNote, displayBriefing, mergeBriefings } from '../lib/briefing';
import { useData } from '../lib/data';
import { useRunsSettled, withLatestRun } from '../lib/feed';
import { etDateTime, odds, usd } from '../lib/format';
import { useMeta } from '../lib/meta';
import { isIncidentRun, keptChange } from '../lib/metrics';
import { Link } from '../lib/router';
import { Button, Card, CodeBlock, EmptyState, ErrorState, Pill, Skeleton } from '../components/ui';
import { PixelBars } from '../components/pixel';
import { BriefingCard, BriefingPills, CardGhost, IncidentNote } from '../sections/BriefingFeed';
import { NotFound } from './NotFound';
import './briefings.css';

const PAGE = 20;
type Output = { id: number; output: RunOutput };

export function Briefings({ id }: { id: number | null }) {
  const { briefings, online } = useData();
  const archive = useApi<Briefing[]>('/api/briefings?limit=100', 120000);
  const items = useMemo(() => mergeBriefings(archive.data, briefings), [archive.data, briefings]);
  if (id === null) return <List items={items} failed={archive.error && !items} stale={!online} retry={archive.reload} />;
  const i = items?.findIndex((b) => b.id === id) ?? -1;
  if (items && i >= 0) return <Article key={id} b={items[i]} older={items[i + 1]} newer={items[i - 1]} />;
  if (!archive.data) return <Waiting failed={archive.error} retry={archive.reload} />;
  return <NotFound />;
}

function List({ items, failed, stale, retry }: { items: Briefing[] | null; failed: boolean; stale: boolean; retry: () => void }) {
  useMeta('Briefings · Quintel', 'What changed in the odds, and why, in plain English.');
  const { latest, runs } = useData();
  const all = useMemo(() => withLatestRun(latest, runs), [latest, runs]);
  const settled = useRunsSettled();
  const [n, setN] = useState(PAGE);
  return (
    <div className="page wrap">
      <div className="page-head">
        <h1>Briefings.</h1>
        <p>What changed in the odds, and why, in plain English.</p>
        {stale && <Pill>Offline · updates paused</Pill>}
      </div>
      {failed ? <Card><ErrorState text="Couldn’t load the briefings. Try again." onRetry={retry} /></Card>
        : !items || (items.length > 0 && !settled) ? <div className="brf-grid">{Array.from({ length: 4 }, (_, k) => <CardGhost key={k} />)}</div>
        : items.length === 0 ? <Card><EmptyState text="The first briefing posts after the next run." action={<Button href="/" variant="secondary">Back to home</Button>} /></Card>
        : (
          <>
            <div className="brf-grid">{items.slice(0, n).map((b) => <BriefingCard key={b.id} as="h2" b={b} change={keptChange(all, b.run_id)} />)}</div>
            {items.length > n && <div className="brf-more"><Button variant="secondary" onClick={() => setN(n + PAGE)}>Show more</Button></div>}
          </>
        )}
    </div>
  );
}

function Waiting({ failed, retry }: { failed: boolean; retry: () => void }) {
  useMeta('Briefing · Quintel', 'What changed in the odds, and why, in plain English.');
  return (
    <div className="page wrap">
      <div className="brf-article">
        {failed ? <Card><ErrorState text="Couldn’t load this briefing. Try again." onRetry={retry} /></Card>
          : <><Skeleton h={18} w="50%" /><Skeleton h={96} /><Skeleton h={28} w="70%" /><Skeleton h={344} /><Skeleton h={144} /><Skeleton h={144} /></>}
      </div>
    </div>
  );
}

/** Change in kept odds: from the last day of runs, or from the two stored outputs when the run is older. Undefined while it loads. */
function useChange(b: Briefing, out: Loaded<Output>): number | null | undefined {
  const { latest, runs } = useData();
  const settled = useRunsSettled();
  const listed = keptChange(withLatestRun(latest, runs), b.run_id);
  let prev = b.run_id - 1;
  while (isIncidentRun(prev)) prev--;
  const touch = out.data?.output.touch;
  const need = settled && listed === null && !isIncidentRun(b.run_id) && prev > 0;
  const before = useApi<Output>(need && touch ? `/api/output/${prev}` : null);
  if (listed !== null) return listed;
  if (!settled || (need && !out.data && !out.error) || (need && touch && !before.data && !before.error)) return undefined;
  const was = before.data?.output.touch;
  return need && touch && was ? was.giveBack.p - touch.giveBack.p : null;
}

function Article({ b, older, newer }: { b: Briefing; older?: Briefing; newer?: Briefing }) {
  const d = useMemo(() => displayBriefing(b), [b]);
  useMeta(`${d.headline} · Quintel`, d.summary || d.headline);
  const out = useApi<Output>(`/api/output/${b.run_id}`);
  const change = useChange(b, out);
  return (
    <div className="page wrap">
      <article className="brf-article">
        <header className="brf-head">
          <div className="label"><Link href="/briefings" className="brf-back">Briefings</Link> · <time dateTime={b.ts}>{etDateTime(b.ts)}</time></div>
          <h1>{d.headline}</h1>
          <BriefingPills b={b} change={change} />
          <IncidentNote b={b} />
        </header>
        <Chart b={b} out={out.data?.output ?? null} missing={out.status === 404} failed={out.error && !out.data} retry={out.reload} />
        <div className="brf-body">
          {d.summary && <p>{d.summary}</p>}
          <Bullets title="What changed" items={d.whatChanged} />
          <Bullets title="Key risks" items={d.keyRisks} />
          <Bullets title="Watch next" items={d.watchNext} />
          {d.sources.length > 0 && (
            <section>
              <h2>Sources</h2>
              <ul className="brf-sources">{d.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a></li>)}</ul>
            </section>
          )}
        </div>
        <footer className="brf-proof">
          <p className="note">{checkNote(b)}</p>
          {d.changed && <p className="note">Shown with current wording. Original hash below.</p>}
          <div className="label">Briefing hash, run {b.run_id}</div>
          <CodeBlock code={b.hash} />
          <Button href={`/verify?run=${b.run_id}`} variant="secondary" className="brf-verify">Verify run {b.run_id}</Button>
        </footer>
        <nav className="brf-nav" aria-label="More briefings">
          {older && <Near b={older} label="Previous" />}
          {newer && <Near b={newer} label="Next" />}
        </nav>
      </article>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <section><h2>{title}</h2><ul className="brf-list">{items.map((t, i) => <li key={i}>{t}</li>)}</ul></section>;
}

function Near({ b, label }: { b: Briefing; label: string }) {
  const d = useMemo(() => displayBriefing(b), [b]);
  return <Link href={`/briefings/${b.id}`} className={`brf-near card-link${label === 'Next' ? ' brf-next' : ''}`}><span className="label">{label} · {etDateTime(b.ts)}</span><span>{d.headline}</span></Link>;
}

/** The run's 1 week distribution, as published with the run. */
function Chart({ b, out, missing, failed, retry }: { b: Briefing; out: RunOutput | null; missing: boolean; failed: boolean; retry: () => void }) {
  const k = out ? out.horizons.indexOf(5) : -1;
  const hist = out && k >= 0 ? out.combined.horizons[k]?.hist : undefined;
  const up = out && k >= 0 ? out.combined.probs[k]?.pUp : undefined;
  const spot = out?.spot ?? null;
  const lo = hist?.lo ?? 0, step = hist ? (hist.hi - hist.lo) / hist.counts.length : 1;
  const risk = useCallback((i: number) => spot !== null && lo + (i + 0.5) * step < spot, [spot, lo, step]);
  if (!hist || spot === null) {
    return (
      <Card className="brf-chart">
        {missing || out ? <EmptyState text={`The 1 week chart for run ${b.run_id} isn’t available.`} /> : failed ? <ErrorState text="Couldn’t load the run’s chart. Try again." onRetry={retry} /> : <Skeleton h="100%" className="brf-chart-ghost" />}
      </Card>
    );
  }
  return (
    <Card as="figure" className="brf-chart">
      <div className="label">1 week after run {b.run_id}</div>
      <PixelBars values={hist.counts} risk={risk} height={144} label={`Where 1,000,000 futures end 1 week after run ${b.run_id}. ${odds(up)} end above the start price of ${usd(spot)}.`} />
      <div className="brf-axis label"><span>{usd(hist.lo)}</span><span>{usd(hist.hi)}</span></div>
      <figcaption className="note">{odds(up)} of futures end the week above the {usd(spot)} start price. Red columns end below it, ink columns at or above it. The end columns hold everything beyond them.</figcaption>
    </Card>
  );
}
