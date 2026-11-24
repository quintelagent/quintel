import { useMemo } from 'react';
import { Change, Countdown, EmptyState, ErrorState, NumberRoll, Pill, Skeleton, Stat } from '../../components/ui';
import { useData } from '../../lib/data';
import { etDate, etDateTime, etTime, int, odds, pctChange, usd } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { EARLY_CLOSES, HOLIDAYS, marketState } from '../../lib/marketState';
import { axisOf, cdfFromHist } from '../../lib/odds';
import { Answer, PriceBars, RunNote, useOutputRun } from './DragTab';

const closureText = (c: string) =>
  HOLIDAYS.has(c) ? `Market closed ${etDate(c)}` : EARLY_CLOSES.has(c) ? `Market closes 1:00pm ET on ${etDate(c)}` : /^\d{4}-\d{2}-\d{2}$/.test(c) ? etDate(c) : c;

/** The 24/7 token next to the last close, and the odds around that close. Read-only. */
export function WeekendTab({ symbol, closure }: { symbol: string; closure: string | null }) {
  const { latest } = useData();
  const { output, id, ts, summary, failed, none, retry } = useOutputRun();
  const now = useNow(30000);
  const market = marketState(now);

  const lastClose = summary?.lastClose ?? null;
  const token = latest?.prices.chain ?? null;
  const chain = token?.price ?? summary?.chainPrice ?? null;
  const gap = lastClose && chain ? chain / lastClose - 1 : null;
  const h1 = output?.combined.horizons[0] ?? null;
  const pAbove = output && h1 && lastClose ? 1 - cdfFromHist(h1, lastClose, output.totalPaths) : null;
  const axis = useMemo(() => (h1 ? axisOf(h1, 5) : null), [h1]);
  if (failed) return <ErrorState onRetry={retry} />;
  if (none || (summary && !lastClose)) return <EmptyState text="Gap odds appear after the next run." />;

  const wait = (w: string) => <Skeleton h="1.2em" w={w} />;
  const off = <span className="label">Unavailable</span>;
  const rel = (x: number | undefined) => { const v = x !== undefined && lastClose ? x / lastClose - 1 : null; return v === null ? wait('4em') : <Change value={v} text={pctChange(v)} />; };
  return (
    <div className="tool-grid">
      <div className="tool-side">
        <div className="stack tool-head">
          <h3>{closure ? 'Try a gap over the holiday' : 'The stock closes. The token doesn’t.'}</h3>
          {closure && <div><Pill>{closureText(closure)}</Pill></div>}
          <p className="muted">{market.open
            ? 'The gap applies once the market closes. Until then, these are the latest gap odds.'
            : 'While the market is closed, runs start from the token price when it is available. The odds look 1 day ahead.'}</p>
        </div>
        <div className="tool-rows">
          <Stat label="Last stock close" note={symbol}>{lastClose ? usd(lastClose) : wait('4.5em')}</Stat>
          <Stat label="Token on Robinhood Chain" note={token ? `As of ${etDate(token.ts) === etDate(now) ? etTime(token.ts) : etDateTime(token.ts)}` : chain ? 'From the latest run' : ' '}>{chain ? <NumberRoll text={usd(chain)} /> : latest ? off : wait('4.5em')}</Stat>
          <Stat label="Gap" note="Token against the last close">{gap !== null ? <Change value={gap} text={pctChange(gap, 2)} /> : latest ? off : wait('4em')}</Stat>
          <Stat label={market.open ? 'Market closes in' : 'Market opens in'}><Countdown to={market.open && market.nextClose ? market.nextClose : market.nextOpen} /></Stat>
        </div>
      </div>
      <div className="tool-main">
        <Answer text={pAbove === null ? null : odds(pAbove)} label={<>of futures end above the last close, {usd(lastClose)}, in 1 day</>} />
        <PriceBars h={pAbove === null ? null : h1} total={output?.totalPaths ?? 1} axis={axis} price={pAbove === null ? null : lastClose}
          label={pAbove !== null && axis ? `${symbol} price after 1 day, from ${usd(axis.lo, 0)} to ${usd(axis.hi, 0)}. ${odds(pAbove)} of futures end above the last close of ${usd(lastClose)}.` : 'Price distribution, loading'} />
        <div className="tool-rows">
          <Stat label="Worst 5%" note={h1 ? `${usd(h1.pct.p5)} or lower` : ' '}>{rel(h1?.pct.p5)}</Stat>
          <Stat label="Middle" note={h1 ? usd(h1.pct.p50) : ' '}>{rel(h1?.pct.p50)}</Stat>
          <Stat label="Best 5%" note={h1 ? `${usd(h1.pct.p95)} or higher` : ' '}>{rel(h1?.pct.p95)}</Stat>
        </div>
        <RunNote futures={int(output?.totalPaths ?? 1_000_000)} id={output ? id : null} ts={ts}>
          {summary && !market.open && summary.priceSource !== 'chain' ? 'Starts from the last stock price, as the token price was not used. Scenario odds, not advice.' : 'Changes from the last close. Scenario odds, not advice.'}
        </RunNote>
      </div>
    </div>
  );
}
