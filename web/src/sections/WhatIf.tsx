import { useEffect, useRef, useState } from 'react';
import type { EngineInputs, RunOutput, Shock } from '@engine/types';
import { useData } from '../lib/data';
import { api, type RunFull } from '../lib/api';
import { runInBrowser } from '../lib/engineClient';
import { Fan } from '../components/charts';
import { Empty, SectionHead, Skeleton } from '../components/ui';
import { pct, usd } from '../lib/format';

const PRESETS: { name: string; shock: Shock }[] = [
  { name: 'Guidance cut', shock: { drift: -0.12, jumpMult: 2, volMult: 1.4 } },
  { name: 'Regulatory fine', shock: { drift: -0.05, jumpMult: 1.5, volMult: 1.2 } },
  { name: 'Leadership named', shock: { drift: 0.04, jumpMult: 1.2, volMult: 0.9 } },
  { name: 'Export restriction', shock: { drift: -0.15, jumpMult: 2.5, volMult: 1.6 } },
  { name: 'Panic selling', shock: { drift: -0.2, jumpMult: 3, volMult: 2.2 } },
];
const NONE: Shock = { drift: 0, jumpMult: 1, volMult: 1 };

export function WhatIf() {
  const { latest, output } = useData();
  const runId = latest?.run?.id;
  const [base, setBase] = useState<{ inputs: EngineInputs; seed: string } | null>(null);
  const [shock, setShock] = useState<Shock>(NONE);
  const [res, setRes] = useState<{ out: RunOutput; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!runId || !visible) return;
    api<RunFull>(`/api/run/${runId}`).then((r) => setBase({ inputs: r.inputs, seed: r.seed })).catch((e) => setErr(String(e)));
  }, [runId, visible]);

  useEffect(() => {
    if (!base) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setBusy(true);
      const isNone = shock.drift === 0 && shock.jumpMult === 1 && shock.volMult === 1;
      const inputs: EngineInputs = { ...base.inputs, ...(isNone ? {} : { shock }) };
      if (isNone) delete (inputs as Partial<EngineInputs>).shock;
      runInBrowser(inputs, base.seed, 100_000)
        .then((r) => setRes({ out: r.output, ms: r.ms }))
        .catch((e) => setErr(String(e.message || e)))
        .finally(() => setBusy(false));
    }, 160);
  }, [base, shock]);

  const slider = (label: string, key: keyof Shock, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="label">{label}</span>
        <span className="mono" style={{ fontSize: 13 }}>{fmt(shock[key])}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={shock[key]} onChange={(e) => setShock({ ...shock, [key]: Number(e.target.value) })} />
    </label>
  );

  const o = res?.out;
  return (
    <section className="block" ref={sectionRef} style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead eyebrow="Tool 02 · What if" title="Shock the inputs. Rerun 500,000 futures in your browser." lede="Presets set a drift shock, jump intensity and volatility multiplier. The same engine as the official run executes locally in a Web Worker — nothing leaves your device." />
        {!output ? <Skeleton h={360} label="Loading the latest run" /> : (
          <div className="panel reveal wi-grid fade-in">
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                {PRESETS.map((p) => (
                  <button key={p.name} className="btn sm" onClick={() => setShock(p.shock)}
                    style={JSON.stringify(shock) === JSON.stringify(p.shock) ? { borderColor: 'var(--ice)', color: 'var(--ice-bright)' } : undefined}>{p.name}</button>
                ))}
                <button className="btn sm" onClick={() => setShock(NONE)}>Reset</button>
              </div>
              {slider('Drift shock (1 month)', 'drift', -0.3, 0.2, 0.01, (v) => pct(v, 0, true))}
              {slider('Jump intensity', 'jumpMult', 1, 5, 0.1, (v) => v.toFixed(1) + '×')}
              {slider('Volatility', 'volMult', 0.5, 3, 0.05, (v) => v.toFixed(2) + '×')}
              <div className="tag warn" style={{ marginTop: 8 }}>Hypothetical — your inputs</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="label">Your scenario fan vs official (grey)</span>
                <span className="mono dim" style={{ fontSize: 12 }}>{busy ? 'running 500,000 paths…' : res ? `500,000 paths in ${(res.ms / 1000).toFixed(2)}s` : ''}</span>
              </div>
              {o ? <Fan spot={o.spot} horizons={o.combined.horizons} compare={output.combined.horizons} height={260} /> : err ? <Empty>{err}</Empty> : <Skeleton h={260} panel={false} label="Running 500,000 paths" />}
              {o && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 18 }}>
                  <div><div className="label">1m median</div><div className="mono" style={{ fontSize: 20 }}>{usd(o.combined.horizons[2].pct.p50)}</div></div>
                  <div><div className="label">P(up, 1m)</div><div className="mono" style={{ fontSize: 20 }}>{pct(o.combined.probs[2].pUp)}</div></div>
                  <div><div className="label">P(down &gt;20%, 1m)</div><div className="mono red" style={{ fontSize: 20 }}>{pct(o.combined.probs[2].pDown20)}</div></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`.wi-grid { display: grid; grid-template-columns: 1fr 1.6fr; gap: 36px; } @media (max-width: 900px) { .wi-grid { grid-template-columns: 1fr; } }`}</style>
    </section>
  );
}
