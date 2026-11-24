import { useState } from 'react';
import { SectionHead } from '../components/ui';

const NODES = [
  { id: 'data', x: 70, y: 160, t: 'Data', d: 'Stock price, 3 years of daily closes, the 24/7 on-chain token price and the latest headlines — every 10 minutes.' },
  { id: 'triage', x: 230, y: 160, t: 'Agent triage', d: 'A fast model scores each headline for relevance; the scores become a news-intensity input that raises jump odds.' },
  { id: 'm1', x: 420, y: 40, t: 'Random walk', d: '200,000 paths with today’s volatility.' },
  { id: 'm2', x: 420, y: 100, t: 'Jump', d: '200,000 paths with sudden gaps.' },
  { id: 'm3', x: 420, y: 160, t: 'History replay', d: '200,000 paths built from real past weeks.' },
  { id: 'm4', x: 420, y: 220, t: 'Vol clusters', d: '200,000 paths where storms follow storms.' },
  { id: 'm5', x: 420, y: 280, t: 'Bounce', d: '200,000 paths pulled toward the moving average.' },
  { id: 'odds', x: 610, y: 160, t: 'Odds', d: 'One million terminal prices become percentiles, histograms, probabilities and the Stress Level.' },
  { id: 'brief', x: 760, y: 90, t: 'Briefing', d: 'A stronger model explains what changed. Code rejects any number not in the run and any advice wording.' },
  { id: 'desk', x: 760, y: 230, t: 'Desk', d: 'The paper desk applies its published rules to the new odds and marks to market.' },
  { id: 'chain', x: 910, y: 160, t: 'Fingerprint', d: 'Every hour, all hashes are combined into one and written to Robinhood Chain.' },
];
const EDGES = [
  ['data', 'triage'], ['triage', 'm1'], ['triage', 'm2'], ['triage', 'm3'], ['triage', 'm4'], ['triage', 'm5'],
  ['m1', 'odds'], ['m2', 'odds'], ['m3', 'odds'], ['m4', 'odds'], ['m5', 'odds'],
  ['odds', 'brief'], ['odds', 'desk'], ['brief', 'chain'], ['desk', 'chain'],
];

export function HowItWorks() {
  const [active, setActive] = useState('odds');
  const by = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const sel = by[active];
  return (
    <section className="block" id="how" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <SectionHead eyebrow="How it works" title="One pipeline. Every 10 minutes." lede="Tap any node." />
        <div className="panel reveal grid-bg" style={{ padding: '24px 12px' }}>
          <div className="scroll-x">
            <svg viewBox="0 0 980 320" style={{ width: '100%', minWidth: 720, height: 'auto', display: 'block' }} role="img" aria-label="Pipeline diagram">
              <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <linearGradient id="edge" x1="0" x2="1"><stop offset="0" stopColor="#2B7FB8" stopOpacity=".2" /><stop offset="1" stopColor="#7CCBFF" stopOpacity=".7" /></linearGradient>
              </defs>
              {EDGES.map(([a, b], i) => {
                const A = by[a], B = by[b];
                const mx = (A.x + B.x) / 2;
                const d = `M ${A.x} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${B.x} ${B.y}`;
                const hot = a === active || b === active;
                return (
                  <g key={i}>
                    <path d={d} stroke="url(#edge)" strokeWidth={hot ? 2 : 1} fill="none" opacity={hot ? 1 : 0.5} />
                    <circle r="2.6" fill="#B8E6FF" filter="url(#glow)">
                      <animateMotion dur={`${2.4 + (i % 4) * 0.4}s`} repeatCount="indefinite" path={d} begin={`${(i * 0.37) % 2}s`} />
                    </circle>
                  </g>
                );
              })}
              {NODES.map((n) => {
                const on = n.id === active;
                const w = Math.max(84, n.t.length * 8.4 + 28);
                return (
                  <g key={n.id} transform={`translate(${n.x - w / 2}, ${n.y - 17})`} onClick={() => setActive(n.id)} onMouseEnter={() => setActive(n.id)} style={{ cursor: 'pointer' }} tabIndex={0} onFocus={() => setActive(n.id)}>
                    <rect width={w} height="34" rx="17" fill={on ? 'rgba(124,203,255,0.16)' : '#0C1117'} stroke={on ? '#7CCBFF' : '#243042'} filter={on ? 'url(#glow)' : undefined} />
                    <text x={w / 2} y="21.5" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="12" fill={on ? '#EAF2F8' : '#8A99A8'}>{n.t}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ padding: '10px 14px 0', minHeight: 56 }}>
            <span className="label ice">{sel.t}</span>
            <p style={{ margin: '6px 0 0', fontSize: 16 }}>{sel.d}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
