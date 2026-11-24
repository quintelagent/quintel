/**
 * API cache. The database is never hit by a crowd: while a copy is being refreshed everyone else gets the last good one,
 * and if the database refuses, the last good copy is served for up to an hour.
 * Promises are not shared between requests (Workers does not allow it); only finished bodies are.
 */
interface Entry { body: string; at: number }
/** seconds. `keep`: how long the last good copy may stand in when the database refuses (default 1 hour). */
export interface Policy { fresh: number; swr: number; keep?: number }
const VERSION = 'v1'; // change when a response shape changes
const LOCK_MS = 8000, BACKOFF_MS = 3000, WAIT_STEP = 100, WAIT_STEPS = 40, MAX_CHARS = 8_000_000, MAX_BODY = 2_000_000;
const mem = new Map<string, Entry>();
const locks = new Map<string, number>(); // key -> locked until
let chars = 0;
export const resetCache = () => { mem.clear(); locks.clear(); chars = 0; };
export class Busy extends Error {}

export interface Store { get(key: string): Promise<Entry | null>; put(key: string, e: Entry): Promise<void> }
/** shared between isolates in the same location */
export function edgeStore(): Store | null {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!c) return null;
  const url = (k: string) => `https://quintelagent.com/__cache/${VERSION}${k}`;
  return {
    async get(k) { const r = await c.match(url(k)); return r ? { body: await r.text(), at: Number(r.headers.get('x-at')) || 0 } : null; },
    async put(k, e) { await c.put(url(k), new Response(e.body, { headers: { 'x-at': String(e.at), 'cache-control': 'public, max-age=86400' } })); },
  };
}
function drop(k: string) { const e = mem.get(k); if (e) { chars -= e.body.length; mem.delete(k); } }
function remember(k: string, e: Entry) {
  const old = mem.get(k);
  if ((old && old.at >= e.at) || e.body.length > MAX_BODY) return;
  drop(k);
  mem.set(k, e); chars += e.body.length;
  while (chars > MAX_CHARS) drop(mem.keys().next().value!);
}
const newest = (a: Entry | null | undefined, b: Entry | null | undefined) => (!a ? b ?? null : !b ? a : a.at >= b.at ? a : b);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `load` returns the JSON body, or null for "not found" (never cached). Throws `Busy` when there is nothing to serve yet. */
export async function cachedBody(key: string, p: Policy, load: () => Promise<string | null>, waitUntil: (x: Promise<unknown>) => void, store: Store | null = edgeStore(), now: () => number = Date.now): Promise<string | null> {
  const keep = (p.keep ?? 3600) * 1000;
  let e = mem.get(key) ?? null;
  if (!e || now() - e.at > p.fresh * 1000) {
    const shared = await store?.get(key).catch(() => null);
    if (shared) remember(key, shared);
    e = newest(mem.get(key), shared);
  }
  const locked = () => now() < (locks.get(key) ?? -Infinity);
  const usable = (x: Entry | null | undefined): x is Entry => !!x && now() - x.at <= keep;
  const start = (): Promise<string | null> => {
    const until = now() + LOCK_MS;
    locks.set(key, until);
    const release = (next?: number) => { if (locks.get(key) === until) { if (next) locks.set(key, next); else locks.delete(key); } };
    const run = (async () => {
      try {
        const body = await load();
        if (body !== null) {
          const n = { body, at: now() };
          remember(key, n);
          if (store) waitUntil(store.put(key, n).catch(() => {}));
        }
        release();
        return body;
      } catch (err) { release(now() + BACKOFF_MS); throw err; } // a refused database gets a short rest
    })();
    waitUntil(run.catch(() => {})); // finishes even if this visitor leaves
    return run;
  };
  const age = e ? now() - e.at : Infinity;
  if (e && age <= p.fresh * 1000) return e.body;
  if (e && age <= (p.fresh + p.swr) * 1000) {
    if (!locked()) void start().catch(() => {});
    return e.body;
  }
  if (locked()) {
    if (usable(e)) return e.body; // someone else is loading, or the database is resting
    for (let i = 0; i < WAIT_STEPS && locked(); i++) await sleep(WAIT_STEP);
    const n = mem.get(key) ?? null;
    if (usable(n)) return n.body;
    if (locked()) throw new Busy('loading');
  }
  try { return await start(); } catch (err) {
    const last = newest(mem.get(key), e);
    if (usable(last)) return last.body;
    throw err;
  }
}
