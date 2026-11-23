import { useData } from '../lib/data';
import { Countdown, SectionHead, Stat } from '../components/ui';
import { cdfFromHist } from './DragPrice';
import { pct, usd } from '../lib/format';

/** Shown while the stock market is closed: 24/7 token vs last close, and scenario odds for the next session. */
export function WeekendGap() {
  const { latest, output } = useData();
  if (!latest || latest.session === 'open') return null;
  const s = latest.run?.summary;
  const lastClose = s?.lastClose ?? null;
  const chain = latest.prices.chain?.price ?? s?.chainPrice ?? null;
  const gap = lastClose && chain ? chain / lastClose - 1 : null;
  const pricedOffChain = s?.priceSource === 'chain';
  const h1 = output?.combined.horizons[0];
  const pAboveClose = output && h1 && lastClose ? 1 - cdfFromHist(h1, lastClose, output.totalPaths) : null;
  const rel = (x: number | undefined) => (x && lastClose ? pct(x / lastClose - 1, 1, true) : '—');

  return (
    <section className="block" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead
          eyebrow="Market closed · Weekend gap"
          title="The stock is closed. The token isn’t."
          lede="NVDA’s on-chain token trades 24/7 on Robinhood Chain. While the market is shut, Quintel prices its runs off the token and shows how the next session could open relative to the last close."
        />
        <div className="panel reveal gap-grid">
          <Stat label="Last stock close" value={usd(lastClose)} />
          <Stat label="On-chain token now" value={usd(chain)} />
          <Stat label="Gap" value={gap === null ? '—' : pct(gap, 2, true)} tone={gap !== null && gap < 0 ? 'red' : 'ice'} />
          <Stat label="Market opens in" value={<Countdown to={latest.nextOpen} />} />
        </div>
        {output && h1 && lastClose && (
          <div className="panel reveal" style={{ marginTop: 18 }}>
            <div className="label" style={{ marginBottom: 16 }}>Scenario odds for the next session close, relative to last close</div>
            <div className="gap-grid">
              <Stat label="P(above last close)" value={pct(pAboveClose)} />
              <Stat label="5th percentile" value={rel(h1.pct.p5)} tone="red" sub={usd(h1.pct.p5)} />
              <Stat label="Median" value={rel(h1.pct.p50)} sub={usd(h1.pct.p50)} />
              <Stat label="95th percentile" value={rel(h1.pct.p95)} sub={usd(h1.pct.p95)} />
            </div>
            {!pricedOffChain && <div className="muted" style={{ fontSize: 13, marginTop: 16 }}>Token price unavailable or out of line with the stock for this run — priced off the last close instead.</div>}
          </div>
        )}
      </div>
      <style>{`.gap-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; } @media (max-width: 760px) { .gap-grid { grid-template-columns: repeat(2, 1fr); } }`}</style>
    </section>
  );
}
