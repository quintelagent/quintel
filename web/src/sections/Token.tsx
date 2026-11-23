import { useData } from '../lib/data';
import { CopyButton, SectionHead } from '../components/ui';

function Addr({ label, chain, addr }: { label: string; chain: string; addr: string | null }) {
  return (
    <div className="panel">
      <div className="label">{chain}</div>
      <div style={{ fontSize: 22, margin: '8px 0 14px' }}>{label}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <code className="mono" style={{ fontSize: 13, wordBreak: 'break-all', color: addr ? 'var(--text)' : 'var(--dim)', flex: 1, minWidth: 0 }}>
          {addr || 'Contract address published at launch'}
        </code>
        {addr && <CopyButton text={addr} />}
      </div>
    </div>
  );
}

export function Token() {
  const { config } = useData();
  return (
    <section className="block" id="token" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <SectionHead eyebrow="$QNTL" title="The coin that pays for the compute." lede="$QNTL launches on Pons (Robinhood Chain) and Pump.fun (Solana). The 3% creator fee pays for the engine, the market data and the AI — nothing about the coin changes the odds, and holding it is not a share of anything." />
        <div className="tok-grid reveal">
          <Addr label="$QNTL on Pons" chain="Robinhood Chain" addr={config?.tokens.pons ?? null} />
          <Addr label="$QNTL on Pump.fun" chain="Solana" addr={config?.tokens.solana ?? null} />
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Always check addresses against this page and the official X account (@quintelagent). Not financial advice.</p>
      </div>
      <style>{`.tok-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; } @media (max-width: 800px) { .tok-grid { grid-template-columns: 1fr; } }`}</style>
    </section>
  );
}
