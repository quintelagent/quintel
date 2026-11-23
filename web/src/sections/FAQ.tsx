import { useState } from 'react';
import { SectionHead } from '../components/ui';
import { onLink } from '../lib/router';

const QA: [string, React.ReactNode][] = [
  ['What is this?', 'Quintel is a live scenario engine for NVDA stock. Every 10 minutes during market hours (every 30 minutes when the market is closed) it simulates 1,000,000 possible price paths with five different quant models, turns them into scenario odds, and has an AI research agent explain what changed.'],
  ['Is it financial advice?', 'No. Scenario odds describe what the models produce from past prices and current inputs — they are not predictions and not recommendations. The paper desk uses virtual money only.'],
  ['How often does it run?', 'Every 10 minutes while the US stock market is open, and every 30 minutes when it is closed (priced off the 24/7 on-chain NVDA token). Briefings are written every 30 minutes, or immediately after big news or a move over 3%.'],
  ['How do I verify a run?', <>Open <a href="/verify" onClick={onLink}>/verify</a>, pick a run, and your browser re-runs the full million paths from the stored inputs and seed and checks the hash. The hour’s fingerprint is on Robinhood Chain. The CLI method is in <a href="/docs/proof" onClick={onLink}>PROOF</a>.</>],
  ['What can’t it do?', <>It can’t know the future, it doesn’t model order flow or options markets, and its models are calibrated on past prices. The full list is in <a href="/docs/limits" onClick={onLink}>LIMITS</a>.</>],
  ['What does the coin do?', 'The creator fee pays for compute, market data and AI calls. The coin does not influence any output.'],
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="block" id="faq" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap" style={{ maxWidth: 900 }}>
        <SectionHead eyebrow="FAQ" title="Questions, answered plainly." />
        <div className="reveal">
          {QA.map(([q, a], i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '22px 0', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: 19 }}>
                <span>{q}</span><span className="mono ice">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <div className="muted" style={{ paddingBottom: 22, fontSize: 16, maxWidth: '70ch' }}>{a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
