import { useEffect, useState } from 'react';
import type { EngineInputs, RunOutput } from '@engine/types';
import { useData } from '../lib/data';
import { api, type RunFull } from '../lib/api';
import { runInBrowser } from '../lib/engineClient';
import { SectionHead, Skeleton } from '../components/ui';
import { pct, usd } from '../lib/format';

const PATHS_PER_MODEL = 20_000; // × 5 models = 100,000 paths
const LABELS = ['Next close', '1 week', '1 month'];

/** Entry price (+ optional size) → odds of being above entry. Runs locally; nothing is sent or stored. */
export function Position() {
  const { latest } = useData();
  const runId = latest?.run?.id;
  const [base, setBase] = useState<{ inputs: EngineInputs; seed: string } | null>(null);
  const [entry, setEntry] = useState('');
  const [size, setSize] = useState('');
  const [out, setOut] = useState<RunOutput | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const price = Number(entry);
  const shares = Number(size);
  const valid = Number.isFinite(price) && price > 0 && price < 1e6;

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    api<RunFull>(`/api/run/${runId}`)
      .then((r) => { if (alive) { setBase({ inputs: r.inputs, seed: r.seed }); setErr(null); } })
      .catch(() => { if (alive) setErr('Could not load the latest run.'); });
    return () => { alive = false; };
  }, [runId]);

  useEffect(() => {
    setOut(null);
    if (!base || !valid) return;
    let alive = true;
    const t = setTimeout(() => {
      // P(above reference level) is computed exactly over all paths, so the entry price is used as that level
      runInBrowser({ ...base.inputs, preCrisisLevel: price }, base.seed, PATHS_PER_MODEL)
        .then((r) => { if (alive) { setOut(r.output); setErr(null); } })
        .catch((e) => { if (alive) setErr(String(e.message || e)); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [base, price, valid]);

  const hasSize = Number.isFinite(shares) && shares > 0;
  const pnl = (p: number) => {
    const v = hasSize ? (p - price) * shares : p / price - 1;
    const text = hasSize ? `${v < 0 ? '−' : '+'}${usd(Math.abs(v), 0)}` : pct(v, 1, true);
    return <span className={v < 0 ? 'red' : 'green'}>{text}</span>;
  };
  const field = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <label style={{ display: 'block', marginBottom: 18 }}>
      <span className="label">{label}</span>
      <input inputMode="decimal" value={value} placeholder={ph} maxLength={12}
        onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ''))}
        style={{ width: '100%', height: 48, marginTop: 8, borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', padding: '0 16px', fontFamily: 'var(--mono)', fontSize: 18 }} />
    </label>
  );

  return (
    <section className="block" id="position" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead eyebrow="Tool 02 · Check my position" title="Where does your entry sit in 100,000 futures?" lede="Enter an NVDA price to see how many simulated paths end above it. It runs in your browser: your numbers are never sent or stored." />
        <div className="panel reveal pos-grid">
          <div>
            {field('Entry price (USD)', entry, setEntry, latest?.run ? latest.run.spot.toFixed(2) : '0.00')}
            {field('Shares (optional)', size, setSize, '—')}
            <div className="tag">Educational · paper only</div>
            <p className="muted" style={{ fontSize: 13 }}>Simulated scenario odds, not advice and not a suggestion to hold, add or exit. Ignores fees and taxes.</p>
          </div>
          <div aria-live="polite" style={{ minHeight: 250 }}>
            {err ? <div className="red mono" style={{ fontSize: 13 }}>{err}</div>
              : !valid ? <div className="muted" style={{ paddingTop: 30 }}>Enter a price to run the scenarios.</div>
              : !out ? <Skeleton h={230} panel={false} label="Running 100,000 paths" />
              : (
                <div className="scroll-x fade-in">
                  <table className="data">
                    <thead><tr><th>Horizon</th><th>Above entry</th><th>5th pct</th><th>25th</th><th>Median</th><th>75th</th><th>95th pct</th></tr></thead>
                    <tbody>
                      {out.combined.horizons.map((h, i) => (
                        <tr key={h.days}>
                          <td>{LABELS[i]}</td>
                          <td className="mono ice" style={{ fontSize: 20 }}>{pct(out.combined.probs[i].pAbovePreCrisis)}</td>
                          {(['p5', 'p25', 'p50', 'p75', 'p95'] as const).map((k) => (
                            <td key={k} className="mono">{usd(h.pct[k])}<div style={{ fontSize: 12 }}>{pnl(h.pct[k])}</div></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="dim mono" style={{ fontSize: 12, marginTop: 10 }}>100,000 paths from {usd(out.spot)} · run #{runId} inputs and seed</div>
                </div>
              )}
          </div>
        </div>
      </div>
      <style>{`.pos-grid { display: grid; grid-template-columns: 1fr 2.4fr; gap: 36px; } .pos-grid > * { min-width: 0; } @media (max-width: 900px) { .pos-grid { grid-template-columns: 1fr; } }`}</style>
    </section>
  );
}
