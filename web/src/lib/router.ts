import { useEffect, useState } from 'react';

export function navigate(to: string) {
  if (to === location.pathname + location.search) return;
  history.pushState({}, '', to);
  window.dispatchEvent(new Event('popstate'));
  window.scrollTo(0, 0);
}

export function useRoute(): { path: string; query: URLSearchParams } {
  const [loc, setLoc] = useState({ path: location.pathname, search: location.search });
  useEffect(() => {
    const on = () => setLoc({ path: location.pathname, search: location.search });
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return { path: loc.path.replace(/\/+$/, '') || '/', query: new URLSearchParams(loc.search) };
}

/** Internal link that uses client-side navigation. */
export function onLink(e: React.MouseEvent<HTMLAnchorElement>) {
  const href = e.currentTarget.getAttribute('href');
  if (!href || !href.startsWith('/') || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const [path, hash] = href.split('#');
  navigate(path || '/');
  if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 60);
}
