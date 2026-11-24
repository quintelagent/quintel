import { useState } from 'react';
import { useApi, type Proof as P, type Scorecard } from '../lib/api';
import { useData } from '../lib/data';
import { Empty, SectionHead, Skeleton } from '../components/ui';
import { etTime, pct, short } from '../lib/format';
import { navigate } from '../lib/router';

export function Proof() {
  const [p] = useApi<P>('/api/proof', 60000);
  const [sc] = useApi<Scorecard>('/api/scorecard', 300000);
  const { latest } = useData();
  const [runId, setRunId] = useState('');
  const fps = p?.fingerprints ?? [];
  return (
    <section className="block" id="proof" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <SectionHead eyebrow="Proof" title={p?.lockedFromDayOne ? 'Every hour, locked on-chain from day one.' : 'Every hour, hashed. Check it yourself.'} lede={p?.sent ? 'Every hour, the hashes of every run, input, briefing and the desk state are combined into one fingerprint and written to Robinhood Chain. Any run can be re-computed in your browser, byte for byte.' : 'Every hour, the hashes of every run, input, briefing and the desk state are combined into one fingerprint. On-chain posting has not started yet; any run can already be re-computed in your browser, byte for byte.'} />
        <div className="proof-grid">
          <div className="panel reveal">
            <div className="label" style={{ marginBottom: 14 }}>Verify any run</div>
            <p className="muted" style={{ fontSize: 15, marginTop: 0 }}>Your browser downloads the run’s stored inputs and seed, re-runs all 1,000,000 paths, and compares the output hash.</p>
            <form onSubmit={(e) => { e.preventDefault(); navigate(`/verify?run=${runId || latest?.run?.id || ''}`); }} style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <input
                value={runId} onChange={(e) => setRunId(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                placeholder={latest?.run ? `Run # (latest ${latest.run.id})` : 'Run #'}
                aria-label="Run number"
                style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', padding: '0 18px', fontFamily: 'var(--mono)' }}
              />
              <button className="btn primary" type="submit">Verify</button>
            </form>
            {p?.wallet && (
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div className="label">Quintel fingerprint wallet</div>
                <a className="mono" href={`${p.explorer}/address/${p.wallet}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, wordBreak: 'break-all', display: 'inline-block', marginTop: 6 }}>
                  {p.wallet} ↗
                </a>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Robinhood Chain · chain id {p.chainId} · every fingerprint is a 0-value tx from this wallet to itself</div>
              </div>
            )}
          </div>
          <div className="panel reveal">
            <div className="label" style={{ marginBottom: 14 }}>Scorecard</div>
            {!sc || sc.status === 'collecting' ? (
              <div>
                <div className="tag" style={{ marginBottom: 12 }}><span className="dot live" /> collecting data</div>
                <p className="muted" style={{ fontSize: 15, margin: 0 }}>{sc?.note ?? 'Every matured horizon is checked against the actual close. No history is back-filled or simulated.'}</p>
              </div>
            ) : (
              <table className="data">
                <thead><tr><th>Horizon</th><th>Scored</th><th>In 50% band</th><th>In 90% band</th><th>Brier</th></tr></thead>
                <tbody>
                  {sc.horizons.map((h) => (
                    <tr key={h.horizon}>
                      <td className="mono">{h.horizon === 1 ? 'Next close' : h.horizon === 5 ? '1 week' : '1 month'}</td>
                      <td className="mono">{h.n}</td>
                      <td className="mono">{pct(h.rate50, 0)} <span className="dim">/ 50%</span></td>
                      <td className="mono">{pct(h.rate90, 0)} <span className="dim">/ 90%</span></td>
                      <td className="mono">{h.brier.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="panel reveal" style={{ marginTop: 18 }}>
          {!!p?.pending && <div className="tag warn" style={{ marginBottom: 12 }}>{p.pending} hour{p.pending === 1 ? '' : 's'} recorded, not yet on-chain</div>}
          <div className="label" style={{ marginBottom: 6 }}>Latest hourly fingerprints · Robinhood Chain</div>
          {!p ? <Skeleton h={160} panel={false} /> : fps.length === 0 ? <Empty>The first fingerprint is written at the top of the first full hour of runs.</Empty> : (
            <div className="scroll-x">
              <table className="data">
                <thead><tr><th>Hour</th><th>Fingerprint</th><th>On-chain</th><th>Transaction</th></tr></thead>
                <tbody>
                  {fps.slice(0, 12).map((f) => (
                    <tr key={f.hour}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{etTime(f.hour)}</td>
                      <td className="mono">{short(f.hash, 10)}</td>
                      <td className="mono dim">{f.status === 'sent' ? '✓' : ''}</td>
                      <td className="mono">
                        {f.tx ? <a href={`${p!.explorer}/tx/${f.tx}`} target="_blank" rel="noreferrer">{short(f.tx)} ↗</a>
                          : <span className="red" title={f.error ?? ''}>pending · retry {f.attempts}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style>{`.proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; } @media (max-width: 900px) { .proof-grid { grid-template-columns: 1fr; } }`}</style>
    </section>
  );
}
