import { useApi, type Briefing } from '../lib/api';
import { BriefingCard } from '../sections/Briefing';
import { Empty } from '../components/ui';

export function Briefings() {
  const [items] = useApi<Briefing[]>('/api/briefings?limit=50', 120000);
  return (
    <main style={{ paddingTop: 120, paddingBottom: 100, minHeight: '100vh' }}>
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="eyebrow">Archive</div>
        <h1 style={{ fontSize: 'clamp(38px, 5vw, 64px)', margin: '18px 0 36px' }}>Every briefing, as published.</h1>
        {!items ? <Empty>Loading…</Empty> : items.length === 0 ? <Empty>No briefings yet.</Empty> : (
          <div style={{ display: 'grid', gap: 18 }}>{items.map((b) => <BriefingCard key={b.id} b={b} />)}</div>
        )}
      </div>
    </main>
  );
}
