import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HorizonStats } from '@engine/types';
import { EmptyState, ErrorState, NumberRoll, Pill, SegmentedTabs, Skeleton, Slider, Stat } from '../../components/ui';
import { PixelBars } from '../../components/pixel';
import { useData } from '../../lib/data';
import { etTime, int, odds, usd } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { isDelayed } from '../../lib/marketState';
import { axisOf, barsOn, cdfFromHist, HORIZON_NAMES, HORIZON_TABS, landsOn, type Axis, type HorizonKey } from '../../lib/odds';

/** The answer: one big number and what it means. `text` null shows its skeleton in the same size. `live` announces a new answer. */
export function Answer({ text, label, live }: { text: string | null; label: ReactNode; live?: boolean }) {
  return (
    <div className="tool-answer" aria-live={live ? 'polite' : undefined} aria-atomic={live}>
      <div className="big">{text === null ? <Skeleton h="1.1em" w="3em" /> : <NumberRoll text={text} />}</div>
      <p className="label">{text === null ? <Skeleton h="1.4em" w="16em" /> : label}</p>
    </div>
  );
}

const COLS = 60;
/** The combined distribution at one horizon; columns below `price` are marked, with a line at `price`. */
export function PriceBars({ h, total, axis, price, label }: { h: HorizonStats | null; total: number; axis: Axis | null; price: number | null; label: string }) {
  const lo = axis?.lo ?? 0, hi = axis?.hi ?? 1;
  const values = useMemo(() => (h && axis ? barsOn(h, total, { lo, hi }, COLS) : null), [h, total, lo, hi]); // eslint-disable-line
  const at = price === null ? null : (price - lo) / (hi - lo);
  const risk = useCallback((i: number) => at !== null && (i + 0.5) / COLS < at, [at]);
  return (
    <figure className="tool-bars">
      <PixelBars values={values} risk={risk} marker={at === null || !values || at < 0 || at > 1 ? null : at} label={label} height={160} />
      <figcaption className="label"><span>{values ? usd(lo, 0) : ' '}</span><span>{values && 'Price'}</span><span>{values ? usd(hi, 0) : ''}</span></figcaption>
    </figure>
  );
}

/** Which run the numbers come from, with the Delayed pill when it is late. */
export function RunNote({ futures, id, ts, children }: { futures: string; id: number | null; ts: string | null; children?: ReactNode }) {
  const now = useNow(30000);
  if (id === null || !ts) return <p className="note tool-run"><Skeleton h="1.5em" w="20em" /></p>;
  return (
    <div className="tool-run">
      {isDelayed(ts, now) && <Pill>Delayed · last run {etTime(ts)}</Pill>}
      <p className="note">{futures} futures from run {int(id)} · {etTime(ts)}. {children ?? 'Scenario odds, not advice.'}</p>
    </div>
  );
}

export const HorizonTabs = ({ value, onChange }: { value: HorizonKey; onChange: (h: HorizonKey) => void }) => (
  <div className="field"><div className="label">Horizon</div><SegmentedTabs items={HORIZON_TABS} value={value} onChange={onChange} label="Horizon" /></div>
);

/** The full output can lag the latest run by a moment: find the time of the run it belongs to. */
export function useOutputRun() {
  const { latest, output, outputRunId, outputError, latestError, reload, reloadOutput, runs } = useData();
  const run = latest?.run?.id === outputRunId ? latest?.run : runs?.find((r) => r.id === outputRunId);
  const known = useRef<{ id: number; ts: string } | null>(null);
  if (run) known.current = { id: run.id, ts: run.ts };
  const ts = known.current?.id === outputRunId ? known.current?.ts ?? null : outputRunId === null ? latest?.run?.ts ?? null : null;
  return { output, id: outputRunId, ts, summary: latest?.run?.summary ?? null, failed: !output && (outputError || (latestError && !latest)), none: !!latest && !latest.run, retry: () => { reload(); reloadOutput(); } };
}

export function DragTab({ symbol }: { symbol: string }) {
  const { output, id, ts, failed, none, retry } = useOutputRun();
  const [picked, setPrice] = useState<number | null>(null);
  const [hk, setH] = useState<HorizonKey>('2');
  useEffect(() => { if (output && picked === null) setPrice(Math.round(output.spot * 0.9)); }, [output, picked]);

  // one price range for all three horizons, so the line never jumps when the horizon changes
  const axis = useMemo(() => (output ? axisOf(output.combined.horizons[2], 10) : null), [output]);
  // a newer run can move the range: keep the slider, the line and the odds on the same price
  const price = axis && picked !== null ? Math.max(axis.lo, Math.min(axis.hi, picked)) : null;
  const below = useMemo(() => (output && price !== null ? output.combined.horizons.map((h) => cdfFromHist(h, price, output.totalPaths)) : null), [output, price]);
  if (failed) return <ErrorState onRetry={retry} />;
  if (none) return <EmptyState text="Odds appear after the next run." />;

  const i = Number(hk), name = HORIZON_NAMES[i];
  const ready = output && axis && price !== null && below ? { output, axis, price, below } : null;
  return (
    <div className="tool-grid">
      <div className="tool-side">
        <HorizonTabs value={hk} onChange={setH} />
        {ready ? <Slider label="Price" value={ready.price} min={ready.axis.lo} max={ready.axis.hi} step={0.5} onChange={setPrice} format={(v) => usd(v)} /> : <Skeleton h={81} />}
      </div>
      <div className="tool-main">
        <Answer text={ready ? odds(ready.below[i]) : null} label={ready && <>of futures end below {usd(ready.price)} in {name}</>} />
        <PriceBars h={ready ? ready.output.combined.horizons[i] : null} total={ready?.output.totalPaths ?? 1} axis={axis} price={price}
          label={ready ? `${symbol} price after ${name}, from ${usd(ready.axis.lo, 0)} to ${usd(ready.axis.hi, 0)}. ${odds(ready.below[i])} of futures end below ${usd(ready.price)}.` : 'Price distribution, loading'} />
        <RunNote futures={int(output?.totalPaths ?? 1_000_000)} id={output ? id : null} ts={ts}>Starts at {usd(output?.spot)}. Scenario odds, not advice.</RunNote>
      </div>
      <div className="tool-rows tool-more">
        {HORIZON_NAMES.map((n, k) => (
          <Stat key={n} label={`Below in ${n}`} note={ready && ts ? `On ${landsOn(ts, ready.output.combined.horizons[k].days)}` : <Skeleton h="1.5em" w="5em" />}>
            {ready ? <NumberRoll text={odds(ready.below[k])} /> : <Skeleton h="1.2em" w="3.5em" />}
          </Stat>
        ))}
      </div>
    </div>
  );
}
