import { useEffect, useMemo, useState } from 'react';
import type { HorizonStats } from '@engine/types';
import { useData } from '../lib/data';
import { DistDrag } from '../components/charts';
import { SectionHead, Skeleton } from '../components/ui';
import { pct, usd } from '../lib/format';

/** P(price < v) from a histogram, interpolating linearly inside a bucket. */
export function cdfFromHist(h: HorizonStats, v: number, total: number): number {
  const { lo, hi, counts } = h.hist;
  if (v <= lo) return counts[0] ? 0 : 0;
  if (v >= hi) return 1;
  const w = (hi - lo) / counts.length;
  const k = Math.floor((v - lo) / w);
  let s = 0;
  for (let i = 0; i < k; i++) s += counts[i];
  s += counts[k] * ((v - lo - k * w) / w);
  return s / total;
}

export function DragPrice() {
  const { output } = useData();
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    if (output && price === null) setPrice(Math.round(output.spot * 0.9));
  }, [output, price]);
  const rows = useMemo(() => {
    if (!output || price === null) return [];
    return output.combined.horizons.map((h, i) => ({
      label: ['Next close', '1 week', '1 month'][i],
      below: cdfFromHist(h, price, output.totalPaths),
    }));
  }, [output, price]);

  return (
    <section className="block" id="tools">
      <div className="wrap">
        <SectionHead eyebrow="Tool 01 · Drag a price" title="Pick a price. See how many futures end below it." lede="Drag the line across the combined one-month distribution of the latest 1,000,000 scenarios. The odds update for every horizon as you move." />
        {!output || price === null ? <Skeleton h={330} label="Loading the latest run" /> : (
          <div className="panel reveal drag-grid fade-in">
            <div>
              <DistDrag hist={output.combined.horizons[2].hist} spot={output.spot} value={price} onChange={(v) => setPrice(Math.round(v * 100) / 100)} />
              <div className="muted mono" style={{ fontSize: 12, marginTop: 10 }}>← drag · red = scenarios ending below your line (1-month distribution shown)</div>
            </div>
            <div>
              <div className="label">Your price</div>
              <div className="mono" style={{ fontSize: 40, margin: '6px 0 18px' }}>{usd(price)}</div>
              {rows.map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="muted">{r.label}</span>
                  <span className="mono" style={{ fontSize: 20 }}>
                    <span className={r.below > 0.5 ? 'red' : ''}>{pct(r.below, 1)}</span> <span className="dim" style={{ fontSize: 13 }}>end below</span>
                  </span>
                </div>
              ))}
              <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>Scenario odds from the latest official run. Not a prediction, not advice.</div>
            </div>
          </div>
        )}
      </div>
      <style>{`.drag-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 36px; } @media (max-width: 900px) { .drag-grid { grid-template-columns: 1fr; } }`}</style>
    </section>
  );
}
