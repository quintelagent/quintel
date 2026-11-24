import { useState } from 'react';
import { Info, Pause, Play } from 'lucide-react';
import { prevTradingDay } from '../../../worker/src/session';
import { Button, Countdown, EmptyState, ErrorState, NumberRoll, Pill, Sheet, Skeleton, Stat, Tile } from '../components/ui';
import { PixelField, PixelMeter } from '../components/pixel';
import type { RunRow } from '../lib/api';
import { useData } from '../lib/data';
import { ago, etShortDate, etTime, int, odds, usd } from '../lib/format';
import { useLaptop, useNow } from '../lib/hooks';
import { cadenceMin, isDelayed, marketState } from '../lib/marketState';
import { backAboveOf, keptOf } from '../lib/metrics';
import { futuresPerPixel } from '../lib/pixelGrid';
import { Link } from '../lib/router';
import { stressLabel } from '../lib/stress';
import { DEFAULT_SYMBOL, symbolConfig } from '../lib/symbols';
import './hero.css';

/* Clocks live in these small leaves so the hero itself only renders on new data. */
function Eyebrow({ run, failed }: { run: RunRow | null; failed: boolean }) {
  const now = useNow(15000);
  const label = marketState(now).label;
  if (run && (failed || isDelayed(run.ts, now))) return <Pill>Delayed · last run {etTime(run.ts)}</Pill>;
  return <span className="label">{run ? `${label} · run ${int(run.id)} · ${etTime(run.ts)}` : label}</span>;
}

function Sub() {
  const now = useNow(30000);
  const { open } = marketState(now);
  return <>1,000,000 futures, every {cadenceMin(now)} minutes{open ? '.' : <> <span className="hero-phrase">while the market is closed.</span></>}</>;
}

/* The API moves nextRunAt on by the clock alone, so a slot stays due until a run at or after it lands. */
const MIN = 60000;
function NextRun({ at, ts }: { at: string; ts: string }) {
  const now = useNow(1000).getTime();
  const next = new Date(at).getTime(), ran = new Date(ts).getTime();
  const step = (slot: number) => cadenceMin(new Date(slot - MIN)) * MIN;
  const due = now >= next ? next : next - step(next);
  if (now < next && ran >= due - MIN) return <span>Next run in <Countdown to={at} /></span>;
  return <span>{now - ran - step(due) < 5 * MIN ? 'Run in progress' : 'Next run delayed'}</span>;
}

function Updated({ ts }: { ts: string }) {
  const now = useNow(15000);
  return <span>updated {ago(ts, now.getTime())}</span>;
}

function Meaning({ run, gainName, open, onClose }: { run: RunRow | null; gainName: string; open: boolean; onClose: () => void }) {
  const e = run?.summary.event, t = run?.summary.touch;
  const days = t?.giveBack.days ?? 5;
  return (
    <Sheet open={open} onClose={onClose} title={`What “${gainName} kept” means`}>
      <p>The share of all 1,000,000 futures that keep at least half of the {e ? `${etShortDate(e.date)} gain` : 'gain'} for a week.</p>
      <p>
        A future keeps it when no daily close over the next {days} trading days is at or below{' '}
        {e ? <><span className="mono">{usd(t?.giveBack.level ?? e.halfBack)}</span>, the halfway price between the {etShortDate(prevTradingDay(e.date))} close (<span className="mono">{usd(e.prevClose)}</span>) and the {etShortDate(e.date)} close (<span className="mono">{usd(e.close)}</span>).</> : 'the halfway price of that gain.'}
      </p>
      <p>Intraday moves are not counted, and the {days}‑day window starts from each run.</p>
      <p className="note">Scenario odds, not predictions. Not financial advice.</p>
      <Link href="/docs/methodology" onClick={onClose} className="hero-more">Read the methodology</Link>
    </Sheet>
  );
}

export function Hero({ symbol = DEFAULT_SYMBOL }: { symbol?: string }) {
  const { latest, latestError, online, reload } = useData();
  const [info, setInfo] = useState(false);
  const [paused, setPaused] = useState(false);
  const laptop = useLaptop();
  const { headline, gainName } = symbolConfig(symbol);

  const run = latest?.run ?? null;
  const s = run?.summary ?? null;
  const kept = keptOf(s), back = backAboveOf(s);
  const [settled, setSettled] = useState<number | null>(null); // the big number follows the grid
  const failed = latestError && online;
  const none = !run && (latestError || !!latest); // nothing to show yet, and not still loading
  const stress = run?.stress ?? null;
  const lines = headline(s?.event?.pct ?? null).split('. '); // one sentence per line

  return (
    <section id="hero" className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="hero-eyebrow"><Eyebrow run={run} failed={failed} /></div>
          <h1 id="hero-title">{lines.map((t, i) => <span key={i}>{t}{i < lines.length - 1 && '. '}</span>)}</h1>
          <p className="muted"><Sub /></p>
        </div>

        <figure className="hero-field">
          <PixelField kept={none ? null : kept} seed={run?.id} paused={paused} onSettled={setSettled} label={none ? 'Scenario grid, no run loaded' : run && kept === null ? 'Scenario grid, no odds in this run' : undefined} />
          <figcaption className="small">
            <span>1 filled pixel ≈ {futuresPerPixel(laptop ? 100 : 64)} futures</span>
            <span className="hero-key">
              <span><i className="hero-kept" aria-hidden="true" />kept</span><span><i className="fall" aria-hidden="true" />lost</span>
              <button type="button" className="icon-btn hero-pause" style={kept === null ? { visibility: 'hidden' } : undefined} aria-label={paused ? 'Play the pixel grid' : 'Pause the pixel grid'} onClick={() => setPaused(!paused)}>{paused ? <Play size={16} strokeWidth={1.5} aria-hidden="true" /> : <Pause size={16} strokeWidth={1.5} aria-hidden="true" />}</button>
            </span>
          </figcaption>
        </figure>

        <div className="hero-data">
          {none ? (
            <div className="hero-none">
              {latestError ? <ErrorState onRetry={reload} /> : <EmptyState text="No run has landed yet. Try again in a few minutes." action={<Button variant="secondary" onClick={reload}>Try again</Button>} />}
            </div>
          ) : (
            <>
              <div className="hero-odds">
                <div className="big hero-num">{run ? <NumberRoll text={odds(kept === null ? null : settled ?? kept)} /> : <Skeleton h="1.1em" w="2.8em" />}</div>
                <div className="hero-label">
                  <p>of futures keep at least half of {gainName} for a week {run && kept === null && <span className="note hero-missing">Not in this run.</span>}</p>
                  <button type="button" className="icon-btn" aria-label={`What “${gainName} kept” means`} aria-haspopup="dialog" onClick={() => setInfo(true)}><Info size={20} strokeWidth={1.5} aria-hidden="true" /></button>
                </div>
              </div>
              <div className="hero-tiles">
                <Tile>
                  <Stat label="Stress Level" note={<PixelMeter value={stress === null ? null : stress / 100} riskFrom={0.67} label={stress === null ? 'Stress Level, loading' : `Stress Level ${stress} of 100, ${stressLabel(stress)}`} />}>
                    {stress === null ? <Skeleton h="1.2em" w="5em" /> : <><NumberRoll text={int(stress)} /> · {stressLabel(stress)}</>}
                  </Stat>
                </Tile>
                <Tile>
                  <Stat label={run ? `Back above ${back ? usd(back.level) : 'the set level'} within 1\u00a0month` : <>Back above <Skeleton h="1em" w="7ch" className="hero-inline" /> within 1&nbsp;month</>} note="any daily close">
                    {run ? <NumberRoll text={odds(back?.p)} /> : <Skeleton h="1.2em" w="3em" />}
                  </Stat>
                </Tile>
              </div>
              <div className="label hero-next">{latest && run && <><NextRun at={latest.nextRunAt} ts={run.ts} /><span aria-hidden="true">·</span><Updated ts={run.ts} /></>}</div>
            </>
          )}
          <div className="hero-cta">
            <Button href="/#position">Check my position</Button>
            <Button href="/#proof" variant="secondary">How it works</Button>
          </div>
          <p className="small">Scenario odds, not predictions. Not financial advice.</p>
        </div>
      </div>
      <p className="vh" role="status">{run && kept !== null ? `Run ${run.id}: ${odds(kept)} of futures keep at least half of ${gainName} for a week.` : ''}</p>
      <Meaning run={run} gainName={gainName} open={info} onClose={() => setInfo(false)} />
    </section>
  );
}
