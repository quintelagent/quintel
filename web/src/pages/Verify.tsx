import { useEffect, useState } from 'react';
import { api, type Fingerprint, type RunFull } from '../lib/api';
import { useData } from '../lib/data';
import { runInBrowser } from '../lib/engineClient';
import { hashObject } from '@engine/hash';
import { deriveSeed } from '@engine/run';
import { etTime, short } from '../lib/format';
import { navigate, useRoute } from '../lib/router';

type Status = 'idle' | 'running' | 'ok' | 'fail' | 'na';
interface Step { label: string; status: Status; detail?: React.ReactNode }

function Badge({ s }: { s: Status }) {
  const map: Record<Status, [string, string]> = {
    idle: ['waiting', 'var(--dim)'], running: ['running', 'var(--ice)'], ok: ['match', 'var(--green)'], fail: ['NO MATCH', 'var(--red)'], na: ['not yet', 'var(--muted)'],
  };
  const [t, c] = map[s];
  return <span className="mono" style={{ fontSize: 12, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{t}</span>;
}

export function Verify() {
  const { query } = useRoute();
  const { latest, config } = useData();
  const [input, setInput] = useState(query.get('run') ?? '');
  const runId = Number(query.get('run') || 0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [progress, setProgress] = useState(0);
  const [meta, setMeta] = useState<RunFull | null>(null);

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const set = (i: number, s: Partial<Step>) => alive && setSteps((prev) => prev.map((x, k) => (k === i ? { ...x, ...s } : x)));
    setSteps([
      { label: 'Download stored inputs + seed', status: 'running' },
      { label: 'Input hash matches the stored input hash', status: 'idle' },
      { label: 'Seed = keccak256(inputs + timestamp)', status: 'idle' },
      { label: 'Re-run all 1,000,000 paths in your browser → output hash', status: 'idle' },
      { label: 'Hourly fingerprint contains this run and recomputes', status: 'idle' },
    ]);
    setProgress(0);
    (async () => {
      let run: RunFull;
      try {
        run = await api<RunFull>(`/api/run/${runId}`);
        setMeta(run);
        set(0, { status: 'ok', detail: `${etTime(run.ts)} · ${run.inputs.closes.length} daily closes · spot $${run.inputs.spot} (${run.inputs.priceSource})` });
      } catch (e) {
        set(0, { status: 'fail', detail: String(e) });
        return;
      }
      const ih = hashObject(run.inputs);
      set(1, { status: ih === run.input_hash ? 'ok' : 'fail', detail: <span className="mono">{short(ih, 12)} vs stored {short(run.input_hash, 12)}</span> });
      const seed = deriveSeed(run.inputs);
      set(2, { status: seed === run.seed ? 'ok' : 'fail', detail: <span className="mono">{seed}</span> });
      set(3, { status: 'running' });
      try {
        const r = await runInBrowser(run.inputs, run.seed, run.output.pathsPerModel, { onProgress: (p) => alive && setProgress(p) });
        set(3, {
          status: r.hash === run.output_hash ? 'ok' : 'fail',
          detail: <span className="mono">{short(r.hash, 12)} vs stored {short(run.output_hash, 12)} · {(r.ms / 1000).toFixed(2)}s on your device</span>,
        });
      } catch (e) {
        set(3, { status: 'fail', detail: String(e) });
      }
      try {
        const fp = await api<Fingerprint & { payload?: any; status: string }>(`/api/fingerprint-for-run?id=${runId}`);
        if (!fp.payload) { set(4, { status: 'na', detail: `This hour (${etTime(fp.hour)}) is fingerprinted at the top of the next hour.` }); return; }
        const recomputed = hashObject(fp.payload);
        const idx = fp.payload.runIds.indexOf(runId);
        const ok = recomputed === fp.hash && idx >= 0 && fp.payload.outputHashes[idx] === run.output_hash && fp.payload.inputHashes[idx] === run.input_hash;
        set(4, {
          status: ok ? 'ok' : 'fail',
          detail: (
            <span className="mono">
              {short(recomputed, 12)} · {fp.payload.runIds.length} runs, {fp.payload.briefingHashes.length} briefings ·{' '}
              {fp.tx ? <a href={`${config?.explorer ?? ''}/tx/${fp.tx}`} target="_blank" rel="noreferrer">tx {short(fp.tx)} ↗</a> : <span className="red">tx pending (attempt {fp.attempts})</span>}
            </span>
          ),
        });
      } catch (e) {
        set(4, { status: 'fail', detail: String(e) });
      }
    })();
    return () => { alive = false; };
  }, [runId, config?.explorer]);

  return (
    <main style={{ paddingTop: 120, paddingBottom: 100, minHeight: '100vh' }}>
      <div className="wrap" style={{ maxWidth: 920 }}>
        <div className="eyebrow">Verify</div>
        <h1 style={{ fontSize: 'clamp(38px, 5vw, 64px)', margin: '18px 0' }}>Re-run it yourself.</h1>
        <p className="lede">Pick any run. Your browser downloads exactly what the engine saw, runs the same open-source code, and checks every hash. Nothing is trusted — it is all recomputed on your device.</p>
        <form onSubmit={(e) => { e.preventDefault(); navigate(`/verify?run=${input || latest?.run?.id || ''}`); }} style={{ display: 'flex', gap: 10, margin: '34px 0' }}>
          <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label="Run number"
            placeholder={latest?.run ? `Run # (latest is ${latest.run.id})` : 'Run #'}
            style={{ flex: 1, minWidth: 0, height: 50, borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)', padding: '0 20px', fontFamily: 'var(--mono)', fontSize: 16 }} />
          <button className="btn primary" type="submit" style={{ height: 50 }}>Verify</button>
        </form>
        {runId > 0 && (
          <div className="panel">
            <div className="label" style={{ marginBottom: 14 }}>Run #{runId}{meta ? ` · seed ${meta.seed}` : ''}</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderTop: i ? '1px solid var(--border)' : 0, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div>{i + 1}. {s.label}</div>
                  {s.detail && <div className="muted" style={{ fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>{s.detail}</div>}
                  {i === 3 && s.status === 'running' && (
                    <div style={{ height: 3, background: 'var(--border)', marginTop: 10, borderRadius: 3, overflow: 'hidden', width: 260 }}>
                      <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--ice)', transition: 'width .3s' }} />
                    </div>
                  )}
                </div>
                <Badge s={s.status} />
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 14, marginTop: 28 }}>
          Prefer a terminal? <code className="mono">npx tsx engine/verify.ts {runId || '<runId>'}</code> — see <a href="/docs/proof" onClick={(e) => { e.preventDefault(); navigate('/docs/proof'); }}>PROOF</a>.
        </p>
      </div>
    </main>
  );
}
