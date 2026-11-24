import { useData } from '../../lib/data';
import { useNow } from '../../lib/hooks';
import { isDelayed } from '../../lib/marketState';
import { etTime } from '../../lib/format';
import { Pill } from '../ui';

/** One banner at a time. Pushes content, never overlays. */
export function Banner({ path }: { path: string }) {
  const { latest, online } = useData();
  const now = useNow(30000);
  const ts = latest?.run?.ts;
  if (!online) return <div className="banner"><div className="wrap row"><Pill>Offline · updates paused</Pill></div></div>;
  // the home hero carries its own Delayed pill, so the page does not shift under it
  if (path !== '/' && ts && isDelayed(ts, now)) return <div className="banner"><div className="wrap row"><Pill>Delayed · last run {etTime(ts)}</Pill><span className="note">The latest run is late. These are the last good odds.</span></div></div>;
  return null;
}
