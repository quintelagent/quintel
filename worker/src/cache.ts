/**
 * API cache. The database is never hit by a crowd: while a copy is being refreshed everyone else gets the last good one,
 * and if the database refuses, the last good copy is served for up to an hour.
 * Promises are not shared between requests (Workers does not allow it); only finished bodies are.
 */
interface Entry { body: string; at: number }
export interface Policy { fresh: number; swr: number } // seconds
const KEEP_MS = 3600_000;
const mem = new Map<string, Entry>();
const locks = new Map<string, number>();
export const resetCache = () => { mem.clear(); locks.clear(); };

export interface Store { get(key: string): Promise<Entry | null>; put(key: string, e: Entry): Promise<void> }
/** shared between isolates in the same location */
export function edgeStore(): Store | null {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!c) return null;
  const url = (k: string) => 'https://quintelagent.com/__cache' + k;
  return {
    async get(k) { const r = await c.match(url(k)); return r ? { body: await r.text(), at: Number(r.headers.get('x-at')) || 0 } : null; },
    async put(k, e) { await c.put(url(k), new Response(e.body, { headers: { 'x-at': String(e.at), 'cache-control': 'public, max-age=86400' } })); },
  };
}
const remember = (k: string, e: Entry) => { if (e.body.length > 400_000) return; mem.delete(k); mem.set(k, e); if (mem.size > 150) mem.delete(mem.keys().next().value!); };
const newest = (a: Entry | null | undefined, b: Entry | null | undefined) => (!a ? b ?? null : !b ? a : a.at >= b.at ? a : b);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `load` returns the JSON body, or null for "not found" (never cached). */
export async function cachedBody(key: string, p: Policy, load: () => Promise<string | null>, waitUntil: (x: Promise<unknown>) => void, store: Store | null = edgeStore(), now: () => number = Date.now): Promise<string | null> {
  let e = mem.get(key) ?? null;
  if (!e || now() - e.at > p.fresh * 1000) {
    e = newest(e, await store?.get(key).catch(() => null));
    if (e) remember(key, e);
  }
  const refresh = async () => {
    try {
      const body = await load();
      if (body === null) return null;
      const n = { body, at: now() };
      remember(key, n);
      if (store) waitUntil(store.put(key, n).catch(() => {}));
      return body;
    } finally { locks.delete(key); }
  };
  const locked = () => now() - (locks.get(key) ?? -Infinity) < 8000;
  const age = e ? now() - e.at : Infinity;
  if (e && age <= p.fresh * 1000) return e.body;
  if (e && age <= (p.fresh + p.swr) * 1000) {
    if (!locked()) { locks.set(key, now()); waitUntil(refresh().catch(() => {})); }
    return e.body;
  }
  // nothing usable yet: one request loads, the others wait briefly for it
  if (locked()) {
    const before = e?.at ?? 0;
    for (let i = 0; i < 15; i++) { await sleep(100); const n = mem.get(key); if (n && n.at > before) return n.body; }
  }
  locks.set(key, now());
  try { return await refresh(); } catch (err) {
    const last = newest(mem.get(key), e);
    if (last && now() - last.at <= KEEP_MS) return last.body;
    throw err;
  }
}
