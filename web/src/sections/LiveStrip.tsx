import { useData } from '../lib/data';
import { ago, pct, usd } from '../lib/format';
import { onLink } from '../lib/router';

export function LiveStrip() {
  const { latest, error } = useData();
  const run = latest?.run;
  const s = run?.summary;
  const stock = latest?.session === 'open' ? s?.stockPrice ?? latest?.prices.stock?.price : s?.lastClose;
  const chain = latest?.prices.chain?.price ?? s?.chainPrice ?? null;
  const gap = stock && chain ? chain / stock - 1 : null;
  const cells: [string, React.ReactNode, string?][] = [
    [latest?.session === 'open' ? 'NVDA stock' : 'NVDA last close', usd(stock ?? null)],
    ['On-chain NVDA token', usd(chain)],
    ['Token vs stock', gap === null ? '—' : pct(gap, 2, true), gap !== null && gap < 0 ? 'red' : undefined],
    ['Last run', run ? ago(run.ts) : '—'],
    ['Run', run ? <a href={`/verify?run=${run.id}`} onClick={onLink}>#{run.id} ↗</a> : '—'],
    ['Model agreement', s ? `${s.agreement}/100` : '—'],
  ];
  return (
    <section id="live" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="wrap">
        <div className="strip">
          {cells.map(([k, v, tone]) => (
            <div key={k} className="strip-cell">
              <div className="label">{k}</div>
              <div className={`mono ${tone ?? ''}`} style={{ fontSize: 18, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
        {error && !latest && <div className="mono red" style={{ fontSize: 12, paddingBottom: 12 }}>Live data unavailable right now ({error}). Retrying…</div>}
      </div>
      <style>{`
        .strip { display: grid; grid-template-columns: repeat(6, 1fr); }
        .strip-cell { padding: 22px 18px; border-left: 1px solid var(--border); }
        .strip-cell:first-child { border-left: 0; padding-left: 0; }
        @media (max-width: 900px) { .strip { grid-template-columns: repeat(2, 1fr); } .strip-cell { border-left: 0; border-top: 1px solid var(--border); padding-left: 0; } .strip-cell:nth-child(-n+2) { border-top: 0; } }
      `}</style>
    </section>
  );
}
