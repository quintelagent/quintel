import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunOutput, Shock } from '@engine/types';
import { Button, Change, EmptyState, ErrorState, NumberRoll, Pill, Skeleton, Slider, Stat } from '../../components/ui';
import { useData } from '../../lib/data';
import { runInBrowser } from '../../lib/engineClient';
import { etShortDate, odds, pctChange, pts, usd } from '../../lib/format';
import { etParts } from '../../lib/marketState';
import { axisOf, HORIZON_NAMES, NO_SHOCK, sameShock, useRunBase, WHATIF_PATHS, withShock, type HorizonKey, type RunBase } from '../../lib/odds';
import { Answer, HorizonTabs, PriceBars, RunNote } from './DragTab';

interface Preset { id: string; name: string; shock: Shock }
const PRESETS: Preset[] = [
  { id: 'guidance', name: 'Guidance cut', shock: { drift: -0.12, jumpMult: 2, volMult: 1.4 } },
  { id: 'fine', name: 'Regulatory fine', shock: { drift: -0.05, jumpMult: 1.5, volMult: 1.2 } },
  { id: 'leadership', name: 'Leadership named', shock: { drift: 0.04, jumpMult: 1.2, volMult: 0.9 } },
  { id: 'export', name: 'Export restriction', shock: { drift: -0.15, jumpMult: 2.5, volMult: 1.6 } },
  { id: 'panic', name: 'Panic selling', shock: { drift: -0.2, jumpMult: 3, volMult: 2.2 } },
];
/** direction-neutral: only volatility and jump odds rise */
const HEARING: Shock = { drift: 0, jumpMult: 2.5, volMult: 1.3 };

interface Result { shock: Shock; out: RunOutput; ms: number; base: RunBase }
const keyOf = (b: RunBase, s: Shock) => `${b.id}:${JSON.stringify(s)}`;

/** Reruns the engine here after each change. One run at a time: while it works, only the newest change waits. */
function useWhatIf(base: RunBase | null, shock: Shock, active: boolean) {
  const [res, setRes] = useState<Result | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [n, again] = useState(0);
  const want = useRef<{ base: RunBase; shock: Shock } | null>(null), running = useRef(false), done = useRef(''), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; want.current = null; }; }, []);
  useEffect(() => {
    if (!base || !active) return;
    const t = window.setTimeout(async () => {
      want.current = done.current === keyOf(base, shock) ? null : { base, shock };
      if (running.current || !want.current) return;
      running.current = true;
      setState('busy');
      let failed = false;
      while (want.current) {
        const job: { base: RunBase; shock: Shock } = want.current;
        want.current = null;
        try {
          const r = await runInBrowser(withShock(job.base.inputs, job.shock), job.base.seed, WHATIF_PATHS);
          failed = false;
          done.current = keyOf(job.base, job.shock);
          if (alive.current) setRes({ shock: job.shock, out: r.output, ms: r.ms, base: job.base });
        } catch { failed = true; done.current = ''; }
      }
      running.current = false;
      if (alive.current) setState(failed ? 'error' : 'idle');
    }, 160);
    return () => clearTimeout(t);
  }, [base, shock, active, n]);
  return { res, state, retry: () => { setState('idle'); again((x) => x + 1); } };
}

export function WhatIfTab({ symbol, active, preset }: { symbol: string; active: boolean; preset: { id: string; n: number } | null }) {
  const { latest, latestError, reload, output, outputRunId, config } = useData();
  const [shock, setShock] = useState<Shock>(NO_SHOCK);
  const [hk, setH] = useState<HorizonKey>('2');
  const { base, error, retry: retryBase } = useRunBase(active);
  const { res, state, retry } = useWhatIf(base, shock, active);

  const hearing = config?.hearing;
  const presets = useMemo(() => {
    const ahead = hearing && hearing.date >= etParts(latest ? new Date(latest.now) : new Date()).date;
    return ahead ? [{ id: 'hearing', name: `${etShortDate(hearing.date)} hearing`, shock: HEARING }, ...PRESETS] : PRESETS;
  }, [hearing, latest?.now]); // eslint-disable-line
  useEffect(() => {
    if (!preset) return;
    const s = preset.id === 'hearing' ? HEARING : PRESETS.find((p) => p.id === preset.id)?.shock;
    if (s) setShock(s);
  }, [preset]);

  const i = Number(hk), name = HORIZON_NAMES[i];
  const out = res?.out ?? null, h = out?.combined.horizons[i] ?? null, p = out?.combined.probs[i] ?? null;
  const official = output && res && outputRunId === res.base.id ? output.combined : null;
  const axis = useMemo(() => {
    if (!h) return null;
    const mine = axisOf(h, 10), o = official ? axisOf(official.horizons[i], 10) : mine;
    return { lo: Math.min(mine.lo, o.lo), hi: Math.max(o.hi, Math.ceil(h.pct.p95 / 10) * 10) };
  }, [h, official, i]);

  const set = (k: keyof Shock) => (v: number) => setShock((s) => ({ ...s, [k]: v }));
  const changed = !!res && !sameShock(res.shock, NO_SHOCK);
  const vs = (mine: number | undefined, theirs: number | undefined) => {
    if (mine === undefined || theirs === undefined) return ' ';
    const d = Math.round((mine - theirs) * 1000) / 1000;
    return <>Latest run {odds(theirs)}{changed && <> · <Change value={d} text={pts(d)} /></>}</>;
  };
  const failed = !res && !base && (error || (latestError && !latest));
  const none = !!latest && !latest.run;

  return (
    <div className="tool-grid">
      <div className="tool-side">
        <div className="tool-presets" role="group" aria-label="What-if presets">
          {!config && !res && <Skeleton h={44} w={120} />}
          {presets.map((x) => <Button key={x.id} variant={sameShock(shock, x.shock) ? 'primary' : 'secondary'} aria-pressed={sameShock(shock, x.shock)} onClick={() => setShock(x.shock)}>{x.name}</Button>)}
          <Button variant="secondary" onClick={() => setShock(NO_SHOCK)}>Reset</Button>
        </div>
        <Slider label="Drift over 1 month" min={-0.3} max={0.2} step={0.01} value={shock.drift} onChange={set('drift')} format={(v) => pctChange(v, 0)} />
        <Slider label="Jumps" min={1} max={5} step={0.1} value={shock.jumpMult} onChange={set('jumpMult')} format={(v) => v.toFixed(1) + '×'} />
        <Slider label="Volatility" min={0.5} max={3} step={0.05} value={shock.volMult} onChange={set('volMult')} format={(v) => v.toFixed(2) + '×'} />
        <HorizonTabs value={hk} onChange={setH} />
      </div>
      <div className="tool-main">
        {none ? <EmptyState text="Odds appear after the next run." />
          : failed ? <ErrorState onRetry={() => { reload(); retryBase(); }} />
          : state === 'error' ? <ErrorState text="Couldn’t run the futures. Try again." onRetry={retry} />
          : (
            <>
              <div className="row"><Pill>Hypothetical · your inputs</Pill><span className="label">{state === 'busy' ? 'Running 500,000 futures' : !res ? 'Loading the latest run' : `500,000 futures in ${(res.ms / 1000).toFixed(2)} s`}</span></div>
              <Answer live text={p ? odds(p.pUp) : null} label={out && <>of futures end above {usd(out.spot)} in {name}</>} />
              <PriceBars h={h} total={out?.totalPaths ?? 1} axis={axis} price={out?.spot ?? null}
                label={h && p && axis && out ? `Hypothetical ${symbol} price after ${name}, from ${usd(axis.lo, 0)} to ${usd(axis.hi, 0)}. ${odds(p.pUp)} of futures end above ${usd(out.spot)}.` : 'Price distribution, loading'} />
              <div className="tool-rows">
                <Stat label="Odds of ending higher" note={vs(p?.pUp, official?.probs[i].pUp)}>{p ? <NumberRoll text={odds(p.pUp)} /> : <Skeleton h="1.2em" w="3.5em" />}</Stat>
                <Stat label="Odds of a fall over 20%" note={vs(p?.pDown20, official?.probs[i].pDown20)}>{p ? <NumberRoll text={odds(p.pDown20)} /> : <Skeleton h="1.2em" w="3.5em" />}</Stat>
                <Stat label="Middle price" note={official ? `Latest run ${usd(official.horizons[i].pct.p50)}` : ' '}>{h ? <NumberRoll text={usd(h.pct.p50)} /> : <Skeleton h="1.2em" w="4.5em" />}</Stat>
              </div>
              <RunNote futures="500,000" id={res?.base.id ?? null} ts={res?.base.ts ?? null}>Same seed, your change. Scenario odds, not advice.</RunNote>
            </>
          )}
      </div>
    </div>
  );
}
