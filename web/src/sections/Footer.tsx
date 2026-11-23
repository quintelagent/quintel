import { useData } from '../lib/data';
import { Logo } from '../components/ui';
import { onLink } from '../lib/router';
import { LINKS } from '../lib/links';

export function Footer() {
  const { config } = useData();
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '64px 0 40px', background: 'var(--surface)' }}>
      <div className="wrap">
        <div className="ft-grid">
          <div>
            <Logo />
            <p className="muted" style={{ fontSize: 14, marginTop: 14, maxWidth: '36ch' }}>1,000,000 futures for NVDA. Every 10 minutes. Open source, verifiable, fingerprinted on-chain.</p>
          </div>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <span className="label">Product</span>
            <a href="/verify" onClick={onLink}>Verify a run</a>
            <a href="/briefings" onClick={onLink}>Briefing archive</a>
            <a href="/docs" onClick={onLink}>Docs</a>
            <a href="/api/latest">API</a>
          </div>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <span className="label">Community</span>
            <a href={LINKS.github} target="_blank" rel="noreferrer">GitHub</a>
            <a href={LINKS.x} target="_blank" rel="noreferrer">X · @quintelagent</a>
          </div>
          <div style={{ display: 'grid', gap: 8, fontSize: 12 }} className="mono">
            <span className="label">$QNTL</span>
            <span className="muted" style={{ wordBreak: 'break-all' }}>Pons: {config?.tokens.pons || 'at launch'}</span>
            <span className="muted" style={{ wordBreak: 'break-all' }}>Solana: {config?.tokens.solana || 'at launch'}</span>
          </div>
        </div>
        <div className="hr" style={{ margin: '40px 0 20px' }} />
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice. Scenario odds are model outputs, not predictions. The paper desk uses virtual money only.
        </p>
      </div>
      <style>{`.ft-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.4fr; gap: 32px; } @media (max-width: 800px) { .ft-grid { grid-template-columns: 1fr 1fr; } }`}</style>
    </footer>
  );
}
