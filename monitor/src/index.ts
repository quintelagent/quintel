import { check, step, type Message, type Snapshot, type State } from './checks';

/** Separate from the site on purpose: no database, no site secrets, public endpoints only. */
interface Env { STATE: KVNamespace; NTFY_TOPIC?: string; SITE: string; RPC: string; WALLET: string }
const T = 15000;
const json = (u: string, init: RequestInit = {}) => fetch(u, { ...init, signal: AbortSignal.timeout(T) }).then((r) => (r.ok ? r.json() : null), () => null) as Promise<any>;
const page = (u: string) => fetch(u, { signal: AbortSignal.timeout(T) }).then(async (r) => { const t = await r.text(); return { status: r.status, ok: r.status === 200 && t.includes('id="root"') && t.includes('/assets/index-') }; }, () => null);

export async function snapshot(env: Env): Promise<Snapshot> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [env.WALLET, 'latest'] });
  const [site, verify, latest, health, proof, briefings, bal] = await Promise.all([
    page(env.SITE + '/'), page(env.SITE + '/verify'), json(env.SITE + '/api/latest'), json(env.SITE + '/api/health'), json(env.SITE + '/api/proof'), json(env.SITE + '/api/briefings?limit=1'),
    json(env.RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
  ]);
  return { site, verify, latest, health, proof, briefings, gasEth: typeof bal?.result === 'string' ? Number(BigInt(bal.result)) / 1e18 : null };
}

async function send(env: Env, msg: Message): Promise<boolean> {
  console.log(`[alert] ${msg.title}: ${msg.text}`);
  if (!env.NTFY_TOPIC) return false;
  const r = await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic: env.NTFY_TOPIC, title: 'Quintel: ' + msg.title, message: msg.text, priority: msg.urgent ? 5 : 3, click: env.SITE + '/status' }), signal: AbortSignal.timeout(T) }).catch(() => null);
  return !!r?.ok;
}

async function run(env: Env) {
  const now = new Date();
  const prev = (await env.STATE.get<State>('state', 'json')) ?? {};
  const problems = check(await snapshot(env), now);
  const { state, messages } = step(prev, problems, now);
  for (const msg of messages) {
    const ok = await send(env, msg);
    // not delivered: let the next check try again
    if (!ok && env.NTFY_TOPIC) for (const e of Object.values(state)) if (msg.title.endsWith(e.title)) e.alerted = null;
  }
  if (JSON.stringify(state) !== JSON.stringify(prev)) await env.STATE.put('state', JSON.stringify(state));
  // once a day at 8am ET, and once when the topic is first set, so silence is never mistaken for health
  const et = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = Object.fromEntries(et.map((x) => [x.type, x.value])), day = `${p.year}-${p.month}-${p.day}`;
  if (env.NTFY_TOPIC) {
    const seen = await env.STATE.get('hello');
    const first = !seen, daily = p.hour === '08' && seen !== day;
    if ((first || daily) && await send(env, { title: first ? 'Alerts are on' : 'Daily check', text: problems.length ? `Problems now: ${problems.map((x) => x.title).join(', ')}.` : 'Everything is running.', urgent: false })) await env.STATE.put('hello', day);
  }
  console.log(JSON.stringify({ at: now.toISOString(), problems: problems.map((x) => x.id), sent: messages.length }));
}
export default { async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(run(env)); } } satisfies ExportedHandler<Env>;
