import { useApi, type Briefing as B } from '../lib/api';
import { useData } from '../lib/data';
import { Countdown, Empty, SectionHead } from '../components/ui';
import { etTime, short } from '../lib/format';
import { onLink } from '../lib/router';

export function BriefingCard({ b }: { b: B }) {
  const x = b.body;
  const list = (title: string, items: string[], red = false) => (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
        {items.map((t, i) => <li key={i} className={red ? '' : ''} style={{ color: 'var(--text)' }}>{t}</li>)}
      </ul>
    </div>
  );
  return (
    <article className="panel">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <span className="tag">{etTime(b.ts)}</span>
        <span className="tag">run #{b.run_id}</span>
        {b.fallback ? <span className="tag">templated · numbers only</span> : <span className="tag">guard-checked</span>}
        {x.trigger && x.trigger !== 'schedule' && <span className="tag warn">{x.trigger.replace('_', ' ')}</span>}
        <span className="mono dim" style={{ fontSize: 11 }}>hash {short(b.hash)}</span>
      </div>
      <h3 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.2, marginBottom: 14 }}>{x.headline}</h3>
      <p className="muted" style={{ fontSize: 17, marginTop: 0 }}>{x.scenarioSummary}</p>
      <div className="br-grid">
        {list('What changed', x.whatChanged)}
        {list('Key risks', x.keyRisks, true)}
        {list('Watch next', x.watchNext)}
      </div>
      {x.sources.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div className="label" style={{ marginBottom: 8 }}>Sources</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {x.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer nofollow" style={{ fontSize: 14 }}>{s.title} ↗</a>)}
          </div>
        </div>
      )}
      <style>{`.br-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 22px; } @media (max-width: 900px) { .br-grid { grid-template-columns: 1fr; } }`}</style>
    </article>
  );
}

export function Briefing() {
  const [items] = useApi<B[]>('/api/briefings?limit=1', 60000);
  const { latest } = useData();
  const b = items?.[0];
  return (
    <section className="block" id="briefing" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <SectionHead eyebrow="Research agent · Briefing" title="What changed, in plain English." lede="An AI research agent reads the news, compares the latest run with the previous one and writes a short briefing. Code — not the prompt — checks every number against the run and blocks advice language before it is published." />
        {b ? <div className="reveal"><BriefingCard b={b} /></div> : <Empty>The first briefing is written right after the first run.</Empty>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
          <span className="mono muted" style={{ fontSize: 13 }}>Next briefing in <Countdown to={latest?.nextBriefingAt} /></span>
          <a href="/briefings" onClick={onLink} className="mono" style={{ fontSize: 13 }}>Briefing archive →</a>
        </div>
      </div>
    </section>
  );
}
