import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, navigate } from '../../lib/router';
import { useStored } from '../../lib/hooks';
import { Button, Sheet, SocialLinks } from '../ui';
import { PixelMark } from '../pixel';

export const MUTE_KEY = 'q-mute-live';
export function MuteToggle() {
  const [muted, set] = useStored(MUTE_KEY, false);
  return <button type="button" className="toggle" role="switch" aria-checked={muted} onClick={() => set(!muted)}><i aria-hidden="true" />Mute live updates</button>;
}
export function Wordmark() {
  return <Link href="/" className="wordmark" aria-label="quintel, home"><PixelMark size={22} /><span>quintel</span></Link>;
}
const LINKS = [['/briefings', 'Briefings'], ['/verify', 'Verify'], ['/docs', 'Docs'], ['/status', 'Status']] as const;

export function Header({ path }: { path: string }) {
  const [open, set] = useState(false);
  const cur = (h: string) => (path === h || path.startsWith(h + '/') ? ('page' as const) : undefined);
  return (
    <header className="header">
      <div className="wrap header-in">
        <Wordmark />
        <nav className="header-nav" aria-label="Main">
          {LINKS.map(([h, t]) => <Link key={h} href={h} aria-current={cur(h)}>{t}</Link>)}
          <Button href="/#position">Check my position</Button>
        </nav>
        <SocialLinks compact />
        <button type="button" className="icon-btn menu-btn" aria-label="Open menu" aria-haspopup="dialog" onClick={() => set(true)}><Menu size={24} strokeWidth={1.5} /></button>
      </div>
      <Sheet full open={open} onClose={() => set(false)} title="Menu">
        <nav className="menu" aria-label="Menu">
          {[['/', 'Home'], ...LINKS, ['/changelog', 'Changelog'], ['/incidents', 'Incidents']].map(([h, t]) => (
            <Link key={h} href={h} aria-current={h === '/' ? (path === '/' ? 'page' : undefined) : cur(h)} onClick={() => set(false)}>{t}</Link>
          ))}
          <Button onClick={() => { set(false); setTimeout(() => navigate('/#position'), 50); }}>Check my position</Button>
          <MuteToggle />
        </nav>
      </Sheet>
    </header>
  );
}
