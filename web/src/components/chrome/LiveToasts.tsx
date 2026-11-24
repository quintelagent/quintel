import { useEffect, useRef, useState } from 'react';
import { useToast } from '../ui';
import { useData } from '../../lib/data';
import { useFeed, type FeedEvent, type FeedKind } from '../../lib/feed';
import { useLaptop, useStored } from '../../lib/hooks';
import { MUTE_KEY } from './Header';

const QUIET = 5000, PHONE_GAP = 20000, SAY_GAP = 60000, GATHER = 3000;

/** Feature 05. Watches the shared feed and raises toasts; the feed list shows everything either way. */
export function LiveToasts() {
  const { online } = useData();
  const { events, ready } = useFeed();
  const push = useToast();
  const laptop = useLaptop();
  const [muted] = useStored(MUTE_KEY, false);
  const [said, say] = useState('');
  const born = useRef(Date.now());
  /** per kind: newest time handled so far. Anything at or before it is backlog. */
  const floor = useRef<Partial<Record<FeedKind, number>>>({});
  const seen = useRef(new Set<string>());
  const away = useRef({ hidden: typeof document !== 'undefined' && document.hidden, gathering: false, count: 0 });
  const lastToast = useRef(0), lastSaid = useRef(0);
  const live = useRef({ push, muted, online });
  live.current = { push, muted, online };

  useEffect(() => {
    let t = 0;
    const vis = () => {
      const a = away.current;
      clearTimeout(t);
      if (document.hidden) { a.hidden = true; return; }
      a.hidden = false;
      a.gathering = true;
      // each source refetches on return; wait for all of them, then say it once
      t = window.setTimeout(() => {
        const n = a.count;
        a.gathering = false; a.count = 0;
        const l = live.current;
        if (!n || l.muted || !l.online) return;
        lastToast.current = Date.now();
        l.push({ text: `${n} ${n === 1 ? 'update' : 'updates'} while you were away`, href: '/#briefing' });
      }, GATHER);
    };
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => {
    const fresh: FeedEvent[] = [];
    const firstLoad = new Set((Object.keys(ready) as FeedKind[]).filter((k) => ready[k] && floor.current[k] === undefined));
    for (const k of firstLoad) floor.current[k] = Math.max(0, ...events.filter((e) => e.kind === k).map((e) => Date.parse(e.ts)));
    for (const e of events) {
      if (seen.current.has(e.key)) continue;
      seen.current.add(e.key);
      if (Date.parse(e.ts) > (floor.current[e.kind] ?? Infinity)) fresh.push(e);
    }
    // a batch that loses its first post off the end of the proof list gets a new key, not a new toast
    for (const e of events) if ((floor.current[e.kind] ?? Infinity) < Date.parse(e.ts)) floor.current[e.kind] = Date.parse(e.ts);
    const now = Date.now();
    if (!fresh.length || now - born.current < QUIET) return;
    const a = away.current;
    if (a.hidden || a.gathering) { a.count += fresh.length; return; }
    if (muted || !online) return;

    const run = fresh.find((e) => e.kind === 'run');
    if (run && now - lastSaid.current >= SAY_GAP) { lastSaid.current = now; say(run.toast); }

    if (!laptop && now - lastToast.current < PHONE_GAP) return;
    lastToast.current = now;
    // one per kind, oldest first so the newest sits at the bottom of the stack
    const pick = fresh.filter((e, i) => fresh.findIndex((x) => x.kind === e.kind) === i).slice(0, laptop ? 3 : 1).reverse();
    for (const e of pick) push({ text: e.toast, href: e.href, action: e.action });
  }, [events, ready, laptop, muted, online, push]);

  return <div className="vh" aria-live="polite">{said}</div>;
}
