import { TICK_MS } from '../../lib/pixelGrid';

/** One timer for every animated PixelField on the page. It stops when nothing is subscribed or the tab is hidden. */
const subs = new Set<() => void>();
let timer = 0;
const run = () => subs.forEach((f) => f());
function sync() {
  const want = subs.size > 0 && !document.hidden;
  if (want && !timer) timer = window.setInterval(run, TICK_MS);
  if (!want && timer) { clearInterval(timer); timer = 0; }
}
let listening = false;
export function onTick(f: () => void): () => void {
  if (!listening) { document.addEventListener('visibilitychange', sync); listening = true; }
  subs.add(f); sync();
  return () => { subs.delete(f); sync(); };
}
