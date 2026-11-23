import { useData } from '../lib/data';
import { MiniDist } from '../components/charts';
import { Num, SectionHead, Skeleton } from '../components/ui';
import { MODEL_COLORS, pct, usd } from '../lib/format';
import { MODEL_INFO } from '@engine/models/common';

export function Models() {
  const { output } = useData();
  return (
    <section className="block" id="models" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <SectionHead eyebrow="Five models × 200,000 paths" title="Five ways to imagine the next month." lede="Each model sees the same price history and makes different assumptions. Where they agree, the odds are sturdier. Where they don’t, you see it." />
        {!output ? <Skeleton h={420} label="Loading model results" /> : (
          <div className="fade-in">
            <div className="panel reveal" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <div className="label">Model agreement</div>
                <div className="mono" style={{ fontSize: 34 }}><Num value={output.agreement} fmt={(x) => String(Math.round(x))} /><span className="dim" style={{ fontSize: 16 }}>/100</span></div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${output.agreement}%`, height: '100%', background: 'linear-gradient(90deg, var(--ice-deep), var(--ice))', boxShadow: '0 0 12px var(--ice)', transition: 'width 1s' }} />
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>How close the five 1-month medians and spreads are to each other. 100 = identical.</div>
              </div>
            </div>
            <div className="models-grid">
              {output.models.map((m, i) => {
                const h = m.horizons[2];
                const info = MODEL_INFO[m.id];
                return (
                  <div key={m.id} className="panel reveal" data-delay={String(i * 0.06)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="dot" style={{ background: MODEL_COLORS[m.id], boxShadow: `0 0 10px ${MODEL_COLORS[m.id]}` }} />
                      <span className="label" style={{ color: 'var(--text)' }}>{info.name}</span>
                    </div>
                    <p className="muted" style={{ fontSize: 14, minHeight: 66, margin: '12px 0' }}>{info.oneLiner}</p>
                    <MiniDist hist={h.hist} spot={output.spot} color={MODEL_COLORS[m.id]} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                      <div><div className="label">1m median</div><div className="mono">{usd(h.pct.p50)}</div></div>
                      <div><div className="label">P(up)</div><div className="mono">{pct(m.pUp1m)}</div></div>
                      <div style={{ gridColumn: 'span 2' }}><div className="label">90% range</div><div className="mono" style={{ fontSize: 14 }}><span className="red">{usd(h.pct.p5, 0)}</span> – {usd(h.pct.p95, 0)}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <style>{`.models-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; } @media (max-width: 1100px) { .models-grid { grid-template-columns: repeat(2, 1fr); } } @media (max-width: 560px) { .models-grid { grid-template-columns: 1fr; } }`}</style>
    </section>
  );
}
