import { useApi, type Desk as D } from '../lib/api';
import { LineChart } from '../components/charts';
import { Empty, Num, SectionHead, Skeleton, Stat } from '../components/ui';
import { etTime, pct, usd } from '../lib/format';

export function Desk() {
  const [d] = useApi<D>('/api/desk', 60000);
  const pts = (d?.equity ?? []).map((e) => ({ t: new Date(e.ts).getTime(), v: e.equity }));
  const ret = d?.returnPct ?? 0;
  return (
    <section className="block" id="desk" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <SectionHead
          eyebrow="Paper desk · paper only — not advice"
          title="A public paper desk that trades the odds."
          lede="Virtual $100,000. NVDA only, long or flat, 1×. Published rules, unchanged after launch except by a public changelog entry. Losses are shown exactly like gains."
        />
        {!d ? <Skeleton h={420} label="Loading the paper desk" /> : (
          <div className="fade-in">
            <div className="panel reveal desk-stats">
              <Stat label="Equity" value={<Num value={d.state.equity} fmt={(x) => usd(x)} />} />
              <Stat label="Return" value={pct(ret, 2, true)} tone={ret < 0 ? 'red' : ret > 0 ? 'green' : undefined} />
              <Stat label="Max drawdown" value={pct(-d.state.maxDrawdown, 2)} tone={d.state.maxDrawdown > 0 ? 'red' : undefined} />
              <Stat label="Win rate" value={d.winRate === null ? '—' : pct(d.winRate, 0)} sub={`${d.state.wins}W · ${d.state.losses}L`} />
              <Stat label="Position" value={d.state.position ? `Long ${d.state.position.qty.toFixed(1)}` : 'Flat'} sub={d.state.position ? `entry ${usd(d.state.position.entryPrice)}` : 'cash'} />
            </div>
            <div className="desk-grid" style={{ marginTop: 18 }}>
              <div className="panel reveal">
                <div className="label" style={{ marginBottom: 12 }}>Equity curve</div>
                {pts.length > 1 ? <LineChart points={pts} baseline={100000} height={220} /> : <Empty>The curve starts with the first marked run.</Empty>}
                <div className="label" style={{ marginTop: 18, marginBottom: 8 }}>Rules</div>
                <ul className="muted" style={{ fontSize: 14, margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                  <li>Enter long when P(up, 1 week) ≥ {Math.round(Number(d.rules.enterLongPUp1w) * 100)}% and Stress Level is falling.</li>
                  <li>Exit when P(up, 1 week) &lt; {Math.round(Number(d.rules.exitPUp1w) * 100)}% or the position is down {Math.round(Math.abs(Number(d.rules.stopLoss)) * 100)}%.</li>
                  <li>Fills only while the stock market is open, at the stock price. Marked to market every run.</li>
                </ul>
              </div>
              <div className="panel reveal">
                <div className="label" style={{ marginBottom: 12 }}>Last 10 trades</div>
                {d.trades.length === 0 ? <Empty>No trades yet — the rules haven’t fired.</Empty> : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    {d.trades.slice(0, 10).map((t) => (
                      <div key={t.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span className="mono" style={{ fontSize: 13 }}>{t.action === 'enter' ? 'ENTER' : 'EXIT'} {t.side.toUpperCase()} @ {usd(t.price)}</span>
                          {t.pnl !== null && <span className={`mono ${t.pnl < 0 ? 'red' : 'green'}`} style={{ fontSize: 13 }}>{t.pnl >= 0 ? '+' : ''}{usd(t.pnl)}</span>}
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.note}</div>
                        <div className="dim mono" style={{ fontSize: 11, marginTop: 4 }}>{etTime(t.ts)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .desk-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }
        .desk-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; }
        @media (max-width: 900px) { .desk-stats { grid-template-columns: repeat(2, 1fr); } .desk-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
