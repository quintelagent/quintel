import { useEffect, useState } from 'react';
import { Logo } from '../components/ui';
import { onLink } from '../lib/router';
import { scrollToId } from '../lib/motion';
import { LINKS } from '../lib/links';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const items: [string, string][] = [['Live', '/#live'], ['Tools', '/#tools'], ['Models', '/#models'], ['Desk', '/#desk'], ['Proof', '/#proof'], ['Docs', '/docs']];
  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setOpen(false);
    if (href.startsWith('/#') && location.pathname === '/') { e.preventDefault(); scrollToId(href.slice(2)); return; }
    onLink(e);
  };
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 64,
      background: scrolled || open ? 'rgba(6,8,11,0.82)' : 'transparent', backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`, transition: 'all .3s',
    }}>
      <div className="wrap" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" onClick={onLink} aria-label="Quintel home" style={{ color: 'var(--text)' }}><Logo /></a>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          {items.map(([t, h]) => <a key={t} href={h} onClick={(e) => go(e, h)} style={{ color: 'var(--muted)', fontSize: 14 }}>{t}</a>)}
          <a href={LINKS.github} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', fontSize: 14 }}>GitHub</a>
          <a href={LINKS.x} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', fontSize: 14 }}>X</a>
          <button className="btn sm primary" onClick={() => (location.pathname === '/' ? scrollToId('token') : (location.href = '/#token'))}>$QNTL</button>
        </div>
        <button className="nav-burger btn sm" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>{open ? 'Close' : 'Menu'}</button>
      </div>
      {open && (
        <div className="wrap" style={{ display: 'grid', gap: 18, padding: '18px 16px 28px', background: 'rgba(6,8,11,0.96)', borderBottom: '1px solid var(--border)' }}>
          {items.map(([t, h]) => <a key={t} href={h} onClick={(e) => go(e, h)} style={{ color: 'var(--text)', fontSize: 18 }}>{t}</a>)}
          <a href={LINKS.github} style={{ color: 'var(--text)', fontSize: 18 }}>GitHub</a>
          <a href={LINKS.x} style={{ color: 'var(--text)', fontSize: 18 }}>X</a>
          <a href="/#token" onClick={(e) => go(e, '/#token')} className="btn primary" style={{ justifyContent: 'center' }}>$QNTL</a>
        </div>
      )}
      <style>{`
        .nav-burger { display: none; }
        @media (max-width: 900px) { .nav-links { display: none !important; } .nav-burger { display: inline-flex; } }
      `}</style>
    </nav>
  );
}
