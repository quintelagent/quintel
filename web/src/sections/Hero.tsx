import { useEffect, useRef, useState } from 'react';
import { api, useApi, type Latest, type RunFull } from '../lib/api';
import { CountUp, Countdown, Gauge, Num } from '../components/ui';
import { pct, usd } from '../lib/format';
import { isMobile, reducedMotion, scrollToId, whenIdle } from '../lib/motion';
import { navigate } from '../lib/router';
import { sampleInBrowser } from '../lib/engineClient';
import type { CloudPaths } from '../three/ScenarioCloud';

interface Sample { id: number; days: number; models: CloudPaths[] }

/** Paths per model for the dense cloud generated in the browser from the run's own inputs + seed. */
const DENSE_DESKTOP = 600; // × 5 models = 3,000 paths
const DENSE_MOBILE = 120; //  × 5 models =   600 paths

/** 2D fallback for phones / low-power devices / reduced motion. */
function draw2D(canvas: HTMLCanvasElement, data: CloudPaths[], spot: number, progress: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const ends: number[] = [];
  for (const m of data) for (const p of m.paths) ends.push(p[p.length - 1]);
  const count = ends.length;
  if (!count) return;
  ends.sort((a, b) => a - b);
  const lo = Math.min(spot * 0.85, ends[Math.floor(0.02 * count)] * 0.97);
  const hi = Math.max(spot * 1.15, ends[Math.min(count - 1, Math.floor(0.98 * count))] * 1.03);
  const n = data[0].paths[0].length;
  const X = (d: number) => w * 0.06 + (d / (n - 1)) * w * 0.92;
  const Y = (p: number) => h * 0.5 + (1 - (p - lo) / (hi - lo)) * h * 0.42;
  // brighter on phones: alpha scales down only as the path count grows
  const alpha = Math.min(0.4, 6 / Math.sqrt(count));
  ctx.save();
  // keep the fan in the lower part of the hero so outliers never cross the copy
  ctx.beginPath();
  ctx.rect(0, h * 0.44, w, h * 0.56);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1;
  const upto = Math.max(1, Math.floor(progress * (n - 1)));
  for (const m of data) for (const p of m.paths) {
    const tail = p[p.length - 1] < spot * 0.85;
    ctx.strokeStyle = tail ? `rgba(255,77,94,${alpha * 1.2})` : `rgba(124,203,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(p[0]));
    // smooth through midpoints (quadratic) instead of jagged straight segments
    for (let d = 1; d < upto; d++) {
      const mx = (X(d) + X(d + 1)) / 2, my = (Y(p[d]) + Y(p[d + 1])) / 2;
      ctx.quadraticCurveTo(X(d), Y(p[d]), mx, my);
    }
    ctx.lineTo(X(upto), Y(p[upto]));
    ctx.stroke();
  }
  ctx.restore();
  // origin glow
  const g = ctx.createRadialGradient(X(0), Y(spot), 0, X(0), Y(spot), 18);
  g.addColorStop(0, 'rgba(184,230,255,0.9)');
  g.addColorStop(1, 'rgba(184,230,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(X(0) - 18, Y(spot) - 18, 36, 36);
}

function Odds({ v, label, red }: { v: number | undefined; label: string; red?: boolean }) {
  return (
    <div>
      <div className={`mono ${red ? 'red' : 'ice'}`} style={{ fontSize: 'clamp(30px, 3.4vw, 44px)', lineHeight: 1.1 }}><Num value={v} fmt={(x) => pct(x)} /></div>
      <div className="muted" style={{ fontSize: 14, maxWidth: '26ch' }}>{label}</div>
    </div>
  );
}

export function Hero() {
  const [latest] = useApi<Latest>('/api/latest', 30000);
  const [sample] = useApi<Sample>('/api/sample/latest', 120000);
  const [dense, setDense] = useState<{ runId: number; models: CloudPaths[] } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<{ dispose(): void; setScroll(k: number): void; setPaths(d: CloudPaths[], fadeIn?: boolean, spot?: number): void } | null>(null);
  const spot = latest?.run?.spot ?? null;
  const runId = latest?.run?.id ?? null;
  const sampleId = sample?.id ?? null;
  const mobile = useRef(isMobile() || reducedMotion()).current;

  // Best data available right now, keyed by content (not object identity — polls return new objects).
  const best = dense ? dense.models : sample?.models ?? null;
  const bestKey = dense ? `dense:${dense.runId}` : sampleId !== null ? `sample:${sampleId}` : null;
  const bestRef = useRef({ data: best, spot });
  bestRef.current = { data: best, spot };
  const shownKey = useRef<string | null>(null);
  const bestKeyRef = useRef(bestKey);
  bestKeyRef.current = bestKey;

  // Dense cloud: download the run's inputs + seed, then sample thousands of real paths in the Web Worker.
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    whenIdle(() => {
      if (!alive) return;
      api<RunFull>(`/api/run/${runId}`)
        .then((r) => sampleInBrowser(r.inputs, r.seed, mobile ? DENSE_MOBILE : DENSE_DESKTOP))
        .then((s) => { if (alive) setDense({ runId, models: s.models }); })
        .catch(() => {});
    }, 3000);
    return () => { alive = false; };
  }, [runId, mobile]);

  // 3D (desktop) — created exactly once, after the page is idle, from whatever data is freshest at that moment.
  const ready = !!best && !!spot;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (mobile || !canvas || !ready) return;
    let alive = true;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; cloudRef.current?.setScroll(Math.min(1, window.scrollY / window.innerHeight)); });
    };
    whenIdle(() => {
      import('../three/ScenarioCloud').then(({ ScenarioCloud }) => {
        const { data, spot: s0 } = bestRef.current;
        if (!alive || !data || !s0) return;
        cloudRef.current = new ScenarioCloud(canvas, data, s0);
        shownKey.current = bestKeyRef.current;
        canvas.classList.add('in');
      });
    }, 2000);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      alive = false;
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      cloudRef.current?.dispose();
      cloudRef.current = null;
      shownKey.current = null;
    };
  }, [ready, mobile]);

  // Swap paths in place only when the content actually changes (new run, or dense set arrived).
  useEffect(() => {
    if (mobile || !cloudRef.current || !best || !spot || bestKey === shownKey.current) return;
    cloudRef.current.setPaths(best, true, spot);
    shownKey.current = bestKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestKey, mobile]);

  // 2D (phones / reduced motion): the draw-in sweep plays once; later updates redraw instantly.
  const swept = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!mobile || !canvas || !best || !spot) return;
    canvas.classList.add('in');
    const data = best;
    let k = reducedMotion() || swept.current ? 1 : 0;
    swept.current = true;
    let raf = 0;
    const step = () => { k = Math.min(1, k + 0.015); draw2D(canvas, data, spot, k); if (k < 1) raf = requestAnimationFrame(step); };
    step();
    const onR = () => draw2D(canvas, data, spot, 1);
    window.addEventListener('resize', onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestKey, spot, mobile]);

  const run = latest?.run;
  const event = run?.summary.event ?? null;
  const touch = run?.summary.touch ?? null;
  return (
    <header style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden' }} className="grid-bg">
      <canvas ref={canvasRef} aria-hidden className="hero-canvas" />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(6,8,11,0.82) 0%, rgba(6,8,11,0.55) 38%, rgba(6,8,11,0) 62%), radial-gradient(ellipse at 60% 50%, rgba(6,8,11,0), rgba(6,8,11,0.8) 78%)', pointerEvents: 'none' }} />
      <div className="wrap" style={{ position: 'relative', width: '100%', paddingTop: 110, paddingBottom: 60 }} data-hero-copy>
        <div className="eyebrow">
          <span>{latest ? `Live · ${latest.session === 'open' ? 'Market open' : 'Market closed — priced off the on-chain token'}` : 'Live'}</span>
        </div>
        <h1 style={{ fontSize: 'clamp(44px, 7vw, 92px)', lineHeight: 0.98, margin: '22px 0 22px', maxWidth: '13ch' }}>
          {event ? `NVDA ${event.pct >= 0 ? '+' : ''}${Math.round(event.pct * 100)}% in a day.` : 'NVDA moved fast.'} Does it hold?
        </h1>
        <p style={{ fontSize: 'clamp(19px, 2vw, 26px)', color: 'var(--ice)', margin: '0 0 12px' }}>1,000,000 futures, every 10 minutes.</p>
        <p className="lede" style={{ maxWidth: '52ch' }}>
          {event && <>{new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}: {usd(event.prevClose)} → {usd(event.close)}. </>}
          Five models and an AI research agent turn NVDA’s possible paths into scenario odds — every 30 minutes while the market is closed.
        </p>
        <div className="odds-row">
          <Odds v={touch?.backAbove.p} label={touch ? `close back above ${usd(touch.backAbove.level)} within 1 month` : 'back above the pre-drop level within 1 month'} />
          <Odds v={touch?.giveBack.p} red label={touch && event ? `give back half of the ${new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} gain (${usd(touch.giveBack.level)}) within 1 week` : 'give back half of the gain within 1 week'} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Scenario odds: share of simulated paths with at least one daily close past the level. Not advice.</div>
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
            <div className="mono" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', marginTop: 8, letterSpacing: '-0.02em', minHeight: '1.2em' }}>
              {latest ? <CountUp value={latest.scenariosToday} start={0} duration={1600} /> : '—'}
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
      <style>{`
        .odds-row { display: flex; gap: 36px; margin-top: 26px; flex-wrap: wrap; }
        .hero-canvas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 1.4s ease; }
        .hero-canvas.in { opacity: .95; }
      `}</style>
    </header>
  );
}
