import { sessionAt } from '../../worker/src/session';

/** Everything the monitor looks at. `null` means the request failed. Public endpoints only. */
export interface Snapshot { site: { status: number; ok: boolean } | null; verify: { status: number; ok: boolean } | null; latest: any | null; health: any | null; proof: any | null; briefings: any[] | null; gasEth: number | null }
export interface Problem { id: string; title: string; text: string; urgent: boolean }

const min = (from: string | null | undefined, now: Date) => (from ? (now.getTime() - new Date(from).getTime()) / 60000 : Infinity);
const m = (x: number) => (x === Infinity ? 'unknown' : `${Math.round(x)} min`);

/** Plain list of what is wrong right now. */
export function check(s: Snapshot, now: Date): Problem[] {
  const out: Problem[] = [];
  const add = (id: string, title: string, text: string, urgent = false) => out.push({ id, title, text, urgent });
  if (!s.site?.ok) add('site', 'Site is down', s.site ? `quintelagent.com answered ${s.site.status} or an unexpected page.` : 'quintelagent.com did not answer.', true);
  else if (!s.verify?.ok) add('verify', 'Verify page is down', '/verify did not load.');
  if (!s.latest || !s.health) add('api', 'API is down', 'The public API did not answer.', true);

  if (s.latest) {
    const open = sessionAt(now) === 'open', justOpened = open && sessionAt(new Date(now.getTime() - 25 * 60000)) !== 'open';
    const limit = open && !justOpened ? 25 : 45, age = min(s.latest.run?.ts, now);
    if (age > limit) add('runs', 'Runs have stopped', `Last run was ${m(age)} ago (limit ${limit}).`, true);
    const src = s.latest.run?.price_source;
    if (src === 'last_close') add('price', 'Run used an old price', `Run ${s.latest.run.id} started from the last close, not a live price.`, true);
    const chainAge = min(s.latest.prices?.chain?.ts, now);
    if (chainAge > 45) add('token-feed', 'Token price is late', `Last token price was ${m(chainAge)} ago.`);
    const stockAge = min(s.latest.prices?.stock?.ts, now);
    if (open && !justOpened && stockAge > 25) add('stock-feed', 'Stock price is late', `Last stock price was ${m(stockAge)} ago.`);
  }
  if (s.proof) {
    const sent = (s.proof.fingerprints ?? []).find((f: any) => f.status === 'sent'), age = min(sent?.sent_at, now);
    if (s.proof.pending >= 2) add('fingerprint-queue', 'Fingerprints are waiting', `${s.proof.pending} hours are not posted yet.`);
    if (age > 135) add('fingerprints', 'Fingerprints have stopped', `Last post was ${m(age)} ago.`, true);
  }
  if (s.gasEth !== null && s.gasEth < 0.001) add('gas', 'Fingerprint wallet is low', `${s.gasEth.toFixed(5)} ETH left for gas.`, true);
  if (s.health?.ai) {
    const { spentUsd: spent, capUsd: cap, capped, byModel } = s.health.ai;
    if (capped) add('ai-cap', 'AI spend cap reached', `$${spent} of $${cap} today. Briefings use the template until midnight ET.`);
    else if (cap > 0 && spent / cap >= 0.8) add('ai-spend', 'AI spend is at 80%', `$${spent} of $${cap} today.`);
    for (const b of byModel ?? []) if (b.calls >= 4 && b.ok / b.calls < 0.5) add('ai-' + b.purpose, `AI ${b.purpose} is failing`, `${b.calls - b.ok} of ${b.calls} calls failed today.`);
  }
  if (s.briefings) { const age = min(s.briefings[0]?.ts, now); if (age > 75) add('briefings', 'Briefings have stopped', `Last briefing was ${m(age)} ago.`); }
  return out;
}

/** What has been seen so far: first time, number of checks in a row, last alert. */
export type State = Record<string, { since: string; n: number; alerted: string | null; title: string }>;
export interface Message { title: string; text: string; urgent: boolean }
const REMIND_MIN = 60;

/** Alert on the second failed check in a row, remind hourly, say when it is fixed. */
export function step(prev: State, problems: Problem[], now: Date): { state: State; messages: Message[] } {
  const state: State = {}, messages: Message[] = [], iso = now.toISOString();
  for (const p of problems) {
    const old = prev[p.id], e = { since: old?.since ?? iso, n: (old?.n ?? 0) + 1, alerted: old?.alerted ?? null, title: p.title };
    if (e.n >= 2 && !e.alerted) { messages.push({ title: p.title, text: p.text, urgent: p.urgent }); e.alerted = iso; }
    else if (e.alerted && min(e.alerted, now) >= REMIND_MIN) { messages.push({ title: 'Still: ' + p.title, text: `${p.text} Started ${m(min(e.since, now))} ago.`, urgent: p.urgent }); e.alerted = iso; }
    state[p.id] = e;
  }
  for (const [id, e] of Object.entries(prev)) if (!state[id] && e.alerted) messages.push({ title: 'Fixed: ' + e.title, text: `It lasted ${m(min(e.since, now))}.`, urgent: false });
  return { state, messages };
}
