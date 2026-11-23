import { useEffect, useRef } from 'react';
import { useApi, type Latest } from '../lib/api';
import { CountUp, Countdown, Gauge } from '../components/ui';
import { isMobile, reducedMotion, scrollToId } from '../lib/motion';
import { navigate } from '../lib/router';
import type { CloudPaths } from '../three/ScenarioCloud';

interface Sample { id: number; days: number; models: CloudPaths[] }

/** 2D fallback for phones / low-power devices / reduced motion. */
function draw2D(canvas: HTMLCanvasElement, data: CloudPaths[], spot: number, progress: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const all = data.flatMap((m) => m.paths.flat());
  if (!all.length) return;
  const lo = Math.min(...all), hi = Math.max(...all);
  const X = (d: number, n: number) => w * 0.08 + (d / (n - 1)) * w * 0.9;
  const Y = (p: number) => h * 0.2 + (1 - (p - lo) / (hi - lo)) * h * 0.6;
  ctx.globalCompositeOperation = 'lighter';
  for (const m of data) for (const p of m.paths) {
    const tail = p[p.length - 1] < spot * 0.85;
    ctx.strokeStyle = tail ? 'rgba(255,77,94,0.22)' : 'rgba(124,203,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const upto = Math.max(1, Math.floor(progress * (p.length - 1)));
    for (let d = 0; d <= upto; d++) (d ? ctx.lineTo(X(d, p.length), Y(p[d])) : ctx.moveTo(X(d, p.length), Y(p[d])));
    ctx.stroke();
  }
}

export function Hero() {
  const [latest] = useApi<Latest>('/api/latest', 30000);
  const [sample] = useApi<Sample>('/api/sample/latest', 120000);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spot = latest?.run?.spot ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample || !spot) return;
    let cleanup = () => {};
    if (isMobile() || reducedMotion()) {
      let k = reducedMotion() ? 1 : 0;
      let raf = 0;
      const step = () => { k = Math.min(1, k + 0.012); draw2D(canvas, sample.models, spot, k); if (k < 1) raf = requestAnimationFrame(step); };
      step();
      const onR = () => draw2D(canvas, sample.models, spot, 1);
      window.addEventListener('resize', onR);
      cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
    } else {
      let cloud: { dispose(): void; setScroll(k: number): void } | null = null;
      let alive = true;
      import('../three/ScenarioCloud').then(({ ScenarioCloud }) => {
        if (!alive) return;
        cloud = new ScenarioCloud(canvas, sample.models, spot);
      });
      const onScroll = () => cloud?.setScroll(Math.min(1, window.scrollY / window.innerHeight));
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanup = () => { alive = false; cloud?.dispose(); window.removeEventListener('scroll', onScroll); };
    }
    return cleanup;
  }, [sample, spot]);

  const run = latest?.run;
  return (
    <header style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden' }} className="grid-bg">
      <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.95 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(6,8,11,0.2), rgba(6,8,11,0.85) 70%)', pointerEvents: 'none' }} />
      <div className="wrap" style={{ position: 'relative', width: '100%', paddingTop: 110, paddingBottom: 60 }}>
        <div className="eyebrow">
          <span>Live · {latest?.session === 'open' ? 'Market open' : 'Market closed — priced off the on-chain token'}</span>
        </div>
        <h1 style={{ fontSize: 'clamp(48px, 7.4vw, 96px)', lineHeight: 0.98, margin: '22px 0 22px', maxWidth: '13ch' }}>
          1,000,000 futures for NVDA. <span style={{ color: 'var(--ice)' }}>Every 10 minutes.</span>
        </h1>
        <p className="lede" style={{ maxWidth: '52ch' }}>
          An AI research agent and five quant models simulate NVDA’s possible paths, turn them into scenario odds, explain what changed — and fingerprint every hour on Robinhood Chain.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 34, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => scrollToId('tools')}>Try the tools</button>
          <button className="btn" onClick={() => navigate(run ? `/verify?run=${run.id}` : '/verify')}>Verify a run →</button>
        </div>

        <div style={{ display: 'flex', gap: 28, marginTop: 56, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="panel" style={{ padding: '16px 20px' }}>
            <Gauge value={run?.crisis ?? null} size={150} />
          </div>
          <div className="panel" style={{ minWidth: 260 }}>
            <div className="label"><span className="dot live" style={{ marginRight: 8 }} />Scenarios run today</div>
            <div className="mono" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', marginTop: 8, letterSpacing: '-0.02em' }}>
              {latest ? <CountUp value={latest.scenariosToday} /> : '—'}
            </div>
            <div className="hr" style={{ margin: '14px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <div className="label">Next run in</div>
                <div className="mono" style={{ fontSize: 20, marginTop: 4 }}><Countdown to={latest?.nextRunAt} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label">Starting price</div>
                <div className="mono" style={{ fontSize: 20, marginTop: 4 }}>{spot ? '$' + spot.toFixed(2) : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
