import { useMemo } from 'react';
import { MODEL_INFO } from '@engine/models/common';
import type { ModelOut, RunOutput } from '@engine/types';
import { Card, EmptyState, ErrorState, NumberRoll, Pill, Section, Skeleton, Stat } from '../components/ui';
import { PixelBars, PixelMeter } from '../components/pixel';
import { useData } from '../lib/data';
import { etTime, int, odds, usd } from '../lib/format';
import { useLaptop, useNow } from '../lib/hooks';
import { isDelayed } from '../lib/marketState';
import { DEFAULT_SYMBOL, symbolConfig } from '../lib/symbols';
import './models.css';

const IDS = Object.keys(MODEL_INFO);
const MONTH = 2; // index of the 21-day horizon
const MAX_COLS = 30;

/** Split "a — b." into two plain sentences. */
const plain = (s: string) => s.replace(/\s*—\s*(\w)/g, (_, c: string) => '. ' + c.toUpperCase());

/** The engine’s end buckets also hold everything beyond them. */
interface Spread { lo: number; hi: number; loOpen: boolean; hiOpen: boolean; spotAt: number; cols: Record<string, number[]>; below: (i: number) => boolean }

/** One shared price scale: drops end buckets where every model has under 0.5% of its paths, then merges to fit a small card. */
function spread(o: RunOutput): Spread | null {
  const ms = o.models.map((m) => m.horizons[MONTH]?.hist);
  const base = ms[0];
  if (!base || ms.some((h) => !h || h.counts.length !== base.counts.length)) return null;
  const n = base.counts.length, width = (base.hi - base.lo) / n;
  const seen = (i: number) => o.models.some((m, k) => ms[k].counts[i] / m.paths >= 0.005);
  let a = 0, b = n - 1;
  while (a < b && !seen(a)) a++;
  while (b > a && !seen(b)) b--;
  const step = Math.max(1, Math.ceil((b - a + 1) / MAX_COLS)), count = Math.ceil((b - a + 1) / step);
  const lo = base.lo + a * width, hi = lo + count * step * width;
  const cols: Record<string, number[]> = {};
  o.models.forEach((m, k) => {
    cols[m.id] = Array.from({ length: count }, (_, i) => ms[k].counts.slice(a + i * step, a + (i + 1) * step).reduce((x, y) => x + y, 0));
  });
  return { lo, hi, loOpen: a === 0, hiOpen: b === n - 1, spotAt: (o.spot - lo) / (hi - lo), cols, below: (i) => lo + (i + 0.5) * step * width < o.spot };
}

function ModelCard({ id, m, s }: { id: string; m: ModelOut | undefined; s: Spread | null }) {
  const info = MODEL_INFO[id];
  const p = m?.horizons[MONTH]?.pct;
  const aria = p ? `${info.name}: distribution of prices 1 month out. Median ${usd(p.p50)}, middle half from ${usd(p.p25)} to ${usd(p.p75)}.` : `${info.name}: distribution of prices 1 month out, loading`;
  return (
    <Card as="li" className="models-card">
      <h3>{info.name}</h3>
      <p className="note models-line">{plain(info.oneLiner)}</p>
      <Stat label="Odds of a rise in 1 month">{m ? <NumberRoll text={odds(m.pUp1m)} /> : <Skeleton h={24} w={72} />}</Stat>
      <div>
        <PixelBars values={s?.cols[id] ?? null} risk={s?.below} marker={s?.spotAt ?? null} label={aria} height={96} />
        <div className="models-axis small mono" aria-hidden="true">{s ? <><span>{usd(s.lo, 0)}{s.loOpen && ' or less'}</span><span>{usd(s.hi, 0)}{s.hiOpen && ' or more'}</span></> : <span>&nbsp;</span>}</div>
      </div>
    </Card>
  );
}

export function Models({ symbol = DEFAULT_SYMBOL }: { symbol?: string }) {
  const { latest, latestError, reload, output, outputRunId, outputError, reloadOutput, runs } = useData();
  const laptop = useLaptop();
  const now = useNow(60000);
  const s = useMemo(() => (output ? spread(output) : null), [output]);
  const run = latest?.run;
  const ts = outputRunId === run?.id ? run?.ts : runs?.find((r) => r.id === outputRunId)?.ts;
  const failed = !output && ((latestError && !latest) || outputError);
  const none = !output && latest && !run;
  const up = output?.combined.probs[MONTH]?.pUp;

  return (
    <Section id="models" title="Five models. One set of odds." sub="Each model reads the same price history and makes different assumptions. Together they make 1,000,000 futures, 200,000 each.">
      {failed ? (
        <Card><ErrorState onRetry={() => (latest ? reloadOutput() : reload())} /></Card>
      ) : none ? (
        <Card><EmptyState text="No runs yet. The odds appear after the first run." /></Card>
      ) : (
        <div className="models">
          <Card className="models-sum">
            <Stat label="All five together" note={`odds of a rise in ${symbolConfig(symbol).symbol} in 1 month`}>
              {output ? <NumberRoll text={odds(up)} /> : <Skeleton h={24} w={72} />}
            </Stat>
            <Stat label="Model agreement" note="How close the five medians and spreads are. 100 means identical.">
              {output ? <span className="models-agree">{int(output.agreement)} of 100<PixelMeter value={output.agreement / 100} label={`Model agreement ${int(output.agreement)} of 100`} /></span> : <Skeleton h={24} w={160} />}
            </Stat>
            <Stat label="From" note={<span className="models-when">{!output ? <>&nbsp;</> : ts ? etTime(ts) : 'latest full output'}{isDelayed(ts, now) && <Pill tone="muted">Delayed</Pill>}</span>}>
              {output ? (outputRunId ? `Run ${outputRunId}` : 'Latest run') : <Skeleton h={24} w={96} />}
            </Stat>
          </Card>
          <div className="models-row" role="region" aria-label="The five models" tabIndex={laptop ? undefined : 0}>
            <ul className="models-list">
              {IDS.map((id) => <ModelCard key={id} id={id} m={output?.models.find((m) => m.id === id)} s={s} />)}
            </ul>
          </div>
          <p className="note models-key">
            Each chart is that model’s own spread of prices 1 month out, on one shared scale. The dashed line is the price the run starts from: ink is above it, hollow red is below. Ends too thin to draw are left out.
          </p>
        </div>
      )}
    </Section>
  );
}
