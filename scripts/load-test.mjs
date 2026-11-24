#!/usr/bin/env node
// Load test against our own site: visitors who open the home page, load its data, then stay and poll.
//   node scripts/load-test.mjs --visitors 500 --ramp 60 --hold 90
// Read only (GET). Stops early if errors pass 5%.
const a = process.argv.slice(2), num = (k, d) => { const i = a.indexOf('--' + k); return i < 0 ? d : Number(a[i + 1]); };
const SITE = 'https://quintelagent.com', V = num('visitors', 500), RAMP = num('ramp', 60), HOLD = num('hold', 90), POLL = 30;
const stats = new Map(); let total = 0, errors = 0, stop = false, active = 0, peak = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, kind) {
  if (stop) return null;
  const t = performance.now(); let ok = false, status = 0, body = null;
  try { const r = await fetch(SITE + path, { headers: { 'user-agent': 'quintel-load-test', accept: '*/*' }, signal: AbortSignal.timeout(20000) }); status = r.status; body = await r.text(); ok = r.ok; } catch (e) { status = e.name; }
  const s = stats.get(kind) ?? { ms: [], bad: {} }; s.ms.push(performance.now() - t); if (!ok) { errors++; s.bad[status] = (s.bad[status] ?? 0) + 1; } stats.set(kind, s);
  total++; if (total > 200 && errors / total > 0.05) stop = true;
  return body;
}
async function visitor(i, end) {
  await sleep((i / V) * RAMP * 1000); if (stop) return;
  active++; peak = Math.max(peak, active);
  const html = await get('/', 'page') ?? '';
  const assets = [...html.matchAll(/\/assets\/[\w.-]+\.(?:js|css)/g)].map((m) => m[0]);
  await Promise.all(assets.map((p) => get(p, 'asset')));
  const latest = await get('/api/latest', 'latest'); let id = 0; try { id = JSON.parse(latest).run.id; } catch { /* counted */ }
  const since = new Date(Math.floor(Date.now() / 3600000) * 3600000 - 24 * 3600000).toISOString();
  await Promise.all([get('/api/config', 'config'), get('/api/briefings?limit=20', 'briefings'), get('/api/proof', 'proof'), get('/api/desk', 'desk'), id ? get('/api/output/' + id, 'output') : null, get(`/api/runs?since=${encodeURIComponent(since)}&limit=200`, 'runs')]);
  if (i % 10 === 0 && id) await get('/api/run/' + id, 'run (verify)');
  let n = 0;
  while (Date.now() < end && !stop) { await sleep(POLL * 1000 * (0.9 + (i % 20) / 100)); if (Date.now() >= end) break; await get('/api/latest', 'latest'); if (++n % 2 === 0) await Promise.all([get('/api/briefings?limit=20', 'briefings'), get('/api/proof', 'proof')]); }
  active--;
}
const t0 = Date.now(), end = t0 + (RAMP + HOLD) * 1000;
const tick = setInterval(() => console.log(`${Math.round((Date.now() - t0) / 1000)}s  visitors ${active}  requests ${total}  errors ${errors}`), 15000);
await Promise.all(Array.from({ length: V }, (_, i) => visitor(i, end)));
clearInterval(tick);
const q = (x, p) => Math.round(x.sort((m, n) => m - n)[Math.min(x.length - 1, Math.floor(x.length * p))]);
console.log(`\n${stop ? 'STOPPED EARLY · ' : ''}peak visitors ${peak} · ${total} requests in ${Math.round((Date.now() - t0) / 1000)}s · ${errors} errors (${((errors / total) * 100).toFixed(2)}%)`);
for (const [k, s] of [...stats].sort()) console.log(`${k.padEnd(14)} n ${String(s.ms.length).padStart(5)}  p50 ${String(q(s.ms, 0.5)).padStart(5)}ms  p95 ${String(q(s.ms, 0.95)).padStart(5)}ms  p99 ${String(q(s.ms, 0.99)).padStart(5)}ms  ${Object.keys(s.bad).length ? JSON.stringify(s.bad) : ''}`);
process.exit(stop || errors / total > 0.01 ? 1 : 0);
