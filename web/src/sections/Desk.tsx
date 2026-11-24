import { useState, type ReactNode } from 'react';
import { Button, Card, Change, DataTable, EmptyState, ErrorState, NumberRoll, Pill, Section, Skeleton, Stat, type Column } from '../components/ui';
import { PixelSpark } from '../components/pixel';
import { Link } from '../lib/router';
import type { Desk as DeskData, DeskTrade } from '../lib/api';
import { useData } from '../lib/data';
import { etDate, etDateTime, etTime, int, pct, pctChange, usd, usdChange } from '../lib/format';
import { useNow } from '../lib/hooks';
import { isDelayed } from '../lib/marketState';
import { DEFAULT_SYMBOL, symbolConfig } from '../lib/symbols';
import './desk.css';

const shares = (q: number) => q.toLocaleString('en-US', { maximumFractionDigits: 2 });
const noWrap = (s: string) => s.replace(/ /g, '\u00a0');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The stored reason, in plain words. */
const why = (t: DeskTrade) => cap(t.reason
  .replace(/P\(up, 1w\) ([\d.]+%) ≥ (\d+%)/, 'odds of a rise in 1 week at $1, rule $2 or more,')
  .replace(/P\(up, 1w\) ([\d.]+%) fell below/, 'odds of a rise in 1 week at $1, below')
  .replace(/(\d+) ?→ ?(\d+)/, 'from $1 to $2').replace('vs entry', 'from entry').replace(/(^|\s)-(?=\d)/g, '$1−'));

/** The published rules, written from the live rule values. A rule with a missing value is left out. */
function rulesOf(r: DeskData['rules'], symbol: string): string[] {
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  const p = (k: string) => { const x = n(k); return x === null ? null : pct(Math.abs(x), 0); };
  const cash = n('startingCash'), lev = n('maxLeverage'), enter = p('enterLongPUp1w'), exit = p('exitPUp1w'), stop = p('stopLoss');
  const list: (string | false)[] = [
    cash !== null && `Starts with a virtual ${usd(cash, 0)}. ${symbol} only, ${r.allowShort === false ? 'long or in cash' : 'long, short or in cash'}${lev === 1 ? ', nothing borrowed' : ''}.`,
    !!enter && `Enters when the odds of a rise in 1 week are at least ${enter} and the Stress Level is lower than at the run before.`,
    !!exit && `Exits when those odds fall below ${exit}${stop ? `, or when the position is down ${stop} from its entry price` : ''}.`,
    r.tradeOnlyWhenOpen === true && 'Trades only while the stock market is open, at the stock price. Valued after every run, at that run’s price.',
  ];
  return list.filter((x): x is string => !!x);
}

export function Desk({ symbol = DEFAULT_SYMBOL }: { symbol?: string }) {
  const { desk: d, deskError, reloadDesk } = useData();
  const now = useNow(60000);
  const [all, showAll] = useState(false);
  const failed = !d && deskError;
  const sym = symbolConfig(symbol).symbol;
  const st = d?.state, pos = st?.position ?? null;
  const started = !!st && st.lastPrice > 0;
  const gain = pos && st ? (pos.side === 'short' ? -1 : 1) * pos.qty * (st.lastPrice - pos.entryPrice) : null;
  const val = (node: ReactNode, w = 96) => (d ? node : <Skeleton h={24} w={w} />);
  const note = (text: string) => (d ? text : <>&nbsp;</>);
  const trades = d?.trades.slice(0, all ? undefined : 10) ?? [];
  const openId = pos ? d?.trades.find((t) => t.action === 'enter')?.id : null;

  const cols: Column<DeskTrade>[] = [
    { key: 'ts', head: 'Time', mono: true, cell: (t) => `${noWrap(etDate(t.ts))}, ${noWrap(etTime(t.ts))}` },
    { key: 'a', head: 'Trade', cell: (t) => `${t.action === 'enter' ? 'Entered' : 'Exited'} ${t.side}` },
    { key: 'p', head: 'Price', mono: true, cell: (t) => usd(t.price) },
    { key: 'q', head: 'Shares', mono: true, cell: (t) => shares(t.qty) },
    { key: 'g', head: 'Gain or loss', mono: true, cell: (t) => (t.pnl === null ? (t.id === openId ? 'Open' : 'Closed') : <Change value={t.pnl} text={usdChange(t.pnl)} />) },
    { key: 'w', head: 'Why', cell: why },
  ];

  return (
    <Section
      id="desk" title="A public paper desk, every trade shown." sub="Virtual money that follows published rules. Losses are shown exactly like gains."
      eyebrow={<span className="row"><Pill>Paper trading. No real money.</Pill>{started && isDelayed(st.updatedAt, now) && <Pill tone="muted">Delayed · last run {etTime(st.updatedAt)}</Pill>}</span>}
    >
      {failed ? (
        <Card><ErrorState text="Couldn’t load the paper desk. Try again." onRetry={reloadDesk} /></Card>
      ) : (
        <div className={trades.length ? 'desk has-trades' : 'desk'}>
          <Card className="desk-now">
            <div className="desk-stats">
              <Stat label="Equity" note={note(started ? `marked ${etTime(st.updatedAt)}` : 'before the first run')}>{val(<NumberRoll text={usd(st?.equity)} />, 128)}</Stat>
              <Stat label="Return" note={note('since the start')}>{val(<Change value={d?.returnPct} text={pctChange(d?.returnPct, 2)} />)}</Stat>
              <Stat label="Win rate" note={note(d?.winRate == null ? 'no closed trades' : `${int(st?.wins)} up, ${int(st?.losses)} down`)}>{val(d?.winRate == null ? 'Not yet' : pct(d.winRate))}</Stat>
              <Stat label="Max drawdown" note={note('largest fall from a peak')}>{val(<Change value={st?.maxDrawdown ? -st.maxDrawdown : 0} text={pct(st?.maxDrawdown ? -st.maxDrawdown : 0, 2)} />)}</Stat>
            </div>
            <hr className="hair" />
            <h3>Open position</h3>
            {!d ? <Skeleton h="var(--desk-pos-h)" /> : pos ? (
              <div className="desk-stats">
                <Stat label={cap(pos.side)} note={`entered ${etDateTime(pos.entryTs)}`}>{shares(pos.qty)} {sym}</Stat>
                <Stat label="Entry price" note={`last mark ${usd(st?.lastPrice)}`}>{usd(pos.entryPrice)}</Stat>
                <Stat label="Value" note="at the last mark">{usd(pos.qty * (st?.lastPrice ?? 0))}</Stat>
                <Stat label="Gain or loss" note="not yet closed"><Change value={gain} text={usdChange(gain)} /></Stat>
              </div>
            ) : (
              <p className="muted">No open position. The desk is in cash.{started ? ` ${sym} was last marked at ${usd(st.lastPrice)}.` : ''}</p>
            )}
          </Card>
          <Card className="desk-trades">
            <h3>Recent trades</h3>
            {!d ? <Skeleton h="var(--desk-none-h)" /> : trades.length === 0 ? (
              <EmptyState text="No trades yet. The entry rules have not been met." />
            ) : (
              <>
                {d.equity.length > 1 && <div className="stack"><div className="label">Equity at each run since {etDate(d.equity[0].ts)}</div><PixelSpark values={d.equity.map((e) => e.equity)} label={`Desk equity from ${usd(d.equity[0].equity)} to ${usd(d.equity[d.equity.length - 1].equity)}`} height={64} /></div>}
                <DataTable columns={cols} rows={trades} rowKey={(t) => t.id} caption="Recent paper desk trades, newest first" />
                {d.trades.length > 10 && <Button variant="secondary" aria-expanded={all} onClick={() => showAll(!all)}>{all ? 'Show fewer' : 'Show more'}</Button>}
              </>
            )}
          </Card>
          <Card className="desk-rules">
            <h3>The rules</h3>
            {d ? <ol>{rulesOf(d.rules, sym).map((x) => <li key={x}>{x}</li>)}</ol> : <Skeleton h="var(--desk-rules-h)" />}
            <p className="note">Rules change only with a public entry in the <Link href="/changelog">changelog</Link>.</p>
          </Card>
        </div>
      )}
    </Section>
  );
}
