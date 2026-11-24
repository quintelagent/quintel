import { useMemo, useRef, useState } from 'react';
import { closeMinute, lastCloseDate } from '../../../worker/src/session';
import type { Latest, RunRow } from '../lib/api';
import { useData } from '../lib/data';
import { etDate, etDay, etTime, pctChange, usd, usdChange } from '../lib/format';
import { useInView, useNow } from '../lib/hooks';
import { etToUtc, marketState, type MarketState } from '../lib/marketState';
import { isIncidentRun } from '../lib/metrics';
import { DEFAULT_SYMBOL, symbolConfig } from '../lib/symbols';
import { PixelSpark } from '../components/pixel/PixelSpark';
import { Button, Card, Countdown, EmptyState, ErrorState, NumberRoll, Pill, Section, Skeleton, Stat } from '../components/ui';
import './wallstreet.css';

interface Quote { price: number; label: string; delayed: boolean }
const MIN = 60000;
/** the time alone today, with the weekday otherwise */
const when = (ts: string, now: Date) => (etDate(ts) === etDate(now) ? etTime(ts) : `${etDay(ts)} ${etTime(ts)}`);
const cents = (x: number) => Math.round(x * 100) / 100;

/** Last exchange price while open; the official close while closed (once a run has stored it). */
function exchangeQuote(latest: Latest, open: boolean, now: Date): Quote | null {
  const { run, prices } = latest;
  const c = run?.summary.lastClose, sp = run?.summary.stockPrice ?? null;
  // a run whose history missed the last session stores the quote (or an older close) as lastClose, so it is not called the close
  if (!open && run && run.session === 'closed' && !isIncidentRun(run.id) && Number.isFinite(c) && sp !== null && c !== sp) {
    const date = lastCloseDate(now), cm = closeMinute(date), at = etToUtc(date, Math.floor(cm / 60), cm % 60);
    if (new Date(run.ts) >= at) return { price: c!, label: `Close · ${etDay(at)} ${etTime(at)}`, delayed: false };
  }
  const s = prices.stock;
  if (!s) return null;
  return { price: s.price, label: `Last price · as of ${when(s.ts, now)}`, delayed: open && now.getTime() - new Date(s.ts).getTime() > 20 * MIN };
}

/** The newest token price, or the last one a run stored if the feed has none. */
function tokenQuote(latest: Latest, runs: RunRow[] | null, now: Date): (Quote & { ts: string }) | null {
  const stored = runs?.find((r) => r.summary.chainPrice !== null);
  const q = latest.prices.chain ?? (stored ? { ts: stored.ts, price: stored.summary.chainPrice! } : null);
  if (!q) return null;
  const delayed = !latest.prices.chain || now.getTime() - new Date(q.ts).getTime() > 45 * MIN;
  return { price: q.price, ts: q.ts, label: `Token price · as of ${when(q.ts, now)}`, delayed };
}

/** Token prices the last 24 hours of runs stored, evenly spaced in time: runs are 10 min apart while open and 30 while closed. */
function tokenSpark(runs: RunRow[] | null): number[] | null {
  const from = Date.now() - 24 * 60 * MIN;
  const pts = (runs ?? []).map((r) => ({ t: new Date(r.ts).getTime(), v: r.summary.chainPrice as number })).filter((p) => Number.isFinite(p.v) && p.t >= from).reverse();
  if (pts.length < 2) return null;
  const a = pts[0].t, b = pts[pts.length - 1].t, n = 145;
  let k = 0;
  return Array.from({ length: n }, (_, i) => { while (k + 1 < pts.length && pts[k + 1].t <= a + ((b - a) * i) / (n - 1)) k++; return pts[k].v; });
}

const statusText = (m: MarketState) =>
  m.open ? (m.kind === 'half-day' && m.nextClose ? `Half day · closes ${etTime(m.nextClose)}` : 'Open') : `Closed · opens ${etDay(m.nextOpen)} ${etTime(m.nextOpen)}`;

export function WallStreet({ symbol = DEFAULT_SYMBOL }: { symbol?: string }) {
  const { latest, latestError, reload, runs, online } = useData();
  const now = useNow(30000);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const [paused, setPaused] = useState(false);
  const m = marketState(now);
  const name = symbolConfig(symbol).symbol;

  const spark = useMemo(() => tokenSpark(runs), [runs]);
  const sparkLabel = spark ? `${name} token price over the last 24 hours, between ${usd(Math.min(...spark))} and ${usd(Math.max(...spark))}` : 'Token price over the last 24 hours, not available yet';

  const stock = latest && exchangeQuote(latest, m.open, now);
  const token = latest && tokenQuote(latest, runs, now);
  const head = { id: 'chain', title: 'Wall Street closes. The chain doesn’t.', sub: 'The stock on the exchange next to the token on Robinhood Chain.' };

  const state = !latest && latestError ? <ErrorState text="Couldn’t load the latest prices. Try again." onRetry={reload} />
    : latest && !latest.run && !stock && !token ? <EmptyState text="Prices appear here after the first run." /> : null;

  // a run that had a token price but no gap refused that price (docs/METHODOLOGY.md)
  const run = latest?.run;
  const refused = !!run && !isIncidentRun(run.id) && run.summary.chainPrice !== null && run.summary.gap === null;
  const ok = !!stock && !!token && !stock.delayed && !token.delayed && !refused;
  const diff = ok ? cents(token.price) - cents(stock.price) : null;
  const gap = ok ? diff! / cents(stock.price) : null;
  const live = !!token && !token.delayed && online;

  return (
    <Section {...head}>
      <div ref={box} className={paused || !inView ? 'paused' : undefined}>
        {state ? <Card>{state}</Card> : (
          <>
          <div className="ws">
            <Card as="article" className={m.open ? 'ws-card ws-wall' : 'ws-card ws-wall muted'}>
              <h3>Wall Street</h3>
              <div className="row">
                <Pill tone={m.open ? 'default' : 'muted'}>{statusText(m)}</Pill>
                {stock?.delayed && <Pill>Delayed</Pill>}
              </div>
              <Price latest={latest} q={stock} empty="Exchange price unavailable" />
              <div className="ws-foot">
                <Stat label={m.open ? 'Closes in' : 'Opens in'}><Countdown to={m.open && m.nextClose ? m.nextClose : m.nextOpen} /></Stat>
              </div>
            </Card>

            <div className="ws-gap mono" role="group" aria-label="Gap">
              {!latest ? <Skeleton h={48} w={240} /> : gap === null || diff === null ? <span className="label">Gap unavailable</span> : (
                <>
                  <span className="label">Gap</span>
                  <span className={gap < 0 ? 'ws-gap-v ws-down' : 'ws-gap-v'}>
                    <NumberRoll text={pctChange(gap)} /><span className="ws-dot" aria-hidden="true">·</span>
                    <span className="ws-usd">{gap < 0 && <i className="fall" aria-hidden="true" />}<NumberRoll text={usdChange(diff)} /></span>
                  </span>
                </>
              )}
            </div>

            {!m.open && <div className="ws-badge"><Pill tone="invert">24/7 chain mode</Pill></div>}

            <Card as="article" className="ws-card ws-chain">
              <h3>On chain</h3>
              <div className="row">
                {!latest ? <Skeleton className="ws-pill-skel" h={28} w={72} />
                  : !online ? <Pill>Offline · updates paused</Pill>
                  : !token ? <Pill>Token price delayed</Pill>
                  : token.delayed ? <Pill>Token price delayed · {when(token.ts, now)}</Pill>
                  : <Pill tone="invert" live>Live</Pill>}
              </div>
              <Price latest={latest} q={token} empty="Token price unavailable" />
              <div className="ws-foot ws-spark">
                <span className="label">Token price · last 24h</span>
                <PixelSpark values={spark} height={48} label={sparkLabel} />
              </div>
            </Card>
          </div>
          <div className="ws-note">
            <p className="note">The gap is the difference between the last exchange price and the live token price.</p>
            {live && <Button variant="ghost" className="ws-pause" aria-label={paused ? 'Play the live dot' : 'Pause the live dot'} onClick={() => setPaused(!paused)}>{paused ? 'Play' : 'Pause'}</Button>}
          </div>
          </>
        )}
      </div>
    </Section>
  );
}

function Price({ latest, q, empty }: { latest: Latest | null; q: Quote | null; empty: string }) {
  if (!latest) return <div className="ws-price"><div className="big ws-v"><Skeleton h="1.1em" w="4em" /></div><div className="label"><Skeleton h="1.4em" w="60%" /></div></div>;
  if (!q) return <div className="ws-price"><div className="ws-v ws-none">{empty}</div><div className="label">Shown again when the feed returns</div></div>;
  return <div className="ws-price"><div className="big ws-v"><NumberRoll text={usd(q.price)} /></div><div className="label">{q.label}</div></div>;
}
