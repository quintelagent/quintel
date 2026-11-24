import { useNow } from '../../lib/hooks';
import { countdown } from '../../lib/format';

/** Mono countdown to a time. `done` shows once it passes. */
export function Countdown({ to, done = '00:00' }: { to: string | Date; done?: string }) {
  const now = useNow(1000);
  const ms = new Date(to).getTime() - now.getTime();
  return <span className="mono" role="timer">{ms > 0 ? countdown(ms) : done}</span>;
}
