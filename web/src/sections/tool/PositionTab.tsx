import { useEffect, useMemo, useState } from 'react';
import type { RunOutput } from '@engine/types';
import { Button, EmptyState, ErrorState, Input, NumberRoll, Skeleton, Stat, useToast } from '../../components/ui';
import { useData } from '../../lib/data';
import { odds, pctChange, usd, usdChange } from '../../lib/format';
import { useStored } from '../../lib/hooks';
import { axisOf, HORIZON_NAMES, landsOn, parseAmount, positionRun, profitOdds, useRunBase, type HorizonKey, type RunBase } from '../../lib/odds';
import { Answer, HorizonTabs, PriceBars, RunNote } from './DragTab';
import { useWatchlist, Watchlist, WATCH_MAX } from './Watchlist';

interface Draft { entry: string; shares: string; h: HorizonKey }
const text = (s: unknown) => (typeof s === 'string' ? s : '').replace(/[^\d.,]/g, '').slice(0, 12);

/** Odds of ending above an entry price. Runs here; the numbers never leave the device. */
export function PositionTab({ symbol, active }: { symbol: string; active: boolean }) {
  const { latest, latestError, reload } = useData();
  const [saved, save] = useStored<Draft>('q-position', { entry: '', shares: '', h: '1' });
  const draft: Draft = { entry: text(saved?.entry), shares: text(saved?.shares), h: saved?.h === '0' || saved?.h === '2' ? saved.h : '1' };
  const entry = parseAmount(draft.entry), shares = parseAmount(draft.shares);
  const entryErr = entry === null ? null : !(entry >= 0.01) ? 'Enter a price above $0.' : entry >= 1e6 ? 'Enter a price below $1,000,000.' : null;
  const sharesErr = shares !== null && !(shares > 0) ? 'Enter a number above 0.' : null;
  const price = entry !== null && !entryErr ? entry : null;

  const { base, error, retry } = useRunBase(active);
  const [res, setRes] = useState<{ out: RunOutput; price: number; base: RunBase } | null>(null);
  const [failed, setFailed] = useState(false);
  const [n, again] = useState(0);
  useEffect(() => {
    setFailed(false);
    if (!base || price === null || !active) return;
    let alive = true;
    const t = setTimeout(() => {
      positionRun(base, price).then((out) => { if (alive) setRes({ out, price, base }); }).catch(() => { if (alive) setFailed(true); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [base, price, active, n]);

  const toast = useToast();
  const { list, add, has } = useWatchlist();
  // a newer run keeps the last answer on screen; a new entry price never shows the old one
  const shown = res && res.price === price ? res : null;
  const i = Number(draft.h), name = HORIZON_NAMES[i];
  const h = shown?.out.combined.horizons[i] ?? null;
  const axis = useMemo(() => (h ? axisOf(h, 5) : null), [h]);
  const p = shown ? profitOdds(shown.out) : null;
  const bad = h && price !== null ? h.pct.p5 / price - 1 : null;
  const inList = price !== null && has(price, draft.h);
  const none = !!latest && !latest.run;
  const noRun = !shown && !base && (error || (latestError && !latest)), noResult = !shown && failed;
  const answering = price !== null && !none && !noRun && !noResult;
  const full = list.length >= WATCH_MAX;

  return (
    <>
      <div className="tool-grid tool-grid-2">
        <div className="tool-side">
          <Input label="Entry price" prefix="$" numeric maxLength={12} value={draft.entry} error={entryErr} onChange={(e) => save({ ...draft, entry: text(e.target.value) })} />
          <Input label="Shares (optional)" numeric maxLength={12} value={draft.shares} error={sharesErr} onChange={(e) => save({ ...draft, shares: text(e.target.value) })} />
          <HorizonTabs value={draft.h} onChange={(v) => save({ ...draft, h: v })} />
          <p className="note">Your numbers stay on this device. Changes are from your entry price, before fees and taxes.</p>
        </div>
        <div className="tool-main" aria-busy={price !== null && !shown}>
          {none ? <EmptyState text="Odds appear after the next run." />
            : price === null ? <EmptyState text="Enter your entry price to see your odds." />
            : noRun ? <ErrorState onRetry={() => { reload(); retry(); }} />
            : noResult ? <ErrorState text="Couldn’t run the futures. Try again." onRetry={() => again((x) => x + 1)} />
            : (
              <>
                <Answer live text={p ? odds(p[i]) : null} label={`odds of profit in ${name}`} />
                <PriceBars h={h} total={shown?.out.totalPaths ?? 1} axis={axis} price={price}
                  label={h && p && axis ? `${symbol} price after ${name}, from ${usd(axis.lo, 0)} to ${usd(axis.hi, 0)}. ${odds(p[i])} of futures end above your entry of ${usd(price)}.` : 'Price distribution, loading'} />
              </>
            )}
        </div>
        {answering && (
          <div className="tool-rows tool-more">
            {HORIZON_NAMES.map((t, k) => (
              <Stat key={t} label={`${t} odds`} note={shown ? `On ${landsOn(shown.base.ts, shown.out.combined.horizons[k].days)}` : ' '}>{p ? <NumberRoll text={odds(p[k])} /> : <Skeleton h="1.2em" w="3.5em" />}</Stat>
            ))}
          </div>
        )}
        {answering && (
          <div className="tool-main tool-rest">
            <div className="tool-bad">
              <div className="label">Bad 5% outcome</div>
              <p>{shown && h && bad !== null
                ? <>In the worst 5% of futures, the price is <span className="mono">{usd(h.pct.p5)}</span> or lower by {landsOn(shown.base.ts, h.days)} <span className="tool-nb">(<span className="mono">{pctChange(bad)}</span>)</span>{shares !== null && !sharesErr && <> <span className="tool-nb">(<span className="mono">{usdChange((h.pct.p5 - shown.price) * shares, 0)}</span>)</span></>}.</>
                : <Skeleton h="3em" />}</p>
            </div>
            <RunNote futures="100,000" id={shown?.base.id ?? null} ts={shown?.base.ts ?? null} />
            <div className="tool-save">
              <Button variant="secondary" disabled={!shown || inList || full} onClick={() => { if (price !== null) { add(price, draft.h); toast({ text: 'Saved to watchlist' }); } }}>{inList ? 'Saved' : 'Save to watchlist'}</Button>
              {full && !inList && <p className="note">You can save up to {WATCH_MAX}. Remove one to add another.</p>}
            </div>
          </div>
        )}
      </div>
      <Watchlist base={base} active={active} note={!answering && !none} none={none} lost={!base && (error || (latestError && !latest))} onRetry={() => { reload(); retry(); }} />
    </>
  );
}
