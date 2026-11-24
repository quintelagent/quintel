import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button, EmptyState, NumberRoll, Skeleton } from '../../components/ui';
import { odds, usd } from '../../lib/format';
import { useStored } from '../../lib/hooks';
import { HORIZON_NAMES, landsOn, positionRun, profitOdds, type HorizonKey, type RunBase } from '../../lib/odds';
import { RunNote } from './DragTab';

export const WATCH_MAX = 5;
export interface Watched { entry: number; h: HorizonKey }
const good = (w: Watched) => !!w && Number.isFinite(w.entry) && w.entry > 0 && ['0', '1', '2'].includes(w.h);
const idOf = (w: Watched) => `${w.entry}:${w.h}`;

/** Saved positions, in localStorage only. */
export function useWatchlist() {
  const [raw, save] = useStored<Watched[]>('q-watchlist', []);
  const list = (Array.isArray(raw) ? raw : []).filter(good).slice(0, WATCH_MAX);
  const has = (entry: number, h: HorizonKey) => list.some((w) => w.entry === entry && w.h === h);
  return {
    list, has,
    add: (entry: number, h: HorizonKey) => { if (!has(entry, h) && list.length < WATCH_MAX) save([...list, { entry, h }]); },
    remove: (w: Watched) => save(list.filter((x) => idOf(x) !== idOf(w))),
  };
}

/** `lost` = the latest run could not be loaded, so nothing can be worked out yet. `none` = there is no run yet. `note` names the run when nothing above does. */
export function Watchlist({ base, active, lost, none, note, onRetry }: { base: RunBase | null; active: boolean; lost: boolean; none: boolean; note: boolean; onRetry: () => void }) {
  const { list, remove } = useWatchlist();
  const [got, setGot] = useState<Record<string, { p: number; base: RunBase }>>({});
  const [broke, setFailed] = useState(false);
  const [n, again] = useState(0);
  const head = useRef<HTMLHeadingElement>(null);
  const failed = broke || lost;
  const from = list.map((w) => got[idOf(w)]?.base).find(Boolean) ?? null;
  const key = list.map(idOf).join();
  // one at a time, so five saved rows never queue behind what is being typed
  useEffect(() => {
    if (!base || !active || !list.length) return;
    let alive = true;
    setFailed(false);
    (async () => {
      for (const w of list) {
        try {
          const p = profitOdds(await positionRun(base, w.entry))[Number(w.h)];
          if (!alive) return;
          setGot((g) => ({ ...g, [idOf(w)]: { p, base } }));
        } catch { if (alive) setFailed(true); return; }
      }
    })();
    return () => { alive = false; };
  }, [base, active, key, n]); // eslint-disable-line

  return (
    <section className="tool-watch" aria-labelledby="tool-watch-h">
      <div className="tool-watch-head"><h3 id="tool-watch-h" tabIndex={-1} ref={head}>Watchlist</h3><p className="note">Saved only on this device.</p></div>
      {!list.length ? <EmptyState text="Save a position to track its odds after every run." /> : (
        <ul>
          {list.map((w) => {
            const r = got[idOf(w)];
            const name = HORIZON_NAMES[Number(w.h)];
            return (
              <li key={idOf(w)}>
                <div><div className="mono tool-watch-v">{usd(w.entry)}</div><div className="label">Entry</div></div>
                <div><div className="mono tool-watch-v">{!r ? failed || none ? '—' : <Skeleton h="1.1em" w="3.5em" /> : <NumberRoll text={odds(r.p)} />}</div><div className="label">{name} odds{r && <span className="tool-watch-by">, on {landsOn(r.base.ts, [1, 5, 21][Number(w.h)])}</span>}</div></div>
                <button type="button" className="icon-btn" aria-label={`Remove ${usd(w.entry)}, ${name}`} onClick={() => { remove(w); head.current?.focus(); }}><X size={20} strokeWidth={1.5} /></button>
              </li>
            );
          })}
        </ul>
      )}
      {note && list.length > 0 && (from || !failed) && <RunNote futures="100,000" id={from?.id ?? null} ts={from?.ts ?? null} />}
      {failed && list.length > 0 && <div className="row tool-watch-err" role="alert"><p className="note">Couldn’t update the watchlist. Try again.</p><Button variant="secondary" onClick={() => { if (lost) onRetry(); again((x) => x + 1); }}>Try again</Button></div>}
    </section>
  );
}
