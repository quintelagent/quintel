import { useEffect, useState, type AnchorHTMLAttributes } from 'react';
import { reducedMotion } from './hooks';

const emit = () => window.dispatchEvent(new Event('q-nav'));

export function scrollToId(id: string, tries = 30) {
  const el = document.getElementById(id);
  if (!el) { if (tries > 0) setTimeout(() => scrollToId(id, tries - 1), 100); return; }
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

export function navigate(to: string) {
  const u = new URL(to, location.href);
  const samePath = u.pathname === location.pathname && u.search === location.search;
  if (u.href !== location.href) history.pushState({}, '', u);
  const go = () => {
    emit();
    if (u.hash) scrollToId(anchorFor(u.hash.slice(1)));
    else if (!samePath) window.scrollTo(0, 0);
    else window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (!samePath && doc.startViewTransition && !reducedMotion()) doc.startViewTransition(go);
  else go();
}

/** the four tool tabs share one card */
export const TOOL_TABS = ['drag', 'whatif', 'weekend', 'position'] as const;
export type ToolTab = (typeof TOOL_TABS)[number];
export const anchorFor = (hash: string) => ((TOOL_TABS as readonly string[]).includes(hash) ? 'tool' : hash);

export interface Route { path: string; query: URLSearchParams; hash: string }
const read = (): Route => ({ path: location.pathname.replace(/\/+$/, '') || '/', query: new URLSearchParams(location.search), hash: location.hash.slice(1) });

export function useRoute(): Route {
  const [r, set] = useState(read);
  useEffect(() => {
    const on = () => set(read());
    window.addEventListener('popstate', on); window.addEventListener('q-nav', on); window.addEventListener('hashchange', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('q-nav', on); window.removeEventListener('hashchange', on); };
  }, []);
  return r;
}

/** Internal links navigate on the client; external ones open in a new tab. */
export function Link({ href = '', onClick, ...p }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const internal = href.startsWith('/') || href.startsWith('#');
  return (
    <a
      href={href}
      {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      {...p}
      onClick={(e) => {
        onClick?.(e);
        if (!internal || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
