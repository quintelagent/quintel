import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useMedia } from '../../lib/hooks';

/** Phone only. Appears after the hero. */
export function StickyBar({ path }: { path: string }) {
  const [past, set] = useState(false);
  const wide = useMedia('(min-width: 768px)');
  useEffect(() => {
    if (path !== '/') { set(false); return; }
    const on = () => {
      const h = document.getElementById('hero');
      set(!!h && h.getBoundingClientRect().bottom < 120);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [path]);
  const show = past && !wide && path === '/';
  useEffect(() => {
    document.documentElement.style.setProperty('--bar-now', show ? 'var(--bar-h)' : '0px');
  }, [show]);
  return (
    <div className={show ? 'sticky on' : 'sticky'} aria-hidden={!show} inert={!show}>
      <Button href="/#position">Check my position</Button>
      <Button href="/verify" variant="secondary">Verify</Button>
    </div>
  );
}
